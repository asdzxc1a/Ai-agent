import test from 'node:test'
import assert from 'node:assert/strict'
import { QwenHeyGenBridge } from '../src/integrations/qwen-heygen-bridge.mjs'
import { GatewayClientEvent, GatewayServerEvent } from 'qwen-audio-agent/realtime-events'
import { GatewayClientProtocolEvent } from 'qwen-audio-agent/gateway-client-protocol'

class FakeGatewayClient {
  constructor(options) {
    this.options = options
    this.sent = []
    this.stopped = false
  }
  start() {
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
  constructor() { this.writes = []; this.interrupts = 0; this.closed = false }
  async connect(session) { this.session = session; return this }
  writePcm24k(audio) { this.writes.push(audio); return true }
  interrupt() { this.interrupts += 1; return true }
  async close() { this.closed = true }
}

test('QwenHeyGenBridge tees Qwen audio to HeyGen and sends playback receipts', async () => {
  const stopped = []
  const liveAvatarClient = {
    startSession: async () => ({
      sessionId: 'live-1',
      livekitUrl: 'wss://livekit.example',
      livekitClientToken: 'token',
      wsUrl: 'wss://media.example',
    }),
    stopSession: async id => stopped.push(id),
  }
  let gatewayClient
  const sink = new FakeSink()
  const bridge = new QwenHeyGenBridge({
    gatewayOrigin: 'http://127.0.0.1:3000',
    liveAvatarClient,
    gatewaySessionId: 'qwen-session-1',
    clientFactory: options => (gatewayClient = new FakeGatewayClient(options)),
    audioSinkFactory: () => sink,
  })

  const session = await bridge.start({ timeoutMs: 100 })
  assert.equal(session.inputSampleRate, 24000)
  assert.equal(session.gatewaySessionId, 'qwen-session-1')
  assert.ok(gatewayClient.sent.some(event => event.type === GatewayClientEvent.UNMUTE))
  assert.ok(gatewayClient.sent.some(event => event.type === GatewayClientEvent.INPUT_UNMUTE))

  assert.equal(bridge.sendInputAudio('mic-audio'), true)
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientProtocolEvent.INPUT_AUDIO_APPEND && event.audio === 'mic-audio'
  )))

  gatewayClient.emit({
    type: GatewayServerEvent.AUDIO_DELTA,
    responseId: 'response-1',
    sampleRate: 24000,
    audio: 'assistant-audio',
  })
  assert.deepEqual(sink.writes, ['assistant-audio'])
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientEvent.PLAYBACK_STARTED && event.responseId === 'response-1'
  )))

  gatewayClient.emit({ type: GatewayServerEvent.AUDIO_DONE, responseId: 'response-1' })
  assert.ok(gatewayClient.sent.some(event => (
    event.type === GatewayClientEvent.PLAYBACK_ENDED && event.responseId === 'response-1'
  )))

  gatewayClient.emit({ type: GatewayServerEvent.RESPONSE_INTERRUPTED, responseId: 'response-2' })
  assert.equal(sink.interrupts, 1)

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
    clientFactory: options => (gatewayClient = new FakeGatewayClient(options)),
    audioSinkFactory: () => sink,
    onError: error => errors.push(error),
  })
  await bridge.start({ timeoutMs: 100 })
  gatewayClient.emit({ type: GatewayServerEvent.AUDIO_DELTA, responseId: 'r', sampleRate: 16000, audio: 'bad' })
  assert.equal(sink.writes.length, 0)
  assert.match(errors[0].message, /24 kHz/)
  await bridge.close()
})
