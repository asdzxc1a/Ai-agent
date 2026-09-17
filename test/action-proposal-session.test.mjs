import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AvatarSessionManager,
  InMemoryActionProposalStore,
  SalesOSHarness,
} from '../src/index.mjs'

test('session manager confirms and cancels proposals without executing them and audits lifecycle', async () => {
  const harness = new SalesOSHarness()
  const actionProposals = new InMemoryActionProposalStore()
  const bridge = {
    async start() {
      return {
        sessionId: 'live-action-1',
        gatewaySessionId: 'sales-avatar-action-1',
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
  const manager = new AvatarSessionManager({
    createBridge: () => bridge,
    harness,
    actionProposals,
  })

  await manager.start({ id: 'action-1' })
  const proposal = actionProposals.create({
    sessionId: 'sales-avatar-action-1',
    taskId: 'task-action-1',
    kind: 'book_demo',
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-avatar-action-1',
    type: 'sales.action.proposed',
    proposal,
  })

  assert.equal(manager.status('action-1').pendingActions, 1)
  assert.equal(manager.actions('action-1').length, 1)

  const confirmed = manager.confirmAction('action-1', proposal.id)
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(confirmed.executed, false)
  assert.equal(manager.status('action-1').pendingActions, 0)

  const cancelled = manager.cancelAction('action-1', proposal.id)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.executed, false)

  const bundle = manager.learning('action-1')
  const actionEvents = bundle.trajectory.events.filter(event => event.type.startsWith('sales.action.'))
  assert.deepEqual(actionEvents.map(event => event.type), [
    'sales.action.proposed',
    'sales.action.confirmed',
    'sales.action.cancelled',
  ])
  assert.ok(actionEvents.every(event => event.data.executed === false))

  await manager.stop('action-1')
})
