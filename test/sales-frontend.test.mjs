import test from 'node:test'
import assert from 'node:assert/strict'
import { SALES_SPAWN_THINKING_DESCRIPTION, liveSalesPreflight } from '../src/runtime/sales-frontend.mjs'

test('sales backend scope requires delegation for commercial decisions', () => {
  for (const term of ['pricing', 'recommendations', 'objections', 'qualification', 'competitor', 'ROI']) {
    assert.match(SALES_SPAWN_THINKING_DESCRIPTION, new RegExp(term, 'i'))
  }
  assert.match(SALES_SPAWN_THINKING_DESCRIPTION, /Do not delegate greetings/i)
  assert.match(SALES_SPAWN_THINKING_DESCRIPTION, /server-owned sales state/i)
  assert.match(SALES_SPAWN_THINKING_DESCRIPTION, /action execution results/i)
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
  assert.equal(result.configuration.identityMode, 'browser')
  assert.equal(result.configuration.actionExecutionMode, 'disabled')
})

test('liveSalesPreflight accepts transport test while clearly flagging demo commercial truth', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
    QWEN_AUDIO_AGENT_IDENTITY_MODE: 'browser',
    QWEN_AUDIO_AGENT_AUTH_SECRET: 'persistent-test-secret-that-is-long-enough',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.configuration.reasonerMode, 'mock')
  assert.equal(result.configuration.identityMode, 'browser')
  assert.equal(result.configuration.actionExecutionMode, 'disabled')
  assert.equal(result.configuration.hasPersistentIdentitySecret, true)
  assert.equal(result.configuration.hasConfiguredProducts, false)
  assert.equal(result.configuration.hasApprovedCaseStudies, false)
  assert.equal(result.configuration.roiAssumptionSet, 'illustrative-default-v1')
  assert.ok(result.warnings.some(warning => /demo product catalog/i.test(warning)))
  assert.ok(result.warnings.some(warning => /no approved case-study/i.test(warning)))
  assert.ok(result.warnings.some(warning => /illustrative-default-v1/i.test(warning)))
})

test('preflight recognizes configured product truth, approved proof, and approved ROI assumptions', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
    QWEN_AUDIO_AGENT_IDENTITY_MODE: 'browser',
    QWEN_AUDIO_AGENT_AUTH_SECRET: 'persistent-test-secret-that-is-long-enough',
    SALES_PRODUCTS_PATH: './products.json',
    SALES_CASE_STUDIES_PATH: './case-studies.json',
    SALES_ROI_ASSUMPTION_SET: 'approved-v1',
  })
  assert.equal(result.ok, true)
  assert.equal(result.configuration.hasConfiguredProducts, true)
  assert.equal(result.configuration.hasApprovedCaseStudies, true)
  assert.equal(result.configuration.roiAssumptionSet, 'approved-v1')
  assert.equal(result.configuration.actionExecutionMode, 'disabled')
  assert.equal(result.warnings.some(warning => /demo product catalog/i.test(warning)), false)
  assert.equal(result.warnings.some(warning => /no approved case-study/i.test(warning)), false)
  assert.equal(result.warnings.some(warning => /illustrative-default-v1/i.test(warning)), false)
})

test('liveSalesPreflight warns when personal identity would limit concurrent buyers', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
    QWEN_AUDIO_AGENT_IDENTITY_MODE: 'personal',
  })
  assert.equal(result.ok, true)
  assert.equal(result.configuration.identityMode, 'personal')
  assert.ok(result.warnings.some(warning => /concurrent website buyers/i.test(warning)))
})

test('liveSalesPreflight warns when browser identity uses a process-local secret', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH: './config/sales-assistant.md',
    QWEN_AUDIO_AGENT_IDENTITY_MODE: 'browser',
  })
  assert.equal(result.ok, true)
  assert.equal(result.configuration.hasPersistentIdentitySecret, false)
  assert.ok(result.warnings.some(warning => /process-local signing secret/i.test(warning)))
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

test('liveSalesPreflight treats sandbox actions as explicit test-only execution', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    SALES_ACTION_EXECUTION_MODE: 'sandbox',
  })
  assert.equal(result.ok, true)
  assert.equal(result.configuration.actionExecutionMode, 'sandbox')
  assert.ok(result.warnings.some(warning => /local fake action tools/i.test(warning)))
})

test('liveSalesPreflight rejects unknown action execution mode', () => {
  const result = liveSalesPreflight({
    QWEN_AUDIO_REALTIME_PROVIDER: 'gpt-live',
    OPENAI_API_KEY: 'openai-test',
    LIVEAVATAR_API_KEY: 'heygen-test',
    SALES_REASONER_MODE: 'mock',
    SALES_ACTION_EXECUTION_MODE: 'production',
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => /Unsupported SALES_ACTION_EXECUTION_MODE: production/.test(error)))
})
