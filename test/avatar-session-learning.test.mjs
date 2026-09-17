import test from 'node:test'
import assert from 'node:assert/strict'
import { AvatarSessionManager, SalesOSHarness } from '../src/index.mjs'

test('avatar session keeps a learning-bundle alias after the live renderer stops', async () => {
  const harness = new SalesOSHarness()
  const bridge = {
    async start() { return { sessionId: 'live-1', gatewaySessionId: 'sales-avatar-s1', livekitUrl: 'wss://livekit', livekitClientToken: 'token', inputSampleRate: 24000 } },
    sendInputAudio() { return true },
    sendText() { return true },
    interrupt() { return true },
    async close() {},
  }
  const manager = new AvatarSessionManager({ createBridge: () => bridge, harness })
  await manager.start({ id: 's1' })
  harness.recordRealtimeEvent({ sessionId: 'sales-avatar-s1', event: { type: 'transcript.final', role: 'user', content: 'hello' } })
  await manager.stop('s1')

  const bundle = manager.learning('s1')
  assert.equal(bundle.sessionId, 'sales-avatar-s1')
  assert.equal(bundle.trajectory.events.length, 1)
  const scored = manager.recordReward('s1', { components: { factuality: 1, compliance: 1, strategyFit: 0.8 } })
  assert.equal(scored.reward.eligibleForTraining, true)
})
