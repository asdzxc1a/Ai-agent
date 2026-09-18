import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapQwenGatewayIdentity,
  cookiePairFromSetCookie,
  mergeGatewaySocketOptions,
  prepareQwenGatewayIdentityEnvironment,
} from '../src/integrations/qwen-identity.mjs'

test('cookiePairFromSetCookie keeps only the signed Qwen identity pair', () => {
  assert.equal(
    cookiePairFromSetCookie('qwen_audio_agent_identity=user_1.signature; Path=/; HttpOnly; SameSite=Strict'),
    'qwen_audio_agent_identity=user_1.signature',
  )
  assert.equal(cookiePairFromSetCookie(''), '')
})

test('bootstrapQwenGatewayIdentity reads Node getSetCookie output', async () => {
  let fetched
  const cookie = await bootstrapQwenGatewayIdentity({
    gatewayOrigin: 'http://127.0.0.1:8765',
    fetchImpl: async url => {
      fetched = String(url)
      return {
        ok: true,
        status: 200,
        headers: {
          getSetCookie: () => [
            'qwen_audio_agent_identity=user_a.sig_a; Path=/; HttpOnly; SameSite=Strict',
          ],
          get: () => null,
        },
      }
    },
  })
  assert.equal(fetched, 'http://127.0.0.1:8765/api/health')
  assert.equal(cookie, 'qwen_audio_agent_identity=user_a.sig_a')
})

test('bootstrapQwenGatewayIdentity falls back to set-cookie header', async () => {
  const cookie = await bootstrapQwenGatewayIdentity({
    gatewayOrigin: 'http://127.0.0.1:8765',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {
        get: name => name === 'set-cookie'
          ? 'qwen_audio_agent_identity=user_b.sig_b; Path=/; HttpOnly'
          : null,
      },
    }),
  })
  assert.equal(cookie, 'qwen_audio_agent_identity=user_b.sig_b')
})

test('mergeGatewaySocketOptions preserves auth and adds Qwen identity cookie', () => {
  const options = mergeGatewaySocketOptions({
    headers: { Authorization: 'Bearer abc' },
    handshakeTimeout: 1000,
  }, 'qwen_audio_agent_identity=user_c.sig_c')
  assert.equal(options.headers.Authorization, 'Bearer abc')
  assert.equal(options.headers.Cookie, 'qwen_audio_agent_identity=user_c.sig_c')
  assert.equal(options.handshakeTimeout, 1000)
})

test('prepareQwenGatewayIdentityEnvironment defaults to browser and generates process secret', () => {
  const env = {}
  const result = prepareQwenGatewayIdentityEnvironment(env, {
    generateSecret: () => 'x'.repeat(64),
  })
  assert.deepEqual(result, {
    mode: 'browser',
    generatedSecret: true,
    hasSecret: true,
  })
  assert.equal(env.QWEN_AUDIO_AGENT_IDENTITY_MODE, 'browser')
  assert.equal(env.QWEN_AUDIO_AGENT_AUTH_SECRET, 'x'.repeat(64))
})

test('prepareQwenGatewayIdentityEnvironment respects explicit personal mode without generating a secret', () => {
  const env = { QWEN_AUDIO_AGENT_IDENTITY_MODE: 'personal' }
  let generated = false
  const result = prepareQwenGatewayIdentityEnvironment(env, {
    generateSecret: () => { generated = true; return 'x'.repeat(64) },
  })
  assert.equal(result.mode, 'personal')
  assert.equal(result.generatedSecret, false)
  assert.equal(generated, false)
  assert.equal(env.QWEN_AUDIO_AGENT_AUTH_SECRET, undefined)
})
