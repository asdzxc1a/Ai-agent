import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import {
  GatewayClient,
} from 'qwen-audio-agent/gateway-client-sdk'
import {
  GatewayClientCapability,
  GatewayClientProtocolEvent,
} from 'qwen-audio-agent/gateway-client-protocol'
import {
  GatewayTaskEvent,
} from 'qwen-audio-agent/realtime-events'
import {
  InMemorySalesSessionStore,
  MockSalesReasoner,
  ProductCatalog,
  SalesBackendAdapter,
} from '../src/index.mjs'
import { SALES_VISUAL_MEDIA_TYPE } from '../src/domain/sales-artifacts.mjs'
import { createQwenSalesGateway } from '../src/integrations/qwen-gateway.mjs'

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}

test('real Qwen Gateway websocket returns sales artifact from our BackendPort', async () => {
  const sessions = new InMemorySalesSessionStore()
  const backend = new SalesBackendAdapter({
    reasoner: new MockSalesReasoner(),
    sessions,
    catalog: new ProductCatalog(),
  })
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

  const server = application.start({ host: '127.0.0.1', port: 0 })
  if (!server.listening) await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const events = []
  let readyResolve
  let readyReject
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  let completedResolve
  const completed = new Promise(resolve => { completedResolve = resolve })

  const client = new GatewayClient({
    url: `ws://127.0.0.1:${port}/api/realtime?sessionId=offline-sales-e2e`,
    createSocket: url => new WebSocket(url),
    clientType: 'sales-avatar-test',
    clientVersion: '0.5.0',
    clientInstanceId: 'sales-avatar-test-1',
    reconnect: false,
    capabilities: [GatewayClientCapability.TASK_COMMANDS],
    configure: {
      voiceEnabled: false,
      inputEnabled: false,
      outputEnabled: false,
      textOnly: true,
    },
    onStatus(status) {
      if (status.state === 'ready') readyResolve()
      if (status.state === 'unavailable') readyReject(status.error || new Error('Gateway unavailable'))
    },
    onEvent(event) {
      events.push(event)
      if (event.type === GatewayTaskEvent.COMPLETED) completedResolve(event)
    },
  })

  try {
    client.start()
    await Promise.race([ready, timeout(5_000, 'Gateway Client did not become ready')])
    assert.equal(client.supports(GatewayClientCapability.TASK_COMMANDS), true)

    const created = await client.request(GatewayClientProtocolEvent.TASK_CREATE, {
      message: {
        parts: [{
          type: 'text',
          text: 'We have 45 sales reps and need Salesforce and SSO. Which plan fits us?',
        }],
      },
    })
    assert.ok(created.task?.id)

    const completedEvent = await Promise.race([
      completed,
      timeout(5_000, 'Qwen did not deliver a completed task event'),
    ])
    assert.equal(completedEvent.task.id, created.task.id)
    assert.equal(completedEvent.task.workState, 'completed')
    assert.match(completedEvent.task.result || '', /Enterprise|best fit|recommendation/i)
    assert.equal(completedEvent.task.artifacts?.length, 1)
    const artifact = completedEvent.task.artifacts[0]
    assert.equal(artifact.parts[0].mediaType, SALES_VISUAL_MEDIA_TYPE)
    assert.equal(artifact.parts[0].data.type, 'product_card')
    assert.equal(artifact.parts[0].data.props.id, 'enterprise')

    const persisted = sessions.get(completedEvent.task.sessionId || 'offline-sales-e2e')
      || [...sessions.entries?.() || []][0]?.[1]
    const knownState = sessions.get('offline-sales-e2e')
      || sessions.get(completedEvent.task.ownerId)
      || persisted
    assert.equal(knownState?.teamSize, 45)
    assert.deepEqual(knownState?.requirements?.slice().sort(), ['salesforce', 'sso'])
    assert.ok(events.some(event => event.type === GatewayTaskEvent.RUNNING))
  } finally {
    client.stop()
    await application.close()
  }
})
