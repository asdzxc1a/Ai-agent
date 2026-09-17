import { SALES_STAGES } from './sales-state.mjs'

const INTERPRETIVE_LIST_FIELDS = Object.freeze([
  'pains',
  'goals',
  'objections',
])
const CONTROLLER_TEXT_FIELDS = Object.freeze([
  'qualificationStatus',
  'nextStep',
])

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

  // The model may update interpretive/controller state. These fields describe
  // sales strategy, not externally authoritative customer/product truth.
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

  // Deliberately excluded from model authority:
  // - customer/deal facts: teamSize, requirements, contact, currentSolution,
  //   budgetBand, purchaseTimeline
  // - identity/authorization: sessionId, leadId, accountId, consent
  // - commercial/transaction truth: productsShown, caseStudiesShown, pricing,
  //   inventory, discounts, tool authorization, transaction state
  // - timestamps/internal bookkeeping
  // These must come from deterministic extraction, structured tools, or an
  // explicit validated user action before entering server-owned truth.
  return patch
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
  if (!product) return null
  return {
    type: 'product_card',
    props: product,
  }
}

function canonicalPricing(rawVisual, catalog) {
  const productId = requestedProductId(rawVisual)
  if (!productId || !catalog?.get) return null
  const product = catalog.get(productId)
  if (!product) return null
  return {
    type: 'pricing',
    props: { product },
  }
}

function canonicalComparison(rawVisual, catalog) {
  if (!catalog?.getMany) return null
  const props = visualProps(rawVisual)
  const productIds = Array.isArray(props.productIds)
    ? props.productIds
    : Array.isArray(rawVisual?.productIds)
      ? rawVisual.productIds
      : []
  const ids = productIds
    .map(id => cleanText(id, 120))
    .filter(Boolean)
  const products = catalog.getMany(ids, { limit: 4 })
  if (products.length < 2) return null
  return {
    type: 'comparison',
    props: { products },
  }
}

export function canonicalizeSalesVisual(rawVisual, catalog) {
  if (!rawVisual || typeof rawVisual !== 'object' || Array.isArray(rawVisual)) return null
  const type = cleanText(rawVisual.type, 80)
  if (type === 'product_card') return canonicalProductCard(rawVisual, catalog)
  if (type === 'pricing') return canonicalPricing(rawVisual, catalog)
  if (type === 'comparison') return canonicalComparison(rawVisual, catalog)
  // Future visual types need their own structured data source/hydrator before
  // becoming frontend-authoritative. Unknown model-authored visuals are dropped.
  return null
}

export function canonicalizeSalesDecision(raw = {}, { catalog } = {}) {
  const decision = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const confidenceValue = Number(decision.confidence)
  const confidence = Number.isFinite(confidenceValue)
    ? Math.max(0, Math.min(1, confidenceValue))
    : null
  return {
    statePatch: sanitizeSalesStatePatch(decision.statePatch),
    content: cleanText(decision.content, 4_000) || '',
    visual: canonicalizeSalesVisual(decision.visual, catalog),
    confidence,
  }
}
