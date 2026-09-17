import test from 'node:test'
import assert from 'node:assert/strict'
import {
  InMemorySalesSessionStore,
  MockSalesReasoner,
  ProductCatalog,
  SalesBackendAdapter,
} from '../src/index.mjs'
import { SALES_VISUAL_MEDIA_TYPE } from '../src/domain/sales-artifacts.mjs'
import { createQwenSalesGateway } from '../src/integrations/qwen-gateway.mjs'

function makeBackend() {
  const sessions = new InMemorySalesSessionStore()
  const backend = new SalesBackendAdapter({
    reasoner: new MockSalesReasoner(),
    sessions,
    catalog: new ProductCatalog(),
  })
  return { backend, sessions }
}

test('sales backend composes into the real Qwen Gateway runtime with standard artifacts', async () => {
  const { backend, sessions } = makeBackend()
  const application = await createQwenSalesGateway({
    backend,
    applicationOptions: {
      autoStart: false,
      parentPort: null,
      publicEndpoint: null,
      frontendMcp: null,
      frontendOpenApi: null,
    },
  })

  try {
    const outcome = await application.services.backendRuntime.run({
      objective: 'We have 45 sales reps and need Salesforce and SSO. Which plan fits?',
    }, {
      taskId: 'gateway-sales-task-1',
      ownerId: 'gateway-lead-1',
    })

    assert.match(outcome.content, /best fit|recommendation|Enterprise/i)
    assert.equal(sessions.get('gateway-lead-1').teamSize, 45)
    assert.deepEqual(
      sessions.get('gateway-lead-1').requirements.sort(),
      ['salesforce', 'sso'],
    )
    assert.equal(application.services.agent.protocol, 'sales-backend')
    assert.equal(outcome.artifacts.length, 1)
    assert.equal(outcome.artifacts[0].artifactId, 'sales_visual_gateway-sales-task-1')
    assert.equal(outcome.artifacts[0].parts[0].mediaType, SALES_VISUAL_MEDIA_TYPE)
    assert.equal(outcome.artifacts[0].parts[0].data.type, 'product_card')
    assert.equal(outcome.artifacts[0].parts[0].data.props.id, 'enterprise')
  } finally {
    await application.close()
  }
})
