import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { GatewayClient } from 'qwen-audio-agent/gateway-client-sdk'
import {
  GatewayClientCapability,
  GatewayClientProtocolEvent,
} from 'qwen-audio-agent/gateway-client-protocol'
import { GatewayTaskEvent } from 'qwen-audio-agent/realtime-events'
import {
  InMemorySalesSessionStore,
  MockSalesReasoner,
  ProductCatalog,
  SalesBackendAdapter,
} from '../src/index.mjs'
import { SALES_VISUAL_MEDIA_TYPE } from '../src/domain/sales-artifacts.mjs'
import { createQwenSalesGateway } from '../src/integrations/qwen-gateway.mjs'
import {
  bootstrapQwenGatewayIdentity,
  mergeGatewaySocketOptions,
} from '../src/integrations/qwen-identity.mjs'

// The production server prepares these before dynamically importing Qwen's
// Gateway. Do the same here so this file validates the real multi-buyer mode.
process.env.QWEN_AUDIO_AGENT_IDENTITY_MODE = 'browser'
process.env.QWEN_AUDIO_AGENT_AUTH_SECRET = 'sales-avatar-e2e-identity-secret-1234567890'

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}

async function startSalesGateway() {
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
  return {
    application,
    sessions,
    origin: `http://127.0.0.1:${port}`,
  }
}

async function createBuyerClient({ origin, sessionId, instanceId }) {
  const cookie = await bootstrapQwenGatewayIdentity({ gatewayOrigin: origin })
  assert.match(cookie, /^qwen_audio_agent_identity=user_/)

  const events = []
  const waiters = new Set()
  let readyResolve
  let readyReject
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })

  function dispatch(event) {
    events.push(event)
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(event)) continue
      clearTimeout(waiter.timer)
      waiters.delete(waiter)
      waiter.resolve(event)
    }
  }

  function waitForEvent(predicate, timeoutMs = 5_000) {
    const existing = events.find(predicate)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        timer: setTimeout(() => {
          waiters.delete(waiter)
          reject(new Error('Timed out waiting for Qwen Gateway event'))
        }, timeoutMs),
      }
      waiters.add(waiter)
    })
  }

  const wsUrl = new URL('/api/realtime', origin)
  wsUrl.protocol = 'ws:'
  wsUrl.searchParams.set('sessionId', sessionId)

  const client = new GatewayClient({
    url: wsUrl.toString(),
    createSocket: (url, options = {}) => new WebSocket(
      url,
      mergeGatewaySocketOptions(options, cookie),
    ),
    clientType: 'sales-avatar-test',
    clientVersion: '0.6.1',
    clientInstanceId: instanceId,
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
      if (status.state === 'unavailable') {
        readyReject(status.error || new Error('Gateway unavailable'))
      }
    },
    onEvent: dispatch,
  })

  return { client, cookie, events, ready, waitForEvent }
}

async function createTaskAndWait(buyer, text) {
  const created = await buyer.client.request(GatewayClientProtocolEvent.TASK_CREATE, {
    message: { parts: [{ type: 'text', text }] },
  })
  assert.ok(created.task?.id)
  const completed = await buyer.waitForEvent(event => (
    event.type === GatewayTaskEvent.COMPLETED
    && event.task?.id === created.task.id
  ))
  return { created, completed }
}

test('real Qwen Gateway websocket returns sales artifact from our BackendPort', async () => {
  const { application, sessions, origin } = await startSalesGateway()
  const buyer = await createBuyerClient({
    origin,
    sessionId: 'offline-sales-e2e',
    instanceId: 'sales-avatar-test-1',
  })

  try {
    buyer.client.start()
    await Promise.race([buyer.ready, timeout(5_000, 'Gateway Client did not become ready')])
    assert.equal(buyer.client.supports(GatewayClientCapability.TASK_COMMANDS), true)

    const { created, completed: completedEvent } = await createTaskAndWait(
      buyer,
      'We have 45 sales reps and need Salesforce and SSO. Which plan fits us?',
    )

    assert.equal(completedEvent.task.id, created.task.id)
    assert.equal(completedEvent.task.workState, 'completed')
    assert.match(completedEvent.task.result || '', /Enterprise|best fit|recommendation/i)
    assert.equal(completedEvent.task.artifacts?.length, 1)
    const artifact = completedEvent.task.artifacts[0]
    assert.equal(artifact.parts[0].mediaType, SALES_VISUAL_MEDIA_TYPE)
    assert.equal(artifact.parts[0].data.type, 'product_card')
    assert.equal(artifact.parts[0].data.props.id, 'enterprise')

    assert.ok(completedEvent.task.sessionId)
    const knownState = sessions.get(completedEvent.task.sessionId)
    assert.equal(knownState?.teamSize, 45)
    assert.deepEqual(knownState?.requirements?.slice().sort(), ['salesforce', 'sso'])
    assert.ok(buyer.events.some(event => event.type === GatewayTaskEvent.RUNNING))
  } finally {
    buyer.client.stop()
    await application.close()
  }
})

test('two concurrent buyers get distinct Qwen owners and isolated sales state', async () => {
  const { application, sessions, origin } = await startSalesGateway()
  const buyerA = await createBuyerClient({
    origin,
    sessionId: 'buyer-a-session',
    instanceId: 'sales-avatar-buyer-a',
  })
  const buyerB = await createBuyerClient({
    origin,
    sessionId: 'buyer-b-session',
    instanceId: 'sales-avatar-buyer-b',
  })

  try {
    assert.notEqual(buyerA.cookie, buyerB.cookie, 'Qwen must issue a unique owner identity per buyer')
    buyerA.client.start()
    buyerB.client.start()
    await Promise.all([
      Promise.race([buyerA.ready, timeout(5_000, 'Buyer A Gateway Client did not become ready')]),
      Promise.race([buyerB.ready, timeout(5_000, 'Buyer B Gateway Client did not become ready')]),
    ])

    const [taskA, taskB] = await Promise.all([
      createTaskAndWait(
        buyerA,
        'We have 12 sales reps and need advanced analytics. Which plan fits us?',
      ),
      createTaskAndWait(
        buyerB,
        'We have 80 sales reps and require SSO. Which plan fits us?',
      ),
    ])

    assert.equal(taskA.completed.task.artifacts[0].parts[0].data.props.id, 'pro')
    assert.equal(taskB.completed.task.artifacts[0].parts[0].data.props.id, 'enterprise')

    const stateA = sessions.get('buyer-a-session')
    const stateB = sessions.get('buyer-b-session')
    assert.equal(stateA?.teamSize, 12)
    assert.deepEqual(stateA?.requirements, ['advanced analytics'])
    assert.equal(stateB?.teamSize, 80)
    assert.deepEqual(stateB?.requirements, ['sso'])
    assert.equal(stateA?.requirements.includes('sso'), false)
    assert.equal(stateB?.requirements.includes('advanced analytics'), false)
  } finally {
    buyerA.client.stop()
    buyerB.client.stop()
    await application.close()
  }
})
