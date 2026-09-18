import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActionToolRegistry,
  AvatarSessionManager,
  InMemoryActionProposalStore,
  SALES_ACTION_KINDS,
  SalesActionExecutor,
  SalesOSHarness,
  canonicalizeSalesVisual,
  createAvatarControlServer,
  createSandboxActionToolRegistry,
} from '../../src/index.mjs'

function createBridge(id) {
  return {
    async start() {
      return {
        sessionId: `live-${id}`,
        gatewaySessionId: `sales-avatar-${id}`,
        livekitUrl: 'wss://livekit.invalid',
        livekitClientToken: 'test-token',
        inputSampleRate: 24000,
      }
    },
    getStatus() { return { started: true } },
    sendInputAudio() { return true },
    sendText() { return true },
    interrupt() { return true },
    async close() {},
  }
}

function managerFixture({ tools = null, executor = true, harness = new SalesOSHarness() } = {}) {
  const store = new InMemoryActionProposalStore()
  const actionTools = tools || createSandboxActionToolRegistry({ idFactory: () => 'security' })
  const actionExecutor = executor ? new SalesActionExecutor({ store, tools: actionTools, harness }) : null
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => createBridge(id),
    actionProposals: store,
    actionExecutor,
    harness,
  })
  return { store, tools: actionTools, actionExecutor, manager, harness }
}

test('1. pending proposal cannot execute', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    return { provider: 'test' }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(calls, 0)
  assert.equal(store.get(proposal.id).status, 'pending')
})

test('2. cancelled pending proposal cannot execute', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = new ActionToolRegistry().register('book_demo', async () => ({ provider: 'test' }))
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.cancel(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(store.get(proposal.id).status, 'cancelled')
})

test('3. another session cannot execute a proposal', async () => {
  const { store, actionExecutor } = managerFixture()
  const proposal = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-a' })

  await assert.rejects(
    () => actionExecutor.execute(proposal.id, { sessionId: 'buyer-b' }),
    error => error?.code === 'NOT_FOUND',
  )
  assert.equal(store.get(proposal.id, { sessionId: 'buyer-a' }).status, 'confirmed')
})

test('4. another session cannot confirm a proposal', async () => {
  const { store, manager } = managerFixture()
  await manager.start({ id: 'buyer-a' })
  await manager.start({ id: 'buyer-b' })
  const proposal = store.create({ sessionId: 'sales-avatar-buyer-a', kind: 'book_demo' })

  assert.throws(
    () => manager.confirmAction('buyer-b', proposal.id),
    error => error?.code === 'SESSION_MISMATCH',
  )
  assert.equal(store.get(proposal.id).status, 'pending')
  await manager.close()
})

test('5. simultaneous double execution runs the provider at most once', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  let release
  let startedResolve
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { startedResolve = resolve })
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    startedResolve()
    await gate
    return { provider: 'sandbox', referenceId: 'once', sandbox: true }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })

  const first = executor.execute(proposal.id, { sessionId: 'buyer-1' })
  await started
  const second = executor.execute(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(
    second,
    error => ['CONFIRMATION_REQUIRED', 'INVALID_TRANSITION'].includes(error?.code),
  )
  assert.equal(calls, 1)
  release()
  assert.equal((await first).status, 'executed')
  assert.equal(calls, 1)
})

