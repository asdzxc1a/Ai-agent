import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesOSHarness } from '../src/harness/sales-os-harness.mjs'

function proposal(overrides = {}) {
  return {
    id: 'action-1',
    taskId: 'task-1',
    kind: 'book_demo',
    label: 'Book a demo',
    status: 'pending',
    requiresConfirmation: true,
    executed: false,
    createdAt: '2026-09-18T12:00:00Z',
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    failedAt: null,
    receipt: null,
    error: null,
    ...overrides,
  }
}

test('SalesOS records proposed, confirmed and cancelled action events', () => {
  const harness = new SalesOSHarness()
  harness.recordActionLifecycle({
    sessionId: 'sales-1',
    type: 'sales.action.proposed',
    proposal: proposal(),
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-1',
    type: 'sales.action.confirmed',
    proposal: proposal({
      status: 'confirmed',
      confirmedAt: '2026-09-18T12:00:01Z',
    }),
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-1',
    type: 'sales.action.cancelled',
    proposal: proposal({
      status: 'cancelled',
      confirmedAt: '2026-09-18T12:00:01Z',
      cancelledAt: '2026-09-18T12:00:02Z',
    }),
  })

  const events = harness.exportLearningBundle('sales-1').trajectory.events
  assert.deepEqual(events.map(event => event.type), [
    'sales.action.proposed',
    'sales.action.confirmed',
    'sales.action.cancelled',
  ])
  assert.deepEqual(events.map(event => event.data.status), [
    'pending',
    'confirmed',
    'cancelled',
  ])
  assert.deepEqual(events.map(event => event.sequence), [1, 2, 3])
})

test('SalesOS records executing and executed events with sanitized receipts in order', () => {
  const harness = new SalesOSHarness()
  const shared = {
    confirmedAt: '2026-09-18T12:00:01Z',
    token: 'proposal-token-must-not-survive',
    authorizationHeader: 'Bearer proposal-secret',
    hiddenReasoning: 'private chain of thought',
    context: { apiKey: 'context-secret' },
  }

  harness.recordActionLifecycle({
    sessionId: 'sales-2',
    type: 'sales.action.proposed',
    proposal: proposal(shared),
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-2',
    type: 'sales.action.confirmed',
    proposal: proposal({ ...shared, status: 'confirmed' }),
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-2',
    type: 'sales.action.executing',
    proposal: proposal({ ...shared, status: 'executing' }),
  })
  harness.recordActionLifecycle({
    sessionId: 'sales-2',
    type: 'sales.action.executed',
    proposal: proposal({
      ...shared,
      status: 'executed',
      executed: true,
      executedAt: '2026-09-18T12:00:03Z',
      receipt: {
        provider: 'calendar-sandbox',
        referenceId: 'sandbox-123',
        status: 'completed',
        summary: 'Sandbox demo booking recorded.',
        sandbox: true,
        token: 'receipt-token-must-not-survive',
        authorization: 'Bearer receipt-secret',
        providerBody: { access_token: 'nested-secret' },
      },
    }),
  })

  const bundle = harness.exportLearningBundle('sales-2')
  const events = bundle.trajectory.events
  assert.deepEqual(events.map(event => event.type), [
    'sales.action.proposed',
    'sales.action.confirmed',
    'sales.action.executing',
    'sales.action.executed',
  ])
  assert.deepEqual(events.map(event => event.sequence), [1, 2, 3, 4])

  const executed = events.at(-1)
  assert.equal(executed.data.executed, true)
  assert.deepEqual(executed.data.receipt, {
    provider: 'calendar-sandbox',
    referenceId: 'sandbox-123',
    status: 'completed',
    summary: 'Sandbox demo booking recorded.',
    sandbox: true,
  })

  const serialized = JSON.stringify(bundle)
  for (const forbidden of [
    'proposal-token-must-not-survive',
    'proposal-secret',
    'private chain of thought',
    'context-secret',
    'receipt-token-must-not-survive',
    'receipt-secret',
    'nested-secret',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('SalesOS records failed actions without claiming execution', () => {
  const harness = new SalesOSHarness()
  harness.recordActionLifecycle({
    sessionId: 'sales-3',
    type: 'sales.action.failed',
    proposal: proposal({
      status: 'failed',
      failedAt: '2026-09-18T12:00:04Z',
      error: 'provider unavailable',
      receipt: null,
      executed: false,
    }),
  })

  const [event] = harness.exportLearningBundle('sales-3').trajectory.events
  assert.equal(event.type, 'sales.action.failed')
  assert.equal(event.data.status, 'failed')
  assert.equal(event.data.executed, false)
  assert.equal(event.data.error, 'provider unavailable')
  assert.equal(event.data.receipt, null)
})

test('SalesOS action audit ignores unrelated lifecycle names and arbitrary proposal fields', () => {
  const harness = new SalesOSHarness()
  assert.equal(harness.recordActionLifecycle({
    sessionId: 'sales-4',
    type: 'model.hidden.reasoning',
    proposal: proposal(),
  }), null)

  harness.recordActionLifecycle({
    sessionId: 'sales-4',
    type: 'sales.action.proposed',
    proposal: proposal({
      arbitraryProviderPayload: { secret: 'should-not-appear' },
      rawPcm: 'audio-bytes',
      chainOfThought: 'hidden reasoning',
    }),
  })

  const [event] = harness.exportLearningBundle('sales-4').trajectory.events
  assert.deepEqual(Object.keys(event.data).sort(), [
    'cancelledAt',
    'confirmedAt',
    'createdAt',
    'error',
    'executed',
    'executedAt',
    'failedAt',
    'kind',
    'label',
    'proposalId',
    'receipt',
    'requiresConfirmation',
    'status',
    'taskId',
  ].sort())
  const serialized = JSON.stringify(event)
  assert.equal(serialized.includes('should-not-appear'), false)
  assert.equal(serialized.includes('audio-bytes'), false)
  assert.equal(serialized.includes('hidden reasoning'), false)
})
