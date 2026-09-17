import test from 'node:test'
import assert from 'node:assert/strict'
import { InMemorySalesSessionStore, MockSalesReasoner, ProductCatalog, SalesBackendAdapter } from '../src/index.mjs'

function makeBackend() { const sessions = new InMemorySalesSessionStore(); const backend = new SalesBackendAdapter({ reasoner: new MockSalesReasoner(), sessions, catalog: new ProductCatalog() }); return { backend, sessions } }

test('backend collects deterministic requirements then recommends from catalog', async () => {
  const { backend, sessions } = makeBackend(); await backend.start()
  await backend.submit({ taskId: 't1', ownerId: 'lead-1', instruction: 'We are 45 reps and require Salesforce and SSO.' })
  const first = sessions.get('lead-1')
  assert.equal(first.teamSize, 45); assert.deepEqual(first.requirements.sort(), ['salesforce','sso'])
  first.conversationStage = 'recommendation'; sessions.set('lead-1', first)
  const result = await backend.submit({ taskId: 't2', ownerId: 'lead-1', instruction: 'Which plan is the best fit?' })
  assert.equal(result.artifacts[0].data.type, 'product_card'); assert.equal(result.artifacts[0].data.props.id, 'enterprise')
})

test('backend emits normalized activity and artifact events', async () => {
  const { backend, sessions } = makeBackend(); const events = []; backend.subscribe(event => events.push(event)); await backend.start()
  sessions.set('lead-2', { ...sessions.ensure('lead-2'), conversationStage: 'recommendation', requirements: ['sso'] })
  await backend.submit({ taskId: 't3', ownerId: 'lead-2', instruction: 'Recommend a plan.' })
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(events.some(e => e.type === 'backend.activity' && e.activity.status === 'completed'))
  assert.ok(events.some(e => e.type === 'backend.artifact'))
})
