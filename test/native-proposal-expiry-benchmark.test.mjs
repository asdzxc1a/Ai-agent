import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActionToolRegistry,
  AvatarSessionManager,
  InMemoryActionProposalStore,
  SalesActionExecutor,
  createAvatarControlServer,
} from '../src/index.mjs'
import { createSalesBackendFromEnv } from '../src/runtime/build-runtime.mjs'
import { actionProposalMarkup } from '../web/action-ui.js'

function fakeBridge(id) {
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

test('native benchmark: proposal TTL expires pending and confirmed actions deterministically', () => {
  let now = '2026-09-18T12:00:00.000Z'
  const store = new InMemoryActionProposalStore({
    clock: () => now,
    proposalTtlMs: 1_000,
  })
  const pending = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  assert.equal(pending.expiresAt, '2026-09-18T12:00:01.000Z')

  now = '2026-09-18T12:00:02.000Z'
  const expiredPending = store.get(pending.id, { sessionId: 'buyer-1' })
  assert.equal(expiredPending.status, 'expired')
  assert.equal(expiredPending.expiredAt, now)
  assert.throws(
    () => store.confirm(pending.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'ACTION_EXPIRED',
  )

  now = '2026-09-18T13:00:00.000Z'
  const confirmed = store.create({ sessionId: 'buyer-2', kind: 'start_trial' })
  store.confirm(confirmed.id, { sessionId: 'buyer-2' })
  now = '2026-09-18T13:00:02.000Z'
  assert.throws(
    () => store.beginExecution(confirmed.id, { sessionId: 'buyer-2' }),
    error => error?.code === 'ACTION_EXPIRED',
  )
  assert.equal(store.get(confirmed.id).status, 'expired')
})

test('native benchmark: expired proposal never reaches provider', async () => {
  let now = '2026-09-18T14:00:00.000Z'
  const store = new InMemoryActionProposalStore({
    clock: () => now,
    proposalTtlMs: 500,
  })
  let providerCalls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    providerCalls += 1
    return { provider: 'sandbox', sandbox: true }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 'buyer-1' })
  now = '2026-09-18T14:00:01.000Z'

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'ACTION_EXPIRED',
  )
  assert.equal(providerCalls, 0)
  assert.equal(store.get(proposal.id).status, 'expired')
})

test('native benchmark: runtime environment wires proposal TTL with disabled default execution', () => {
  const runtime = createSalesBackendFromEnv({
    SALES_REASONER_MODE: 'mock',
    SALES_ACTION_PROPOSAL_TTL_MS: '30000',
  })
  assert.equal(runtime.actionProposalTtlMs, 30_000)
  assert.equal(runtime.actionProposals.proposalTtlMs, 30_000)
  assert.equal(runtime.actionExecution.mode, 'disabled')
})

test('native benchmark: HTTP returns 410 for an expired action', async () => {
  let now = '2026-09-18T15:00:00.000Z'
  const store = new InMemoryActionProposalStore({
    clock: () => now,
    proposalTtlMs: 1_000,
  })
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => fakeBridge(id),
    actionProposals: store,
    actionExecutor: new SalesActionExecutor({
      store,
      tools: new ActionToolRegistry().register('book_demo', async () => ({
        provider: 'sandbox',
        sandbox: true,
      })),
    }),
  })
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()

  try {
    const sessionResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    const session = await sessionResponse.json()
    const proposal = store.create({
      sessionId: session.gatewaySessionId,
      kind: 'book_demo',
    })
    now = '2026-09-18T15:00:02.000Z'

    const response = await fetch(
      `${origin}/sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(proposal.id)}/confirm`,
      { method: 'POST' },
    )
    assert.equal(response.status, 410)
    const body = await response.json()
    assert.equal(body.code, 'ACTION_EXPIRED')
    assert.equal(store.get(proposal.id).status, 'expired')
  } finally {
    await control.close()
  }
})

test('native benchmark: expired UI is terminal and exposes no controls', () => {
  const markup = actionProposalMarkup({
    id: 'action-expired',
    kind: 'book_demo',
    label: 'Book a demo',
    description: 'This proposal timed out.',
    status: 'expired',
  }, { executionMode: 'sandbox' })

  assert.match(markup, /action-expired/)
  assert.match(markup, /Expired — this action is no longer valid/)
  assert.equal(markup.includes('data-action-command='), false)
  assert.equal(markup.includes('Execute sandbox'), false)
  assert.equal(markup.includes('>Confirm<'), false)
})
