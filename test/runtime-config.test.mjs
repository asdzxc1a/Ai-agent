import test from 'node:test'
import assert from 'node:assert/strict'
import { MockSalesReasoner, OpenAICompatibleSalesReasoner } from '../src/index.mjs'
import {
  createSalesBackendFromEnv,
  createSalesReasonerFromEnv,
  loadCaseStudiesFromEnv,
} from '../src/runtime/build-runtime.mjs'

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

test('approved case studies can be loaded from explicit inline JSON only', () => {
  const items = loadCaseStudiesFromEnv({
    SALES_CASE_STUDIES_JSON: JSON.stringify([{
      id: 'proof-1',
      title: 'Approved proof',
      summary: 'Approved summary',
      sourceUrl: 'https://example.com/proof',
    }]),
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'proof-1')
})

test('case-study configuration rejects ambiguous or non-array sources', () => {
  assert.throws(() => loadCaseStudiesFromEnv({
    SALES_CASE_STUDIES_JSON: '[]',
    SALES_CASE_STUDIES_PATH: './proof.json',
  }), /only one/i)
  assert.throws(() => loadCaseStudiesFromEnv({
    SALES_CASE_STUDIES_JSON: '{"id":"not-an-array"}',
  }), /must be an array/i)
})

test('runtime exposes explicit ROI assumptions and keeps case studies empty by default', () => {
  const runtime = createSalesBackendFromEnv({
    SALES_REASONER_MODE: 'mock',
    SALES_ROI_CURRENCY: 'EUR',
    SALES_ROI_HOURLY_COST: '80',
    SALES_ROI_HOURS_SAVED_PER_REP_MONTH: '3',
    SALES_ROI_ADOPTION_RATE: '0.5',
    SALES_ROI_ASSUMPTION_SET: 'approved-eu-v1',
  })
  assert.equal(runtime.caseStudies.list().length, 0)
  assert.equal(runtime.roiCalculator.currency, 'EUR')
  assert.equal(runtime.roiCalculator.fullyLoadedHourlyCost, 80)
  assert.equal(runtime.roiCalculator.hoursSavedPerRepPerMonth, 3)
  assert.equal(runtime.roiCalculator.adoptionRate, 0.5)
  assert.equal(runtime.roiCalculator.assumptionSet, 'approved-eu-v1')
})
