import test from 'node:test'
import assert from 'node:assert/strict'
import { OpenAICompatibleSalesReasoner, ProductCatalog, createSalesState } from '../src/index.mjs'

test('OpenAI-compatible reasoner supports DeepSeek/GLM/Qwen-shaped chat endpoints', async () => {
  let captured
  const fakeFetch = async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return { ok: true, async json() { return { choices: [{ message: { content: JSON.stringify({ statePatch: { conversationStage: 'discovery' }, content: 'Ask about current workflow.', visual: null, confidence: 0.9 }) } }] } } } }
  const reasoner = new OpenAICompatibleSalesReasoner({ baseUrl: 'https://example.test/v1', apiKey: 'secret', model: 'cheap-sales-model', fetchImpl: fakeFetch })
  const result = await reasoner.decide({ state: createSalesState({ sessionId: 'x' }), turn: 'hello', strategy: { stage: 'discovery' }, catalog: new ProductCatalog() })
  assert.equal(result.confidence, 0.9); assert.equal(captured.url, 'https://example.test/v1/chat/completions'); assert.equal(captured.body.model, 'cheap-sales-model'); assert.equal(captured.body.response_format.type, 'json_object')
})
