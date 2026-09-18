import test from 'node:test'
import assert from 'node:assert/strict'
import { MockSalesReasoner, ProductCatalog, SalesBackendAdapter, SalesOSHarness, InMemorySalesSessionStore } from '../src/index.mjs'

test('sales backend writes a structured policy decision into the shared SalesOS trajectory', async () => {
  const sessions = new InMemorySalesSessionStore()
  const harness = new SalesOSHarness()
  const backend = new SalesBackendAdapter({ reasoner: new MockSalesReasoner(), sessions, catalog: new ProductCatalog(), harness })
  await backend.start()
  await backend.submit({ taskId: 't1', ownerId: 'buyer-1', sessionId: 'sales-avatar-1', instruction: 'We have 45 reps and need Salesforce.' })

  const bundle = harness.exportLearningBundle('sales-avatar-1')
  const decision = bundle.trajectory.events.find(event => event.type === 'sales.decision')
  assert.ok(decision)
  assert.equal(decision.taskId, 't1')
  assert.equal(decision.data.deterministicPatch.teamSize, 45)
  assert.equal(decision.data.stateAfter.teamSize, 45)
  assert.equal(typeof decision.data.strategy.outline.objective, 'string')
})
