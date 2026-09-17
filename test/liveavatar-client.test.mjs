import test from 'node:test'
import assert from 'node:assert/strict'
import { LiveAvatarClient } from '../src/integrations/liveavatar-client.mjs'

function response({ status = 200, body = {} } = {}) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  }
}

test('LiveAvatarClient mints, starts, and stops a LITE session', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    if (url.includes('/v1/avatars/public')) {
      return response({ body: { data: { results: [{ id: 'avatar-public', name: 'Public', status: 'ACTIVE', type: 'VIDEO' }] } } })
    }
    if (url.endsWith('/v1/sessions/token')) {
      const payload = JSON.parse(options.body)
      assert.equal(payload.mode, 'LITE')
      assert.equal(payload.avatar_id, 'avatar-public')
      assert.equal(options.headers['X-API-KEY'], 'live-key')
      return response({ body: { data: { session_id: 'session-1', session_token: 'session-token' } } })
    }
    if (url.endsWith('/v1/sessions/start')) {
      assert.equal(options.headers.Authorization, 'Bearer session-token')
      return response({ body: { data: {
        livekit_url: 'wss://livekit.example',
        livekit_client_token: 'livekit-token',
        ws_url: 'wss://media.example',
      } } })
    }
    if (url.endsWith('/v1/sessions/stop')) {
      assert.deepEqual(JSON.parse(options.body), { session_id: 'session-1' })
      return response({ body: { data: {} } })
    }
    throw new Error(`Unexpected URL ${url}`)
  }

  const client = new LiveAvatarClient({ apiKey: 'live-key', fetchImpl })
  const session = await client.startSession()
  assert.deepEqual(session, {
    sessionId: 'session-1',
    avatarId: 'avatar-public',
    livekitUrl: 'wss://livekit.example',
    livekitClientToken: 'livekit-token',
    wsUrl: 'wss://media.example',
  })
  await client.stopSession(session.sessionId)
  assert.equal(requests.length, 4)
})
