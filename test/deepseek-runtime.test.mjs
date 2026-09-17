import test from 'node:test'
import assert from 'node:assert/strict'
import { OpenAICompatibleSalesReasoner } from '../src/index.mjs'
import { createSalesReasonerFromEnv } from '../src/runtime/build-runtime.mjs'

test('DeepSeek mode boots safely before its API key is configured', async () => {
  const reasoner = createSalesReasonerFromEnv({ SALES_REASONER_MODE: 'deepseek' })
  assert.equal(reasoner.available, false)
  await assert.rejects(() => reasoner.decide(), /SALES_REASONER_API_KEY is required/)
})

test('DeepSeek mode needs only the API key because endpoint and model have safe defaults', () => {
  const reasoner = createSalesReasonerFromEnv({
    SALES_REASONER_MODE: 'deepseek',
    SALES_REASONER_API_KEY: 'test-deepseek-key',
  })
  assert.ok(reasoner instanceof OpenAICompatibleSalesReasoner)
  assert.equal(reasoner.baseUrl, 'https://api.deepseek.com')
  assert.equal(reasoner.model, 'deepseek-flash')
})
