import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createActionExecutionRuntime,
  InMemoryActionProposalStore,
  SalesOSHarness,
} from '../src/index.mjs'

test('action execution defaults to disabled and exposes no executor', () => {
  const store = new InMemoryActionProposalStore()
  const runtime = createActionExecutionRuntime({ env: {}, store })
  assert.equal(runtime.mode, 'disabled')
  assert.equal(runtime.enabled, false)
  assert.equal(runtime.executor, null)
  assert.equal(runtime.tools.has('book_demo'), false)
})

test('sandbox mode executes only the local fake provider after confirmation', async () => {
  const store = new InMemoryActionProposalStore()
  const harness = new SalesOSHarness()
  const runtime = createActionExecutionRuntime({
    env: { SALES_ACTION_EXECUTION_MODE: 'sandbox' },
    store,
    harness,
  })
  assert.equal(runtime.mode, 'sandbox')
  assert.equal(runtime.enabled, true)
  assert.ok(runtime.executor)
  assert.equal(runtime.tools.has('book_demo'), true)

  const proposal = store.create({ sessionId: 's1', kind: 'book_demo', label: 'Book a demo' })
  store.confirm(proposal.id, { sessionId: 's1' })
  const executed = await runtime.executor.execute(proposal.id, { sessionId: 's1' })

  assert.equal(executed.status, 'executed')
  assert.equal(executed.executed, true)
  assert.equal(executed.receipt.provider, 'sandbox')
  assert.equal(executed.receipt.sandbox, true)
  assert.match(executed.receipt.referenceId, /^sandbox_book_demo_/)
})

test('unknown execution mode fails closed instead of falling back to sandbox', () => {
  const store = new InMemoryActionProposalStore()
  assert.throws(
    () => createActionExecutionRuntime({ env: { SALES_ACTION_EXECUTION_MODE: 'production' }, store }),
    /Unsupported SALES_ACTION_EXECUTION_MODE: production/,
  )
})
