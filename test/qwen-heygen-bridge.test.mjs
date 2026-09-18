import test from 'node:test'
import assert from 'node:assert/strict'
import { QwenHeyGenBridge } from '../src/integrations/qwen-heygen-bridge.mjs'
import { createSalesVisualArtifact } from '../src/domain/sales-artifacts.mjs'
import { GatewayClientEvent, GatewayServerEvent, GatewayTaskEvent } from 'qwen-audio-agent/realtime-events'
import { GatewayClientProtocolEvent } from 'qwen-audio-agent/gateway-client-protocol'

class FakeGatewayClient {
  constructor(options, order = null) {
    this.options = options
    this.order = order
    this.sent = []
    this.stopped = false
  }
  start() {
    this.order?.push('gateway-start')
    queueMicrotask(() => {
      this.options.onStatus({ state: 'ready' })
      this.options.onEvent({ type: GatewayServerEvent.VOICE_READY, inputSampleRate: 24000 })
    })
  }
  send(event) { this.sent.push(event); return true }
  stop() { this.stopped = true }
  emit(event) { this.options.onEvent(event) }
}

class FakeSink {
  constructor(order = null) { this.order = order; this.writes = []; this.interrupts = 0; this.closed = false }
  async connect(session) { this.order?.push('sink-connect'); this.session = session; return this }
  writePcm24k(audio) { this.writes.push(audio); return true }
  interrupt() { this.interrupts += 1; return true }
  async close() { this.closed = true }
}

test('QwenHeyGenBridge scopes identity, proves voice before HeyGen, tees audio, and exposes metrics', async () => {
  const order = []
  const stopped = []
  const liveAvatarClient = {
    startSession: async () => {
      order.push('avatar-start')
      return {
        sessionId: 'live-1',
        avatarId: 'avatar-1',
        livekitUrl: 'wss://livekit.example',
        livekitClientToken: 'token',
        wsUrl: 'wss://media.example',
      }
    },
    stopSession: async id => stopped.push(id),
  }
  let gatewayClient
  let socketOptions
  const sink = new FakeSink(order)
  const bridge = new QwenHeyGenBridge({
    gatewayOrigin: 'http://127.0.0.1:3000',
    liveAvatarClient,
    gatewaySessionId: 'qwen-session-1',
    identityBootstrap: async () => {
      order.push('identity')
      return 'qwen_audio_agent_identity=user_1.signature'
    },
    clientFactory: options => (gatewayClient = new FakeGatewayClient(options, order)),
    createGatewaySocket: (_url, options) => {
      socketOptions = options
      return { readyState: 1 }
    },
    audioSinkFactory: () => sink,
  })

  const session = await bridge.start({ timeoutMs: 100 })
  assert.equal(session.inputSampleRate, 24000)
  assert.equal(session.gatewaySessionId, 'qwen-session-1')
  assert.deepEqual(order.slice(0, 4), ['identity', 'gateway-start', 'avatar-start', 'sink-connect'])
  assert.ok(gatewayClient.sent.some(event => event.type === GatewayClientEvent.UNMUTE))
  assert.ok(gatewayClient.sent.some(event => event.type === GatewayClientEvent.INPUT_UNMUTE))

  gatewayClient.options.createSocket('ws://example.test', {
    headers: { Authorization: 'Bearer test' },
  })
  assert.equal(socketOptions.headers.Authorization, 'Bearer test')
  assert.equal(socketOptions.headers.Cookie, 'qwen_audio_agent_identity=user_1.signature')

  assert.equal(bridge.sendInputAudio('mic-audio'), true)
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientProtocolEvent.INPUT_AUDIO_APPEND && event.audio === 'mic-audio'
  )))
  assert.equal(bridge.sendText('Which plan fits 45 sales reps with SSO?'), true)
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientEvent.INPUT_MESSAGE && /45 sales reps/.test(event.text)
  )))

  gatewayClient.emit({ type: GatewayServerEvent.RESPONSE_STARTED, responseId: 'response-1' })
  gatewayClient.emit({
    type: GatewayServerEvent.TOOL_CALL,
    callId: 'call-1',
    name: 'spawn_thinking',
    surface: 'frontend',
    status: 'completed',
  })
  const visualArtifact = createSalesVisualArtifact({
    taskId: 'task-1',
    visual: {
      type: 'product_card',
      props: { id: 'enterprise', name: 'Enterprise', priceMonthly: null, features: ['sso', 'salesforce'] },
    },
  })
  gatewayClient.emit({
    type: GatewayTaskEvent.COMPLETED,
    task: {
      id: 'task-1',
      artifacts: [visualArtifact],
    },
  })
  gatewayClient.emit({
    type: GatewayTaskEvent.UPDATED,
    task: { id: 'task-1', artifacts: [visualArtifact] },
  })
  gatewayClient.emit({
    type: GatewayServerEvent.TRANSCRIPT_FINAL,
    role: 'assistant',
    content: 'Enterprise is the fit because SSO is required.',
  })
  gatewayClient.emit({
    type: GatewayServerEvent.AUDIO_DELTA,
    responseId: 'response-1',
    sampleRate: 24000,
    audio: Buffer.from('pcm').toString('base64'),
  })
  assert.equal(sink.writes.length, 1)
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientEvent.PLAYBACK_STARTED && event.responseId === 'response-1'
  )))

  gatewayClient.emit({ type: GatewayServerEvent.AUDIO_DONE, responseId: 'response-1' })
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientEvent.PLAYBACK_ENDED && event.responseId === 'response-1'
  )))

  gatewayClient.emit({ type: GatewayServerEvent.RESPONSE_INTERRUPTED, responseId: 'response-2' })
  assert.equal(sink.interrupts, 1)

  const status = bridge.getStatus()
  assert.equal(status.started, true)
  assert.equal(status.gatewayIdentityScoped, true)
  assert.equal(status.avatarId, 'avatar-1')
  assert.equal(status.metrics.responsesStarted, 1)
  assert.equal(status.metrics.audioChunks, 1)
  assert.equal(status.metrics.audioBytes, 3)
  assert.equal(status.metrics.spawnThinkingCalls, 1)
  assert.equal(status.metrics.toolCalls, 1)
  assert.equal(status.metrics.visualArtifacts, 1)
  assert.equal(status.lastVisual.type, 'product_card')
  assert.equal(status.lastVisual.props.id, 'enterprise')
  assert.equal(status.metrics.assistantTranscriptFinals, 1)
  assert.match(status.metrics.lastAssistantTranscript, /Enterprise/)
  assert.equal(status.metrics.interruptions, 1)

  await bridge.close()
  assert.equal(gatewayClient.stopped, true)
  assert.equal(sink.closed, true)
  assert.deepEqual(stopped, ['live-1'])
})

