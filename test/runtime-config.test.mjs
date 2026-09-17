import test from 'node:test'
import assert from 'node:assert/strict'
import { MockSalesReasoner, OpenAICompatibleSalesReasoner } from '../src/index.mjs'
import { createSalesReasonerFromEnv } from '../src/runtime/build-runtime.mjs'

test('runtime defaults to the free deterministic mock reasoner', () => {
  assert.ok(createSalesReasonerFromEnv({}) instanceof MockSalesReasoner)
})

test('runtime creates an OpenAI-compatible supervisor only with explicit configuration', () => {
  const reasoner = createSalesReasonerFromEnv({
    SALES_REASONER_MODE: 'openai-compatible',
    SALES_REASONER_BASE_URL: 'https://reasoner.example/v1',
    SALES_REASONER_API_KEY: 'test-key',
    SALES_REASONER_MODEL: 'test-model',
    SALES_REASONER_TIMEOUT_MS: '9000',
  })
  assert.ok(reasoner instanceof OpenAICompatibleSalesReasoner)
  assert.equal(reasoner.model, 'test-model')
  assert.equal(reasoner.timeoutMs, 9000)
})

test('remote reasoner configuration fails closed when a credential is absent', () => {
  assert.throws(() => createSalesReasonerFromEnv({
    SALES_REASONER_MODE: 'openai-compatible',
    SALES_REASONER_BASE_URL: 'https://reasoner.example/v1',
    SALES_REASONER_MODEL: 'test-model',
  }), /SALES_REASONER_API_KEY is required/)
})
