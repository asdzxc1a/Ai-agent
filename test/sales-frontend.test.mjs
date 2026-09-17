import test from 'node:test'
import assert from 'node:assert/strict'
import { SALES_SPAWN_THINKING_DESCRIPTION, liveSalesPreflight } from '../src/runtime/sales-frontend.mjs'

test('sales backend scope requires delegation for commercial decisions', () => {
  for (const term of ['pricing', 'recommendations', 'objections', 'qualification', 'competitor', 'ROI']) {
    assert.match(SALES_SPAWN_THINKING_DESCRIPTION, new RegExp(term, 'i'))
  }
  assert.match(SALES_SPAWN_THINKING_DESCRIPTION, /Do not delegate greetings/i)
  assert.match(SALES_SPAWN_THINKING_DESCRIPTION, /server-owned sales state/i)
})

test('liveSalesPreflight blocks paid test when OpenAI or LiveAvatar credentials are missing', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('OPENAI_API_KEY')))
  assert.ok(result.errors.some(error => error.includes('LIVEAVATAR_API_KEY')))
})

test('liveSalesPreflight accepts minimal transport-only live configuration', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.configuration.reasonerMode, 'mock')
})

test('liveSalesPreflight validates external supervisor configuration separately', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'openai-compatible',
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('SALES_REASONER_BASE_URL')))
  assert.ok(result.errors.some(error => error.includes('SALES_REASONER_API_KEY')))
  assert.ok(result.errors.some(error => error.includes('SALES_REASONER_MODEL')))
})
