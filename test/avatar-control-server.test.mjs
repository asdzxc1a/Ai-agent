import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { createAvatarControlServer } from '../src/runtime/avatar-control-server.mjs'

class FakeManager {
  constructor() { this.sessions = new Map(); this.audio = []; this.interrupts = [] }
  async start() {
    const session = { id: 'session-1', livekitUrl: 'wss://livekit', livekitClientToken: 'token', inputSampleRate: 24000 }
    this.sessions.set(session.id, session)
    return session
  }
  get(id) { return this.sessions.get(id) ?? null }
  sendAudio(id, audio) { this.audio.push({ id, audio }); return true }
  interrupt(id) { this.interrupts.push(id); return true }
  async stop(id) { return this.sessions.delete(id) }
  async close() { this.sessions.clear() }
}

test('avatar control server starts sessions and streams binary PCM over websocket', async () => {
  const manager = new FakeManager()
  const control = createAvatarControlServer({ manager, port: 0 })
  const { origin } = await control.start()
  try {
    const createdResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    assert.equal(createdResponse.status, 201)
    const created = await createdResponse.json()
    assert.equal(created.id, 'session-1')

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
  } finally {
    await control.close()
  }
})
