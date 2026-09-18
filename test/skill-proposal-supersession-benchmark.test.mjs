import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActionToolRegistry,
  InMemoryActionProposalStore,
  InMemorySalesSessionStore,
  ProductCatalog,
  SalesActionExecutor,
  SalesBackendAdapter,
  SalesOSHarness,
} from '../src/index.mjs'
import { actionProposalMarkup } from '../web/action-ui.js'

function nextStepReasoner() {
  return {
    async decide() {
      return {
        statePatch: { nextStep: 'book_demo' },
        content: 'Offer the next demo step.',
        visual: {
          type: 'next_step',
          kind: 'book_demo',
          props: {
            label: 'Book a demo',
            description: 'Choose a time for a technical demo.',
          },
        },
        confidence: 0.9,
      }
    },
  }
}

test('skill benchmark: only older pending proposals in the same session and kind are superseded', () => {
  let tick = 0
  const store = new InMemoryActionProposalStore({
    clock: () => `2026-09-18T17:00:${String(tick++).padStart(2, '0')}Z`,
  })
  const oldPending = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const confirmed = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  store.confirm(confirmed.id, { sessionId: 'buyer-a' })
  const otherKind = store.create({ sessionId: 'buyer-a', kind: 'start_trial' })
  const otherSession = store.create({ sessionId: 'buyer-b', kind: 'book_demo' })
  const replacement = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })

  const changed = store.supersedePending({
    sessionId: 'buyer-a',
    kind: 'book_demo',
    supersededByProposalId: replacement.id,
  })

  assert.deepEqual(changed.map(item => item.id), [oldPending.id])
  const old = store.get(oldPending.id)
  assert.equal(old.status, 'superseded')
  assert.equal(old.supersededByProposalId, replacement.id)
  assert.ok(old.supersededAt)
  assert.equal(store.get(confirmed.id).status, 'confirmed')
  assert.equal(store.get(otherKind.id).status, 'pending')
  assert.equal(store.get(otherSession.id).status, 'pending')
  assert.equal(store.get(replacement.id).status, 'pending')
})

test('skill benchmark: backend supersedes old next-step and audits both lifecycle changes', async () => {
  const sessions = new InMemorySalesSessionStore()
  const actionProposals = new InMemoryActionProposalStore()
  const harness = new SalesOSHarness()
  const backend = new SalesBackendAdapter({
    sessions,
    catalog: new ProductCatalog(),
    actionProposals,
    harness,
    reasoner: nextStepReasoner(),
  })

  await backend.submit({
    taskId: 'task-1',
    ownerId: 'buyer',
    sessionId: 'sales-supersede',
    instruction: 'Offer a demo',
  })
  const first = actionProposals.list({ sessionId: 'sales-supersede' })[0]
  assert.equal(first.status, 'pending')

  const secondResult = await backend.submit({
    taskId: 'task-2',
    ownerId: 'buyer',
    sessionId: 'sales-supersede',
    instruction: 'Offer the updated demo next step',
  })
  const proposals = actionProposals.list({ sessionId: 'sales-supersede' })
  const old = proposals.find(item => item.id === first.id)
  const current = proposals.find(item => item.id !== first.id)

  assert.equal(old.status, 'superseded')
  assert.equal(old.supersededByProposalId, current.id)
  assert.equal(current.status, 'pending')
  assert.equal(secondResult.artifacts[0].parts[0].data.props.proposalId, current.id)

  const actionEvents = harness.exportLearningBundle('sales-supersede')
    .trajectory.events
    .filter(event => event.type.startsWith('sales.action.'))
  assert.deepEqual(actionEvents.map(event => event.type), [
    'sales.action.proposed',
    'sales.action.proposed',
    'sales.action.superseded',
  ])
  assert.equal(actionEvents[1].data.proposalId, current.id)
  assert.equal(actionEvents[2].data.proposalId, first.id)
  assert.equal(actionEvents[2].data.supersededByProposalId, current.id)
})

test('skill benchmark: superseded proposal cannot execute or reach provider', async () => {
  const store = new InMemoryActionProposalStore()
  let providerCalls = 0
  const tools = new ActionToolRegistry().register('book_demo', async () => {
    providerCalls += 1
    return { provider: 'sandbox', sandbox: true }
  })
  const executor = new SalesActionExecutor({ store, tools })

  const old = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const replacement = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  store.supersedePending({
    sessionId: 'buyer-a',
    kind: 'book_demo',
    supersededByProposalId: replacement.id,
  })

  await assert.rejects(
    () => executor.execute(old.id, { sessionId: 'buyer-a' }),
    error => error?.code === 'CONFIRMATION_REQUIRED',
  )
  assert.equal(providerCalls, 0)
  assert.equal(store.get(old.id).status, 'superseded')
})

test('skill benchmark: invalid replacement cannot supersede another action scope', () => {
  const store = new InMemoryActionProposalStore()
  store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const wrongSession = store.create({ sessionId: 'buyer-b', kind: 'book_demo' })

  assert.throws(
    () => store.supersedePending({
      sessionId: 'buyer-a',
      kind: 'book_demo',
      supersededByProposalId: wrongSession.id,
    }),
    error => error?.code === 'SESSION_MISMATCH',
  )
  assert.equal(store.list({ sessionId: 'buyer-a' })[0].status, 'pending')
})

test('skill adversary: an older replacement cannot supersede proposals created after it', () => {
  const store = new InMemoryActionProposalStore()
  const olderReplacement = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const newer = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })

  const changed = store.supersedePending({
    sessionId: 'buyer-a',
    kind: 'book_demo',
    supersededByProposalId: olderReplacement.id,
  })

  assert.deepEqual(changed, [])
  assert.equal(store.get(olderReplacement.id).status, 'pending')
  assert.equal(store.get(newer.id).status, 'pending')
})

test('skill adversary: terminal proposal cannot be used to supersede live work', () => {
  const store = new InMemoryActionProposalStore()
  const live = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  const invalidReplacement = store.create({ sessionId: 'buyer-a', kind: 'book_demo' })
  store.cancel(invalidReplacement.id, { sessionId: 'buyer-a' })

  assert.throws(
    () => store.supersedePending({
      sessionId: 'buyer-a',
      kind: 'book_demo',
      supersededByProposalId: invalidReplacement.id,
    }),
    error => error?.code === 'INVALID_TRANSITION',
  )
  assert.equal(store.get(live.id).status, 'pending')
})

test('skill benchmark: superseded UI is terminal and truthful', () => {
  const markup = actionProposalMarkup({
    id: 'old-action',
    kind: 'book_demo',
    label: '<b>Old demo</b>',
    description: 'Replaced by a newer proposal.',
    status: 'superseded',
    supersededByProposalId: 'new-action',
  }, { executionMode: 'sandbox' })

  assert.match(markup, /action-superseded/)
  assert.match(markup, /Superseded — a newer server proposal replaced this pending action\./)
  assert.match(markup, /&lt;b&gt;Old demo&lt;\/b&gt;/)
  assert.equal(markup.includes('data-action-command='), false)
  assert.equal(markup.includes('Execute sandbox'), false)
})
