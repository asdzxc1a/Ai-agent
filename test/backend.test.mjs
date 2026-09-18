import test from 'node:test'
import assert from 'node:assert/strict'
import { InMemorySalesSessionStore, MockSalesReasoner, ProductCatalog, SalesBackendAdapter } from '../src/index.mjs'
import { SALES_VISUAL_MEDIA_TYPE } from '../src/domain/sales-artifacts.mjs'

function makeBackend() { const sessions = new InMemorySalesSessionStore(); const backend = new SalesBackendAdapter({ reasoner: new MockSalesReasoner(), sessions, catalog: new ProductCatalog() }); return { backend, sessions } }

test('backend collects deterministic requirements then recommends from catalog', async () => {
  const { backend, sessions } = makeBackend(); await backend.start()
  await backend.submit({ taskId: 't1', ownerId: 'lead-1', instruction: 'We are 45 reps and require Salesforce and SSO.' })
  const first = sessions.get('lead-1')
  assert.equal(first.teamSize, 45); assert.deepEqual(first.requirements.sort(), ['salesforce','sso'])
  first.conversationStage = 'recommendation'; sessions.set('lead-1', first)
  const result = await backend.submit({ taskId: 't2', ownerId: 'lead-1', instruction: 'Which plan is the best fit?' })
  const artifact = result.artifacts[0]
  assert.equal(artifact.artifactId, 'sales_visual_t2')
  assert.equal(artifact.parts[0].mediaType, SALES_VISUAL_MEDIA_TYPE)
  assert.equal(artifact.parts[0].data.type, 'product_card')
  assert.equal(artifact.parts[0].data.props.id, 'enterprise')
})

test('backend emits normalized activity and standard artifact events', async () => {
  const { backend, sessions } = makeBackend(); const events = []; backend.subscribe(event => events.push(event)); await backend.start()
  sessions.set('lead-2', { ...sessions.ensure('lead-2'), conversationStage: 'recommendation', requirements: ['sso'] })
  await backend.submit({ taskId: 't3', ownerId: 'lead-2', instruction: 'Recommend a plan.' })
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(events.some(e => e.type === 'backend.activity' && e.activity.status === 'completed'))
  const artifactEvent = events.find(e => e.type === 'backend.artifact')
  assert.equal(artifactEvent.artifact.artifactId, 'sales_visual_t3')
  assert.equal(artifactEvent.artifact.parts[0].mediaType, SALES_VISUAL_MEDIA_TYPE)
})
