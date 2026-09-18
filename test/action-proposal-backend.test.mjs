import test from 'node:test'
import assert from 'node:assert/strict'
import {
  InMemoryActionProposalStore,
  InMemorySalesSessionStore,
  ProductCatalog,
  SalesBackendAdapter,
  SalesOSHarness,
} from '../src/index.mjs'

test('next-step decision becomes server-owned proposal with generated id', async () => {
  const sessions = new InMemorySalesSessionStore()
  const actionProposals = new InMemoryActionProposalStore()
  const harness = new SalesOSHarness()
  const backend = new SalesBackendAdapter({
    sessions,
    catalog: new ProductCatalog(),
    actionProposals,
    harness,
    reasoner: {
      async decide() {
        return {
          statePatch: { nextStep: 'book_demo' },
          content: 'Offer a technical demo, but wait for confirmation.',
          visual: {
            type: 'next_step',
            kind: 'book_demo',
            props: {
              proposalId: 'model-invented-id',
              executed: true,
              calendarUrl: 'https://malicious.example',
            },
          },
          confidence: 0.9,
        }
      },
    },
  })

  const result = await backend.submit({
    taskId: 'action-task-1',
    ownerId: 'owner-1',
    sessionId: 'sales-action-1',
    instruction: 'Yes, what is the next step?',
  })

  assert.equal(result.artifacts.length, 1)
  const visual = result.artifacts[0].parts[0].data
  assert.equal(visual.type, 'next_step')
  assert.equal(visual.props.kind, 'book_demo')
  assert.match(visual.props.proposalId, /^action_/)
  assert.notEqual(visual.props.proposalId, 'model-invented-id')
  assert.equal(visual.props.status, 'pending')
  assert.equal(visual.props.requiresConfirmation, true)
  assert.equal(visual.props.executed, false)
  assert.equal('calendarUrl' in visual.props, false)

  const proposals = actionProposals.list({ sessionId: 'sales-action-1' })
  assert.equal(proposals.length, 1)
  assert.equal(proposals[0].id, visual.props.proposalId)
  assert.equal(proposals[0].status, 'pending')
  assert.equal(sessions.get('sales-action-1').nextStep, 'book_demo')

  const bundle = harness.exportLearningBundle('sales-action-1')
  const proposed = bundle.trajectory.events.find(event => event.type === 'sales.action.proposed')
  assert.ok(proposed)
  assert.equal(proposed.data.proposalId, visual.props.proposalId)
  assert.equal(proposed.data.status, 'pending')
  assert.equal(proposed.data.executed, false)
})