test('QwenHeyGenBridge rejects non-24k output instead of desynchronizing HeyGen', async () => {
  const errors = []
  const sink = new FakeSink()
  let gatewayClient
  const bridge = new QwenHeyGenBridge({
    gatewayOrigin: 'http://127.0.0.1:3000',
    liveAvatarClient: {
      startSession: async () => ({ sessionId: 'live-2', wsUrl: 'wss://media.example', livekitUrl: 'x', livekitClientToken: 'y' }),
      stopSession: async () => {},
    },
    identityBootstrap: async () => '',
    clientFactory: options => (gatewayClient = new FakeGatewayClient(options)),
    audioSinkFactory: () => sink,
    onError: error => errors.push(error),
  })
  await bridge.start({ timeoutMs: 100 })
  gatewayClient.emit({ type: GatewayServerEvent.AUDIO_DELTA, responseId: 'r', sampleRate: 16000, audio: 'bad' })
  assert.equal(sink.writes.length, 0)
  assert.match(errors[0].message, /24 kHz/)
  assert.equal(bridge.getStatus().metrics.audioChunks, 0)
  await bridge.close()
})

test('QwenHeyGenBridge does not start a paid avatar session when realtime voice cannot become ready', async () => {
  let avatarStarts = 0
  class UnavailableGatewayClient extends FakeGatewayClient {
    start() {
      queueMicrotask(() => this.options.onStatus({
        state: 'unavailable',
        error: new Error('realtime unavailable'),
      }))
    }
  }
  const bridge = new QwenHeyGenBridge({
    gatewayOrigin: 'http://127.0.0.1:3000',
    liveAvatarClient: {
      async startSession() { avatarStarts += 1; throw new Error('should not be called') },
      async stopSession() {},
    },
    identityBootstrap: async () => 'qwen_audio_agent_identity=user_2.signature',
    clientFactory: options => new UnavailableGatewayClient(options),
  })

  await assert.rejects(() => bridge.start({ timeoutMs: 100 }), /realtime unavailable/)
  assert.equal(avatarStarts, 0)
})
