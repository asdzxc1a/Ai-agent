import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { createAvatarControlServer } from '../src/runtime/avatar-control-server.mjs'

class FakeManager {
  constructor() {
    this.sessions = new Map()
    this.audio = []
    this.text = []
    this.interrupts = []
  }
  async start() {
    const session = {
      id: 'session-1',
      sessionId: 'live-1',
      livekitUrl: 'wss://livekit',
      livekitClientToken: 'token',
      inputSampleRate: 24000,
    }
    this.sessions.set(session.id, session)
    return session
  }
  get(id) { return this.sessions.get(id) ?? null }
  status(id) {
    if (!this.sessions.has(id)) return null
    return {
      id,
      sessionId: 'live-1',
      bridge: { metrics: { audioChunks: 2, spawnThinkingCalls: 1 } },
    }
  }
  sendAudio(id, audio) { this.audio.push({ id, audio }); return true }
  sendText(id, text) { this.text.push({ id, text }); return true }
  interrupt(id) { this.interrupts.push(id); return true }
  async stop(id) { return this.sessions.delete(id) }
  async close() { this.sessions.clear() }
}

test('avatar control server serves browser harness and routes session inputs', async () => {
  const manager = new FakeManager()
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()
  try {
    const html = await fetch(`${origin}/`)
    assert.equal(html.status, 200)
    assert.match(html.headers.get('content-type'), /text\/html/)
    assert.match(await html.text(), /Sales Avatar Test Console/)

    const app = await fetch(`${origin}/app.js`)
    assert.equal(app.status, 200)
    assert.match(await app.text(), /livekit-client/)

    const vendor = await fetch(`${origin}/vendor/livekit-client.esm.mjs`)
    assert.equal(vendor.status, 200)
    assert.match(vendor.headers.get('content-type'), /javascript/)

    const createdResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    assert.equal(createdResponse.status, 201)
    const created = await createdResponse.json()
    assert.equal(created.id, 'session-1')

    const textResponse = await fetch(`${origin}/sessions/session-1/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'show me enterprise' }),
    })
    assert.equal(textResponse.status, 202)
    assert.deepEqual(manager.text, [{ id: 'session-1', text: 'show me enterprise' }])

    const statusResponse = await fetch(`${origin}/sessions/session-1`)
    assert.equal(statusResponse.status, 200)
    const status = await statusResponse.json()
    assert.equal(status.bridge.metrics.spawnThinkingCalls, 1)

    const wsUrl = new URL('/sessions/session-1/audio', origin)
    wsUrl.protocol = 'ws:'
    const ws = new WebSocket(wsUrl)
    await once(ws, 'open')
    ws.send(Buffer.from([1, 2, 3, 4]))
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(manager.audio, [{ id: 'session-1', audio: Buffer.from([1, 2, 3, 4]).toString('base64') }])

    const interruptResponse = await fetch(`${origin}/sessions/session-1/interrupt`, { method: 'POST' })
    assert.equal(interruptResponse.status, 200)
    assert.deepEqual(manager.interrupts, ['session-1'])

    ws.close()
    const stopped = await fetch(`${origin}/sessions/session-1`, { method: 'DELETE' })
    assert.equal(stopped.status, 200)
    assert.equal(manager.sessions.size, 0)
  } finally {
    await control.close()
  }
})