test('6. HTTP retry after success returns the executed result without rerunning the provider', async () => {
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    return {
      provider: 'sandbox',
      referenceId: 'http-once',
      status: 'completed',
      summary: 'Executed once',
      sandbox: true,
    }
  })
  const { store, manager } = managerFixture({ tools })
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()

  try {
    const sessionResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    const session = await sessionResponse.json()
    const proposal = store.create({ sessionId: session.gatewaySessionId, kind: 'book_demo' })
    await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/confirm`,
      { method: 'POST' },
    )

    const url = `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/execute`
    const first = await fetch(url, { method: 'POST' })
    const second = await fetch(url, { method: 'POST' })
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.deepEqual(await second.json(), await first.json())
    assert.equal(calls, 1)
  } finally {
    await control.close()
  }
})

test('7. provider throw after starting execution records failed state', async () => {
  const store = new InMemoryActionProposalStore()
  let halfway = false
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    halfway = true
    throw new Error('provider failed halfway')
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    /provider failed halfway/,
  )
  assert.equal(halfway, true)
  const failed = store.get(proposal.id)
  assert.equal(failed.status, 'failed')
  assert.equal(failed.executed, false)
  assert.equal(failed.receipt, null)
})

test('8. replay after failure does not rerun the provider', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    throw new Error('provider down')
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(() => executor.execute(proposal.id, { sessionId: 'buyer-1' }), /provider down/)
  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(calls, 1)
  assert.equal(store.get(proposal.id).status, 'failed')
})

test('9. model-authored executed=true is discarded', () => {
  const visual = canonicalizeSalesVisual({
    type: 'next_step',
    kind: 'book_demo',
    props: {
      label: 'Book now',
      executed: true,
      requiresConfirmation: false,
    },
  })
  assert.equal(visual.props.executed, false)
  assert.equal(visual.props.requiresConfirmation, true)
})

test('10. model-authored fake URL and calendar slot are discarded', () => {
  const visual = canonicalizeSalesVisual({
    type: 'next_step',
    kind: 'book_demo',
    props: {
      label: 'Book now',
      calendarUrl: 'javascript:alert(1)',
      meetingUrl: 'https://evil.example/fake',
      meetingTime: 'Tomorrow at 2 PM',
      slotId: 'provider-slot-123',
    },
  })
  assert.deepEqual(visual.props, {
    kind: 'book_demo',
    label: 'Book now',
    description: '',
    requiresConfirmation: true,
    executed: false,
  })
})

test('11. malicious provider receipt is sanitized before persistence and SalesOS audit', async () => {
  const store = new InMemoryActionProposalStore()
  const harness = new SalesOSHarness()
  const tools = new ActionToolRegistry().register('book_demo', async () => ({
    provider: 'calendar-test',
    referenceId: 'safe-ref',
    status: 'completed',
    summary: 'Safe summary',
    sandbox: true,
    token: 'receipt-secret',
    authorization: 'Bearer secret',
    nested: { access_token: 'nested-secret' },
  }))
  const executor = new SalesActionExecutor({ store, tools, harness })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })
  const result = await executor.execute(proposal.id, {
    sessionId: 'buyer-1',
    context: { apiKey: 'context-secret' },
  })

  assert.deepEqual(result.receipt, {
    provider: 'calendar-test',
    referenceId: 'safe-ref',
    status: 'completed',
    summary: 'Safe summary',
    sandbox: true,
  })
  const serialized = JSON.stringify(harness.exportLearningBundle('buyer-1'))
  assert.equal(serialized.includes('receipt-secret'), false)
  assert.equal(serialized.includes('nested-secret'), false)
  assert.equal(serialized.includes('context-secret'), false)
})

test('12. unknown action type is rejected before persistence', () => {
  const store = new InMemoryActionProposalStore()
  assert.throws(
    () => store.create({ sessionId: 'buyer-1', kind: 'wire_money' }),
    error => error?.code === 'UNSUPPORTED_ACTION',
  )
  assert.deepEqual(store.list({ sessionId: 'buyer-1' }), [])
})

test('13. malformed proposal ID fails as not found without touching a provider', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    return { provider: 'test' }
  })
  const executor = new SalesActionExecutor({ store, tools })

  await assert.rejects(
    () => executor.execute('../../etc/passwd?token=secret', { sessionId: 'buyer-1' }),
    error => error?.code === 'NOT_FOUND',
  )
  assert.equal(calls, 0)
})

test('14. concurrent buyers remain isolated during execution', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = new ActionToolRegistry().register('book_demo', async ({ proposal }) => ({
    provider: 'sandbox',
    referenceId: `ref-${proposal.sessionId}`,
    summary: proposal.sessionId,
    sandbox: true,
  }))
  const executor = new SalesActionExecutor({ store, tools })
  const a = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const b = store.create({ sessionId: 'buyer-b', kind: 'book_demo' })
  store.confirm(a.id, { sessionId: 'buyer-a' })
  store.confirm(b.id, { sessionId: 'buyer-b' })

  const [ra, rb] = await Promise.all([
    executor.execute(a.id, { sessionId: 'buyer-a' }),
    executor.execute(b.id, { sessionId: 'buyer-b' }),
  ])
  assert.equal(ra.receipt.referenceId, 'ref-buyer-a')
  assert.equal(rb.receipt.referenceId, 'ref-buyer-b')
  assert.equal(store.get(a.id, { sessionId: 'buyer-b' }), null)
  assert.equal(store.get(b.id, { sessionId: 'buyer-a' }), null)
})

test('15. more than twenty simultaneous proposals execute independently', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async ({ proposal }) => {
    calls += 1
    await Promise.resolve()
    return { provider: 'sandbox', referenceId: proposal.id, sandbox: true }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposals = Array.from({ length: 25 }, () => {
    const proposal = store.create({ sessionId: 'buyer-bulk', kind: 'book_demo' })
    store.confirm(proposal.id, { sessionId: 'buyer-bulk' })
    return proposal
  })

  const results = await Promise.all(proposals.map(proposal => executor.execute(proposal.id, {
    sessionId: 'buyer-bulk',
  })))
  assert.equal(results.length, 25)
  assert.equal(results.every(result => result.status === 'executed'), true)
  assert.equal(calls, 25)
})

test('16. server-owned proposal can still be confirmed after renderer shutdown under current session contract', async () => {
  const { store, manager } = managerFixture()
  await manager.start({ id: 'buyer-1' })
  const proposal = store.create({
    sessionId: 'sales-avatar-buyer-1',
    kind: 'human_handoff',
  })
  assert.equal(await manager.stop('buyer-1'), true)

  const confirmed = manager.confirmAction('buyer-1', proposal.id)
  assert.equal(confirmed.status, 'confirmed')
  await manager.close()
})

test('17. confirmed then cancelled proposal cannot execute', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    return { provider: 'test' }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })
  store.cancel(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(calls, 0)
  assert.equal(store.get(proposal.id).status, 'cancelled')
})

test('18. confirmed proposal fails closed when no handler is configured', async () => {
  const store = new InMemoryActionProposalStore()
  const executor = new SalesActionExecutor({
    store,
    tools: new ActionToolRegistry(),
  })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'ACTION_TOOL_UNAVAILABLE',
  )
  assert.equal(store.get(proposal.id).status, 'confirmed')
})

test('19. sandbox execution never performs a real network request', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = createSandboxActionToolRegistry({ idFactory: () => 'offline' })
  const executor = new SalesActionExecutor({ store, tools })
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('network forbidden')
  }

  try {
    for (const kind of SALES_ACTION_KINDS) {
      const proposal = store.create({ sessionId: 'buyer-offline', kind })
      store.confirm(proposal.id, { sessionId: 'buyer-offline' })
      const result = await executor.execute(proposal.id, { sessionId: 'buyer-offline' })
      assert.equal(result.receipt.sandbox, true)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(networkCalls, 0)
})

test('20. SalesOS action audit rejects private context, credentials and arbitrary receipt payloads', () => {
  const harness = new SalesOSHarness()
  harness.recordActionLifecycle({
    sessionId: 'buyer-1',
    type: 'sales.action.executed',
    proposal: {
      id: 'action-1',
      taskId: 'task-1',
      kind: 'book_demo',
      label: 'Book a demo',
      status: 'executed',
      requiresConfirmation: true,
      executed: true,
      token: 'proposal-token',
      hiddenReasoning: 'chain-of-thought-secret',
      context: { apiKey: 'private-context-secret' },
      error: 'Authorization: Bearer failure-secret',
      receipt: {
        provider: 'sandbox',
        referenceId: 'safe-ref',
        status: 'completed',
        summary: 'Safe summary',
        sandbox: true,
        authorization: 'Bearer receipt-secret',
        providerResponse: { access_token: 'nested-provider-secret' },
      },
    },
  })

  const bundle = harness.exportLearningBundle('buyer-1')
  const serialized = JSON.stringify(bundle)
  for (const secret of [
    'proposal-token',
    'chain-of-thought-secret',
    'private-context-secret',
    'receipt-secret',
    'nested-provider-secret',
    'failure-secret',
  ]) {
    assert.equal(serialized.includes(secret), false)
  }
  const [event] = bundle.trajectory.events
  assert.deepEqual(event.data.receipt, {
    provider: 'sandbox',
    referenceId: 'safe-ref',
    status: 'completed',
    summary: 'Safe summary',
    sandbox: true,
  })
})
