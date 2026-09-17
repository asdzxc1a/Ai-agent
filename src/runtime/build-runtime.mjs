import {
  InMemorySalesSessionStore,
  MockSalesReasoner,
  OpenAICompatibleSalesReasoner,
  ProductCatalog,
  SalesBackendAdapter,
  SalesOSHarness,
} from '../index.mjs'

function required(env, key) {
  const value = String(env[key] || '').trim()
  if (!value) throw new Error(`${key} is required for SALES_REASONER_MODE=openai-compatible`)
  return value
}

export function createSalesReasonerFromEnv(env = process.env) {
  const mode = String(env.SALES_REASONER_MODE || 'mock').trim().toLowerCase()
  if (mode === 'mock') return new MockSalesReasoner()
  if (mode !== 'openai-compatible') {
    throw new Error(`Unsupported SALES_REASONER_MODE: ${mode}`)
  }

  return new OpenAICompatibleSalesReasoner({
    baseUrl: required(env, 'SALES_REASONER_BASE_URL'),
    apiKey: required(env, 'SALES_REASONER_API_KEY'),
    model: required(env, 'SALES_REASONER_MODEL'),
    timeoutMs: Number(env.SALES_REASONER_TIMEOUT_MS || 12000),
  })
}

export function createSalesBackendFromEnv(env = process.env) {
  const sessions = new InMemorySalesSessionStore()
  const catalog = new ProductCatalog()
  const reasoner = createSalesReasonerFromEnv(env)
  const harness = new SalesOSHarness()
  const backend = new SalesBackendAdapter({ reasoner, sessions, catalog, harness })
  return { backend, sessions, catalog, reasoner, harness }
}
