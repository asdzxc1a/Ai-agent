import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AvatarSessionManager,
  InMemoryActionProposalStore,
  SalesOSHarness,
} from '../src/index.mjs'

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

test('skill review: automatic proposal expiry must be observable in SalesOS', async () => {
  let now = '2026-09-18T16:00:00.000Z'
  const store = new InMemoryActionProposalStore({
    clock: () => now,
    proposalTtlMs: 1_000,
  })
  const harness = new SalesOSHarness()
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => fakeBridge(id),
    actionProposals: store,
    harness,
  })

  await manager.start({ id: 'buyer-expiry-audit' })
  const proposal = store.create({
    sessionId: 'sales-avatar-buyer-expiry-audit',
    kind: 'book_demo',
  })
  harness.recordActionLifecycle({
    sessionId: proposal.sessionId,
    type: 'sales.action.proposed',
    proposal,
  })

  now = '2026-09-18T16:00:02.000Z'
  const [expired] = manager.actions('buyer-expiry-audit')
  assert.equal(expired.status, 'expired')

  const types = harness.exportLearningBundle(proposal.sessionId)
    .trajectory.events
    .map(event => event.type)

  assert.equal(types.includes('sales.action.expired'), true)
  await manager.close()
})
