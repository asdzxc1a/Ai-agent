import test from 'node:test'
import assert from 'node:assert/strict'
import { InMemoryActionProposalStore } from '../src/index.mjs'

function storeWithClock() {
  let tick = 0
  return new InMemoryActionProposalStore({
    clock: () => `2026-09-17T18:10:${String(tick++).padStart(2, '0')}Z`,
  })
}

test('action proposal requires explicit confirmation before execution state can begin', () => {
  const store = storeWithClock()
  const proposal = store.create({
    sessionId: 'sales-1',
    taskId: 'task-1',
    kind: 'book_demo',
    description: 'Technical demo with a specialist',
  })

  assert.equal(proposal.status, 'pending')
  assert.equal(proposal.requiresConfirmation, true)
  assert.equal(proposal.executed, false)
  assert.match(proposal.id, /^action_/)
  assert.throws(
    () => store.beginExecution(proposal.id, { sessionId: 'sales-1' }),
    error => error.code === 'CONFIRMATION_REQUIRED',
  )

  const confirmed = store.confirm(proposal.id, { sessionId: 'sales-1' })
  assert.equal(confirmed.status, 'confirmed')
  assert.ok(confirmed.confirmedAt)
  assert.equal(confirmed.executed, false)

  const executing = store.beginExecution(proposal.id, { sessionId: 'sales-1' })
  assert.equal(executing.status, 'executing')
  assert.equal(executing.executed, false)

  const executed = store.completeExecution(proposal.id, { sessionId: 'sales-1' })
  assert.equal(executed.status, 'executed')
  assert.equal(executed.executed, true)
  assert.ok(executed.executedAt)
})

test('confirmation and cancellation are session-isolated and idempotent where safe', () => {
  const store = storeWithClock()
  const proposal = store.create({ sessionId: 'buyer-a', kind: 'human_handoff' })

  assert.throws(
    () => store.confirm(proposal.id, { sessionId: 'buyer-b' }),
    error => error.code === 'SESSION_MISMATCH',
  )

  const first = store.confirm(proposal.id, { sessionId: 'buyer-a' })
  const second = store.confirm(proposal.id, { sessionId: 'buyer-a' })
  assert.equal(second.confirmedAt, first.confirmedAt)

  const cancelled = store.cancel(proposal.id, { sessionId: 'buyer-a' })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.executed, false)
  assert.throws(
    () => store.beginExecution(proposal.id, { sessionId: 'buyer-a' }),
    error => error.code === 'CONFIRMATION_REQUIRED',
  )
})

test('unsupported action kinds are rejected before persistence', () => {
  const store = storeWithClock()
  assert.throws(
    () => store.create({ sessionId: 'sales-1', kind: 'charge_card' }),
    error => error.code === 'UNSUPPORTED_ACTION',
  )
  assert.deepEqual(store.list({ sessionId: 'sales-1' }), [])
})
