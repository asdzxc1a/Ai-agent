import test from 'node:test'
import assert from 'node:assert/strict'
import { AvatarSessionManager } from '../src/runtime/avatar-session-manager.mjs'

class FakeBridge {
  constructor(id) { this.id = id; this.audio = []; this.interrupts = 0; this.closed = false }
  async start() {
    return {
      sessionId: `live-${this.id}`,
      livekitUrl: 'wss://livekit.example',
      livekitClientToken: 'token',
      inputSampleRate: 24000,
    }
  }
  sendInputAudio(audio) { this.audio.push(audio); return true }
  interrupt() { this.interrupts += 1; return true }
  async close() { this.closed = true }
}

test('AvatarSessionManager owns bridge lifecycle and audio routing', async () => {
  const bridges = new Map()
  const manager = new AvatarSessionManager({
    createBridge: ({ id }) => {
      const bridge = new FakeBridge(id)
      bridges.set(id, bridge)
      return bridge
    },
  })

  const session = await manager.start({ id: 'local-1' })
  assert.equal(session.id, 'local-1')
  assert.equal(session.inputSampleRate, 24000)
  assert.equal(manager.sendAudio('local-1', 'pcm'), true)
  assert.equal(manager.interrupt('local-1'), true)
  assert.deepEqual(bridges.get('local-1').audio, ['pcm'])
  assert.equal(bridges.get('local-1').interrupts, 1)
  assert.equal(await manager.stop('local-1'), true)
  assert.equal(bridges.get('local-1').closed, true)
  assert.equal(manager.get('local-1'), null)
})
