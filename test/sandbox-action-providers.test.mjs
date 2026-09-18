import test from 'node:test'
import assert from 'node:assert/strict'
import {
  InMemoryActionProposalStore,
  SALES_ACTION_KINDS,
  SalesActionExecutor,
  createSandboxActionToolRegistry,
} from '../src/index.mjs'
import { createSandboxActionHandlers } from '../src/actions/providers/sandbox-action-providers.mjs'

test('sandbox provider layer exposes a handler for every allowlisted action kind', () => {
  const handlers = createSandboxActionHandlers({ idFactory: () => 'fixed' })
  assert.deepEqual([...handlers.keys()], [...SALES_ACTION_KINDS])
  for (const kind of SALES_ACTION_KINDS) {
    assert.equal(typeof handlers.get(kind), 'function')
  }
})

test('unsupported action kinds fail instead of selecting a generic sandbox handler', async () => {
  const registry = createSandboxActionToolRegistry({ idFactory: () => 'fixed' })
  await assert.rejects(
    () => registry.run('charge_credit_card', {}),
    error => error?.code === 'ACTION_TOOL_UNAVAILABLE',
  )
  assert.throws(
    () => registry.register('charge_credit_card', async () => ({})),
    error => error?.code === 'UNSUPPORTED_ACTION',
  )
})

test('sandbox handlers require no network access', async () => {
  const registry = createSandboxActionToolRegistry({ idFactory: () => 'offline' })
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('sandbox provider attempted network access')
  }

  try {
    for (const kind of SALES_ACTION_KINDS) {
      const receipt = await registry.run(kind, {
        proposal: { kind, label: `Safe ${kind}` },
      })
      assert.equal(receipt.provider, 'sandbox')
      assert.equal(receipt.sandbox, true)
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(networkCalls, 0)
})

test('sandbox receipts contain only the expected safe fields', async () => {
  const registry = createSandboxActionToolRegistry({ idFactory: () => 'receipt' })
  const receipt = await registry.run('send_followup', {
    proposal: {
      kind: 'send_followup',
      label: 'Send follow-up',
      token: 'must-not-copy',
      providerPayload: { secret: 'must-not-copy' },
    },
  })

  assert.deepEqual(Object.keys(receipt).sort(), [
    'provider',
    'referenceId',
    'sandbox',
    'status',
    'summary',
  ].sort())
  assert.deepEqual(receipt, {
    provider: 'sandbox',
    referenceId: 'sandbox_send_followup_receipt',
    status: 'completed',
    summary: 'Sandbox acknowledged Send follow-up; no external side effect occurred.',
    sandbox: true,
  })
})

test('sandbox reference IDs use the injected deterministic ID factory', async () => {
  const ids = ['first', 'second']
  const registry = createSandboxActionToolRegistry({ idFactory: () => ids.shift() })
  const first = await registry.run('book_demo', {
    proposal: { kind: 'book_demo', label: 'Book a demo' },
  })
  const second = await registry.run('start_trial', {
    proposal: { kind: 'start_trial', label: 'Start a trial' },
  })

  assert.equal(first.referenceId, 'sandbox_book_demo_first')
  assert.equal(second.referenceId, 'sandbox_start_trial_second')
})

test('sandbox provider failures propagate to the caller', async () => {
  const registry = createSandboxActionToolRegistry({
    idFactory: () => { throw new Error('sandbox provider failure') },
  })
  await assert.rejects(
    () => registry.run('review_proposal', {
      proposal: { kind: 'review_proposal', label: 'Review proposal' },
    }),
    /sandbox provider failure/,
  )
})

test('sandbox providers do not bypass proposal confirmation', async () => {
  const store = new InMemoryActionProposalStore()
  let providerCalls = 0
  const tools = createSandboxActionToolRegistry({
    idFactory: () => {
      providerCalls += 1
      return 'should-not-run'
    },
  })
  const executor = new SalesActionExecutor({ store, tools })
  const proposal = store.create({ sessionId: 'buyer-1', kind: 'book_demo' })

  await assert.rejects(
    () => executor.execute(proposal.id, { sessionId: 'buyer-1' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(providerCalls, 0)
  assert.equal(store.get(proposal.id, { sessionId: 'buyer-1' }).status, 'pending')
})
