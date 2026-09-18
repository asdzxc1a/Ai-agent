import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createActionExecutionRuntime,
  InMemoryActionProposalStore,
  SALES_ACTION_KINDS,
  SalesOSHarness,
} from '../src/index.mjs'

test('action execution defaults to disabled', () => {
  const store = new InMemoryActionProposalStore()
  const runtime = createActionExecutionRuntime({ env: {}, store })
  assert.equal(runtime.mode, 'disabled')
  assert.equal(runtime.enabled, false)
  assert.equal(runtime.executor, null)
  assert.equal(runtime.tools.has('book_demo'), false)
})

test('explicit disabled mode stays disabled', () => {
  const store = new InMemoryActionProposalStore()
  const runtime = createActionExecutionRuntime({
    env: { SALES_ACTION_EXECUTION_MODE: 'disabled' },
    store,
  })
  assert.equal(runtime.mode, 'disabled')
  assert.equal(runtime.enabled, false)
  assert.equal(runtime.executor, null)
})

test('sandbox mode creates a usable executor after confirmation', async () => {
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
    () => createActionExecutionRuntime({
      env: { SALES_ACTION_EXECUTION_MODE: 'production' },
      store,
    }),
    /Unsupported SALES_ACTION_EXECUTION_MODE: production/,
  )
})

test('disabled mode cannot accidentally execute through its empty registry', async () => {
  const store = new InMemoryActionProposalStore()
  const runtime = createActionExecutionRuntime({
    env: { SALES_ACTION_EXECUTION_MODE: 'disabled' },
    store,
  })
  const proposal = store.create({ sessionId: 's-disabled', kind: 'book_demo' })
  store.confirm(proposal.id, { sessionId: 's-disabled' })

  assert.equal(runtime.executor, null)
  await assert.rejects(
    () => runtime.tools.run('book_demo', { proposal }),
    error => error?.code === 'ACTION_TOOL_UNAVAILABLE',
  )
  assert.equal(store.get(proposal.id, { sessionId: 's-disabled' }).status, 'confirmed')
})

test('sandbox mode never performs external network work', async () => {
  const store = new InMemoryActionProposalStore()
  const runtime = createActionExecutionRuntime({
    env: { SALES_ACTION_EXECUTION_MODE: 'sandbox' },
    store,
  })
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('network access is forbidden in sandbox mode')
  }

  try {
    for (const kind of SALES_ACTION_KINDS) {
      const proposal = store.create({ sessionId: 'sandbox-network', kind })
      store.confirm(proposal.id, { sessionId: 'sandbox-network' })
      const executed = await runtime.executor.execute(proposal.id, {
        sessionId: 'sandbox-network',
      })
      assert.equal(executed.status, 'executed')
      assert.equal(executed.receipt.sandbox, true)
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(networkCalls, 0)
})
