import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AvatarSessionManager,
  createAvatarControlServer,
  createSandboxActionToolRegistry,
  InMemoryActionProposalStore,
  SalesActionExecutor,
  SalesOSHarness,
} from '../src/index.mjs'

function createBridge(id) {
  return {
    async start() {
      return {
        sessionId: `live-${id}`,
        gatewaySessionId: `sales-avatar-${id}`,
        livekitUrl: 'wss://livekit',
        livekitClientToken: 'token',
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

function createManager({ execution = true } = {}) {
  const actionProposals = new InMemoryActionProposalStore()
  const harness = new SalesOSHarness()
  const actionExecutor = execution
    ? new SalesActionExecutor({
        store: actionProposals,
        tools: createSandboxActionToolRegistry({ idFactory: () => 'fixed' }),
        harness,
      })
    : null
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => createBridge(id),
    actionProposals,
    actionExecutor,
    harness,
  })
  return { manager, actionProposals, harness }
}

test('session execution requires confirmation and preserves idempotency', async () => {
  const { manager, actionProposals } = createManager()
  await manager.start({ id: 'buyer-1' })
  const proposal = actionProposals.create({
    sessionId: 'sales-avatar-buyer-1',
    kind: 'book_demo',
  })

  await assert.rejects(
    () => manager.executeAction('buyer-1', proposal.id),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )

  manager.confirmAction('buyer-1', proposal.id)
  const executed = await manager.executeAction('buyer-1', proposal.id)
  const retried = await manager.executeAction('buyer-1', proposal.id)

  assert.equal(executed.status, 'executed')
  assert.equal(executed.receipt.provider, 'sandbox')
  assert.deepEqual(retried, executed)
  await manager.close()
})

test('session execution fails closed when executor is disabled', async () => {
  const { manager, actionProposals } = createManager({ execution: false })
  await manager.start({ id: 'buyer-disabled' })
  const proposal = actionProposals.create({
    sessionId: 'sales-avatar-buyer-disabled',
    kind: 'book_demo',
  })
  manager.confirmAction('buyer-disabled', proposal.id)

  await assert.rejects(
    () => manager.executeAction('buyer-disabled', proposal.id),
    error => error?.code === 'ACTION_EXECUTION_DISABLED',
  )
  assert.equal(actionProposals.get(proposal.id).status, 'confirmed')
  await manager.close()
})

test('control API cannot execute pending actions and executes confirmed sandbox action once', async () => {
  const { manager, actionProposals } = createManager()
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()

  try {
    const createdResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    assert.equal(createdResponse.status, 201)
    const session = await createdResponse.json()
    const proposal = actionProposals.create({
      sessionId: session.gatewaySessionId,
      kind: 'book_demo',
      label: 'Book a demo',
    })

    const pendingExecute = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/execute`,
      { method: 'POST' },
    )
    assert.equal(pendingExecute.status, 409)
    assert.equal((await pendingExecute.json()).code, 'CONFIRMATION_REQUIRED')

    const confirm = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/confirm`,
      { method: 'POST' },
    )
    assert.equal(confirm.status, 200)
    assert.equal((await confirm.json()).status, 'confirmed')

    const execute = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/execute`,
      { method: 'POST' },
    )
    assert.equal(execute.status, 200)
    const first = await execute.json()
    assert.equal(first.status, 'executed')
    assert.equal(first.receipt.sandbox, true)

    const retry = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/execute`,
      { method: 'POST' },
    )
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), first)
  } finally {
    await control.close()
  }
})

test('control API hides cross-session action proposals', async () => {
  const { manager, actionProposals } = createManager()
  await manager.start({ id: 'buyer-a' })
  await manager.start({ id: 'buyer-b' })
  const proposal = actionProposals.create({
    sessionId: 'sales-avatar-buyer-a',
    kind: 'book_demo',
  })
  manager.confirmAction('buyer-a', proposal.id)

  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()
  try {
    const response = await fetch(
      `${origin}/sessions/buyer-b/actions/${encodeURIComponent(proposal.id)}/execute`,
      { method: 'POST' },
    )
    assert.equal(response.status, 404)
    assert.equal((await response.json()).code, 'NOT_FOUND')
    assert.equal(actionProposals.get(proposal.id).status, 'confirmed')
  } finally {
    await control.close()
  }
})

test('cancelled action cannot execute', async () => {
  const { manager, actionProposals } = createManager()
  await manager.start({ id: 'buyer-cancelled' })
  const proposal = actionProposals.create({
    sessionId: 'sales-avatar-buyer-cancelled',
    kind: 'book_demo',
  })
  manager.confirmAction('buyer-cancelled', proposal.id)
  manager.cancelAction('buyer-cancelled', proposal.id)

  await assert.rejects(
    () => manager.executeAction('buyer-cancelled', proposal.id),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(actionProposals.get(proposal.id).status, 'cancelled')
  await manager.close()
})

test('manager passes optional execution context without allowing session identity overrides', async () => {
  let captured = null
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => createBridge(id),
    actionExecutor: {
      async execute(proposalId, input) {
        captured = { proposalId, input }
        return { id: proposalId, status: 'executed' }
      },
    },
  })
  await manager.start({ id: 'buyer-context' })

  const result = await manager.executeAction('buyer-context', 'action-context', {
    note: 'internal-context',
    avatarSessionId: 'spoofed-avatar',
    gatewaySessionId: 'spoofed-gateway',
  })

  assert.equal(result.status, 'executed')
  assert.equal(captured.proposalId, 'action-context')
  assert.equal(captured.input.sessionId, 'sales-avatar-buyer-context')
  assert.equal(captured.input.context.note, 'internal-context')
  assert.equal(captured.input.context.avatarSessionId, 'buyer-context')
  assert.equal(captured.input.context.gatewaySessionId, 'sales-avatar-buyer-context')
  await manager.close()
})

test('HTTP execute request cannot smuggle confirmation or executed state', async () => {
  const { manager, actionProposals } = createManager()
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()

  try {
    const createdResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    const session = await createdResponse.json()
    const proposal = actionProposals.create({
      sessionId: session.gatewaySessionId,
      kind: 'book_demo',
    })

    const response = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/execute`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'confirmed',
          requiresConfirmation: false,
          executed: true,
          confirmation: true,
        }),
      },
    )

    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'CONFIRMATION_REQUIRED')
    assert.equal(actionProposals.get(proposal.id).status, 'pending')
  } finally {
    await control.close()
  }
})

