import { EventEmitter } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import { NativeGptLiveBridge } from '../src/integrations/native-gpt-live-bridge.mjs'

class FakeSocket extends EventEmitter {
  static OPEN = 1
  static instances = []
  constructor(url, options) {
    super()
    this.url = url
    this.options = options
    this.readyState = 0
    this.sent = []
    FakeSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN
      this.emit('open')
    })
  }
  send(value) { this.sent.push(JSON.parse(String(value))) }
  close() { this.readyState = 3; this.emit('close') }
}

function fakeResponse(body, status = 201) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body },
    async text() { return JSON.stringify(body) },
  }
}

test('native GPT-Live creates WebRTC session and routes client delegation through SalesOS', async () => {
  FakeSocket.instances = []
  const fetchCalls = []
  const backendCalls = []
  const realtimeEvents = []
  const bridge = new NativeGptLiveBridge({
    backend: {
      async submit(work) {
        backendCalls.push(work)
        return { content: 'Position us as a complementary Monaco resource and ask where current coverage becomes difficult.', artifacts: [] }
      },
    },
    harness: {
      recordRealtimeEvent(input) { realtimeEvents.push(input) },
    },
    openaiApiKey: 'openai-test-key',
    salesSessionId: 'sales-live-test',
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options, body: JSON.parse(options.body) })
      return fakeResponse({
        session: { id: 'live_test_123' },
        transport: { type: 'webrtc', sdp: 'answer-sdp' },
      })
    },
    WebSocketImpl: FakeSocket,
  })

  const started = await bridge.start({ sdp: 'offer-sdp\r\n', timeoutMs: 1000 })
  assert.equal(started.answerSdp, 'answer-sdp')
  assert.equal(started.sessionId, 'live_test_123')
  assert.equal(started.gatewaySessionId, 'sales-live-test')
  assert.equal(started.voiceMode, 'native-gpt-live')

  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].url, 'https://api.openai.com/v1/live/sessions')
  assert.equal(fetchCalls[0].body.session.model, 'gpt-live-1')
  assert.equal(fetchCalls[0].body.session.delegation.type, 'client')
  assert.deepEqual(fetchCalls[0].body.session.client.data_channel.allowed_client_events, [])
  assert.equal(fetchCalls[0].body.transport.sdp, 'offer-sdp\r\n')
  assert.equal(fetchCalls[0].options.headers.authorization, 'Bearer openai-test-key')

  const socket = FakeSocket.instances[0]
  assert.match(socket.url, /\/v1\/live\/sessions\/live_test_123\/attach$/)
  assert.equal(socket.options.headers.Authorization, 'Bearer openai-test-key')

  socket.emit('message', JSON.stringify({
    type: 'session.input_transcript.delta',
    delta: 'We already have partners in Monaco.',
    start_ms: 0,
    end_ms: 1000,
  }))
  socket.emit('message', JSON.stringify({
    type: 'session.delegation.created',
    delegation: { id: 'dlg_1', target: 'client', type: 'delegation' },
    offset_ms: 1000,
  }))

  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(backendCalls.length, 1)
  assert.equal(backendCalls[0].sessionId, 'sales-live-test')
  assert.equal(backendCalls[0].objective, 'We already have partners in Monaco.')
  assert.ok(socket.sent.some(event => event.type === 'session.thinking.append' && event.delegation_id === 'dlg_1'))
  assert.ok(socket.sent.some(event => event.type === 'session.commentary.append' && event.delegation_id === 'dlg_1'))
  assert.ok(realtimeEvents.some(item => item.event.role === 'user' && item.event.content === 'We already have partners in Monaco.'))

  socket.emit('message', JSON.stringify({
    type: 'session.output_transcript.delta',
    delta: "I wouldn't suggest replacing anyone you're happy with.",
    start_ms: 1000,
    end_ms: 1800,
  }))
  socket.emit('message', JSON.stringify({
    type: 'session.delegation.created',
    delegation: { id: 'dlg_2', target: 'client', type: 'delegation' },
    offset_ms: 2000,
  }))
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.ok(realtimeEvents.some(item => item.event.role === 'assistant' && /wouldn't suggest replacing/.test(item.event.content)))

  const status = bridge.getStatus()
  assert.equal(status.metrics.delegations, 2)
  assert.equal(status.metrics.lastUserTranscript, 'We already have partners in Monaco.')
  assert.match(status.metrics.lastAssistantTranscript, /wouldn't suggest replacing/)
  await bridge.close()
})
