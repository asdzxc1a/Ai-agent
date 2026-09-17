import { SALES_STAGES } from './sales-state.mjs'

const INTERPRETIVE_LIST_FIELDS = Object.freeze(['pains', 'goals', 'objections'])
const CONTROLLER_TEXT_FIELDS = Object.freeze(['qualificationStatus', 'nextStep'])

function cleanText(value, max = 1_000) {
  if (value === null) return null
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return [...text].slice(0, max).join('')
}

function stringList(value, { maxItems = 24, maxChars = 240 } = {}) {
  if (!Array.isArray(value)) return undefined
  const seen = new Set()
  const result = []
  for (const item of value) {
    const text = cleanText(item, maxChars)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result.length ? result : undefined
}

export function sanitizeSalesStatePatch(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const patch = {}
  for (const field of INTERPRETIVE_LIST_FIELDS) {
    const values = stringList(raw[field])
    if (values) patch[field] = values
  }
  for (const field of CONTROLLER_TEXT_FIELDS) {
    const value = cleanText(raw[field])
    if (value !== undefined) patch[field] = value
  }
  if (raw.conversationStage !== undefined) {
    const stage = cleanText(raw.conversationStage, 80)
    if (stage && SALES_STAGES.includes(stage)) patch.conversationStage = stage
  }
  return patch
}

function normalizeResources(resources) {
  if (!resources || typeof resources !== 'object') return {}
  // Backwards compatibility: older callers passed ProductCatalog directly.
  if (typeof resources.get === 'function' && !('catalog' in resources)) {
    return { catalog: resources }
  }
  return resources
}

function visualProps(rawVisual) {
  return rawVisual?.props && typeof rawVisual.props === 'object' && !Array.isArray(rawVisual.props)
    ? rawVisual.props
    : {}
}

function requestedProductId(rawVisual) {
  const props = visualProps(rawVisual)
  return cleanText(props.productId ?? props.id ?? rawVisual?.productId, 120)
}

function canonicalProductCard(rawVisual, catalog) {
  const productId = requestedProductId(rawVisual)
  if (!productId || !catalog?.get) return null
  const product = catalog.get(productId)
  return product ? { type: 'product_card', props: product } : null
}

function canonicalPricing(rawVisual, catalog) {
  const productId = requestedProductId(rawVisual)
  if (!productId || !catalog?.get) return null
  const product = catalog.get(productId)
  return product ? { type: 'pricing', props: { product } } : null
}

function canonicalComparison(rawVisual, catalog) {
  if (!catalog?.getMany) return null
  const props = visualProps(rawVisual)
  const productIds = Array.isArray(props.productIds)
    ? props.productIds
    : Array.isArray(rawVisual?.productIds) ? rawVisual.productIds : []
  const ids = productIds.map(id => cleanText(id, 120)).filter(Boolean)
  const products = catalog.getMany(ids, { limit: 4 })
  return products.length >= 2 ? { type: 'comparison', props: { products } } : null
}

function canonicalCaseStudy(rawVisual, caseStudies) {
  if (!caseStudies?.get) return null
  const props = visualProps(rawVisual)
  const caseStudyId = cleanText(props.caseStudyId ?? props.id ?? rawVisual?.caseStudyId, 120)
  if (!caseStudyId) return null
  const caseStudy = caseStudies.get(caseStudyId)
  return caseStudy ? { type: 'case_study', props: { caseStudy } } : null
}

function canonicalRoi(rawVisual, { catalog, roiCalculator, state } = {}) {
  if (!catalog?.get || !roiCalculator?.calculate || !state) return null
  const productId = requestedProductId(rawVisual)
  if (!productId) return null
  const product = catalog.get(productId)
  if (!product) return null
  const estimate = roiCalculator.calculate({ state, product })
  return estimate ? { type: 'roi', props: estimate } : null
}

export function canonicalizeSalesVisual(rawVisual, resources = {}) {
  if (!rawVisual || typeof rawVisual !== 'object' || Array.isArray(rawVisual)) return null
  const normalized = normalizeResources(resources)
  const type = cleanText(rawVisual.type, 80)
  if (type === 'product_card') return canonicalProductCard(rawVisual, normalized.catalog)
  if (type === 'pricing') return canonicalPricing(rawVisual, normalized.catalog)
  if (type === 'comparison') return canonicalComparison(rawVisual, normalized.catalog)
  if (type === 'case_study') return canonicalCaseStudy(rawVisual, normalized.caseStudies)
  if (type === 'roi') return canonicalRoi(rawVisual, normalized)
  return null
}

export function canonicalizeSalesDecision(raw = {}, resources = {}) {
  const decision = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const confidenceValue = Number(decision.confidence)
  const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null
  return {
    statePatch: sanitizeSalesStatePatch(decision.statePatch),
    content: cleanText(decision.content, 4_000) || '',
    visual: canonicalizeSalesVisual(decision.visual, resources),
    confidence,
  }
}
