import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CaseStudyCatalog,
  InMemoryActionProposalStore,
  InMemorySalesSessionStore,
  MockSalesReasoner,
  OpenAICompatibleSalesReasoner,
  ProductCatalog,
  RoiCalculator,
  SalesBackendAdapter,
  SalesOSHarness,
} from '../index.mjs'

function required(env, key) {
  const value = String(env[key] || '').trim()
  if (!value) throw new Error(`${key} is required for SALES_REASONER_MODE=openai-compatible`)
  return value
}

function optionalNumber(env, key, fallback) {
  const raw = String(env[key] ?? '').trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`${key} must be numeric`)
  return value
}

function loadArraySource(env, { jsonKey, pathKey, label }) {
  const inline = String(env[jsonKey] || '').trim()
  const filePath = String(env[pathKey] || '').trim()
  if (inline && filePath) throw new Error(`Set only one of ${jsonKey} or ${pathKey}`)
  if (!inline && !filePath) return null
  const raw = inline || readFileSync(resolve(filePath), 'utf8')
  let parsed
  try { parsed = JSON.parse(raw) } catch (error) { throw new Error(`Invalid ${label} JSON: ${error.message}`) }
  if (!Array.isArray(parsed)) throw new Error(`${label} JSON must be an array`)
  return parsed
}

export function loadProductsFromEnv(env = process.env) {
  return loadArraySource(env, { jsonKey: 'SALES_PRODUCTS_JSON', pathKey: 'SALES_PRODUCTS_PATH', label: 'product catalog' })
}

export function loadCaseStudiesFromEnv(env = process.env) {
  return loadArraySource(env, { jsonKey: 'SALES_CASE_STUDIES_JSON', pathKey: 'SALES_CASE_STUDIES_PATH', label: 'case-study' }) || []
}

export function createSalesReasonerFromEnv(env = process.env) {
  const mode = String(env.SALES_REASONER_MODE || 'mock').trim().toLowerCase()
  if (mode === 'mock') return new MockSalesReasoner()
  if (mode !== 'openai-compatible') throw new Error(`Unsupported SALES_REASONER_MODE: ${mode}`)
  return new OpenAICompatibleSalesReasoner({
    baseUrl: required(env, 'SALES_REASONER_BASE_URL'),
    apiKey: required(env, 'SALES_REASONER_API_KEY'),
    model: required(env, 'SALES_REASONER_MODEL'),
    timeoutMs: Number(env.SALES_REASONER_TIMEOUT_MS || 12000),
  })
}

export function createSalesBackendFromEnv(env = process.env) {
  const sessions = new InMemorySalesSessionStore()
  const configuredProducts = loadProductsFromEnv(env)
  const catalog = configuredProducts ? new ProductCatalog(configuredProducts) : new ProductCatalog()
  const catalogMode = configuredProducts ? 'configured' : 'demo'
  const caseStudies = new CaseStudyCatalog(loadCaseStudiesFromEnv(env))
  const roiCalculator = new RoiCalculator({
    currency: env.SALES_ROI_CURRENCY || 'USD',
    fullyLoadedHourlyCost: optionalNumber(env, 'SALES_ROI_HOURLY_COST', 75),
    hoursSavedPerRepPerMonth: optionalNumber(env, 'SALES_ROI_HOURS_SAVED_PER_REP_MONTH', 2),
    adoptionRate: optionalNumber(env, 'SALES_ROI_ADOPTION_RATE', 0.6),
    assumptionSet: env.SALES_ROI_ASSUMPTION_SET || 'illustrative-default-v1',
  })
  const reasoner = createSalesReasonerFromEnv(env)
  const harness = new SalesOSHarness()
  const actionProposals = new InMemoryActionProposalStore()
  const backend = new SalesBackendAdapter({
    reasoner,
    sessions,
    catalog,
    caseStudies,
    roiCalculator,
    actionProposals,
    harness,
  })
  return {
    backend,
    sessions,
    catalog,
    catalogMode,
    caseStudies,
    roiCalculator,
    actionProposals,
    reasoner,
    harness,
  }
}
