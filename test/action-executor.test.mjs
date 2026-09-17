import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActionToolRegistry,
  InMemoryActionProposalStore,
  SalesActionExecutor,
} from '../src/index.mjs'

function proposal(store, sessionId = 'sales-1') {
  return store.create({ sessionId, kind: 'book_demo', label: 'Book a demo' })
}

test('pending proposal cannot execute without explicit confirmation', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = new ActionToolRegistry().register('book_demo', async () => ({ provider: 'test' }))
  const executor = new SalesActionExecutor({ store, tools })
  const item = proposal(store)

  await assert.rejects(
    () => executor.execute(item.id, { sessionId: 'sales-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(store.get(item.id).status, 'pending')
})

test('successful retry is idempotent and does not run a side effect twice', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    return {
      provider: 'calendar-sandbox',
      referenceId: 'ref-1',
      status: 'completed',
      summary: 'Created once',
      sandbox: true,
      secret: 'must-not-survive',
      nested: { token: 'must-not-survive' },
    }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const item = proposal(store)
  store.confirm(item.id, { sessionId: 'sales-1' })

  const first = await executor.execute(item.id, { sessionId: 'sales-1' })
  const second = await executor.execute(item.id, { sessionId: 'sales-1' })

  assert.equal(calls, 1)
  assert.equal(first.status, 'executed')
  assert.deepEqual(second, first)
  assert.deepEqual(first.receipt, {
    provider: 'calendar-sandbox',
    referenceId: 'ref-1',
    status: 'completed',
    summary: 'Created once',
    sandbox: true,
  })
  assert.equal('secret' in first.receipt, false)
  assert.equal('nested' in first.receipt, false)
})

test('concurrent double execution runs the tool at most once', async () => {
  const store = new InMemoryActionProposalStore()
  let calls = 0
  let release
  const gate = new Promise(resolve => { release = resolve })
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    calls += 1
    await gate
    return { provider: 'sandbox', referenceId: 'one', sandbox: true }
  })
  const executor = new SalesActionExecutor({ store, tools })
  const item = proposal(store)
  store.confirm(item.id, { sessionId: 'sales-1' })

  const first = executor.execute(item.id, { sessionId: 'sales-1' })
  await new Promise(resolve => setImmediate(resolve))
  const second = executor.execute(item.id, { sessionId: 'sales-1' })

  await assert.rejects(second, error => ['CONFIRMATION_REQUIRED', 'INVALID_TRANSITION'].includes(error?.code))
  assert.equal(calls, 1)
  release()
  const result = await first
  assert.equal(result.status, 'executed')
  assert.equal(calls, 1)
})

test('cross-session execution is hidden as not found', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = new ActionToolRegistry().register('book_demo', async () => ({ provider: 'sandbox' }))
  const executor = new SalesActionExecutor({ store, tools })
  const item = proposal(store, 'sales-a')
  store.confirm(item.id, { sessionId: 'sales-a' })

  await assert.rejects(
    () => executor.execute(item.id, { sessionId: 'sales-b' }),
    error => error?.code === 'NOT_FOUND',
  )
  assert.equal(store.get(item.id, { sessionId: 'sales-a' }).status, 'confirmed')
})

test('tool failure records failed status without claiming execution', async () => {
  const store = new InMemoryActionProposalStore()
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    throw new Error('provider unavailable')
  })
  const executor = new SalesActionExecutor({ store, tools })
  const item = proposal(store)
  store.confirm(item.id, { sessionId: 'sales-1' })

  await assert.rejects(() => executor.execute(item.id, { sessionId: 'sales-1' }), /provider unavailable/)
  const failed = store.get(item.id)
  assert.equal(failed.status, 'failed')
  assert.equal(failed.executed, false)
  assert.equal(failed.receipt, null)
  assert.match(failed.error, /provider unavailable/)
})
