import { EventEmitter } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import { HeyGenAudioSink } from '../src/integrations/heygen-audio-sink.mjs'

class FakeSocket extends EventEmitter {
  constructor(url) {
    super()
    this.url = url
    this.readyState = 0
    this.sent = []
    this.pings = 0
  }
  openAndReady() {
    this.readyState = 1
    this.emit('open')
    this.emit('message', JSON.stringify({ type: 'session.state_updated', state: 'connected' }))
  }
  send(payload) { this.sent.push(payload) }
  ping() { this.pings += 1 }
  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.emit('close')
  }
}

function nextTick() { return new Promise(resolve => setImmediate(resolve)) }

test('HeyGenAudioSink waits for connected state then forwards PCM and interrupt', async () => {
  let socket
  const sink = new HeyGenAudioSink({
    createSocket: url => {
      socket = new FakeSocket(url)
      queueMicrotask(() => socket.openAndReady())
      return socket
    },
    pingIntervalMs: 0,
    keepAliveIntervalMs: 0,
    initialBackoffMs: 1,
  })

  await sink.connect({ wsUrl: 'wss://media.example' })
  assert.equal(sink.writePcm24k('AAAA'), true)
  assert.equal(sink.interrupt(), true)
  assert.deepEqual(socket.sent.map(JSON.parse), [
    { type: 'agent.speak', audio: 'AAAA' },
    { type: 'agent.interrupt' },
  ])
  await sink.close()
})

test('HeyGenAudioSink reconnects and resumes sending without replaying old audio', async () => {
  const sockets = []
  const sink = new HeyGenAudioSink({
    createSocket: url => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      queueMicrotask(() => socket.openAndReady())
      return socket
    },
    pingIntervalMs: 0,
    keepAliveIntervalMs: 0,
    initialBackoffMs: 1,
    maxBackoffMs: 2,
  })

  await sink.connect({ wsUrl: 'wss://media.example' })
  sink.writePcm24k('first')
  sockets[0].close()
  await nextTick()
  assert.equal(await sink.waitUntilReady(100), true)
  assert.ok(sockets.length >= 2)
  sink.writePcm24k('second')
  assert.deepEqual(sockets[0].sent.map(JSON.parse), [{ type: 'agent.speak', audio: 'first' }])
  assert.deepEqual(sockets.at(-1).sent.map(JSON.parse), [{ type: 'agent.speak', audio: 'second' }])
  await sink.close()
})
