import { SALES_STAGES } from './sales-state.mjs'

const LIST_FIELDS = Object.freeze([
  'pains',
  'goals',
  'requirements',
  'objections',
])
const TEXT_FIELDS = Object.freeze([
  'currentSolution',
  'budgetBand',
  'purchaseTimeline',
  'qualificationStatus',
  'nextStep',
])
const CONTACT_FIELDS = Object.freeze(['name', 'role', 'company', 'email'])

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

  for (const field of LIST_FIELDS) {
    const values = stringList(raw[field])
    if (values) patch[field] = values
  }

  for (const field of TEXT_FIELDS) {
    const value = cleanText(raw[field])
    if (value !== undefined) patch[field] = value
  }

  if (raw.teamSize !== undefined) {
    const teamSize = Number(raw.teamSize)
    if (Number.isSafeInteger(teamSize) && teamSize > 0 && teamSize <= 1_000_000) {
      patch.teamSize = teamSize
    }
  }

  if (raw.conversationStage !== undefined) {
    const stage = cleanText(raw.conversationStage, 80)
    if (stage && SALES_STAGES.includes(stage)) patch.conversationStage = stage
  }

  if (raw.contact && typeof raw.contact === 'object' && !Array.isArray(raw.contact)) {
    const contact = {}
    for (const field of CONTACT_FIELDS) {
      const value = cleanText(raw.contact[field], field === 'email' ? 320 : 240)
      if (value !== undefined) contact[field] = value
    }
    if (Object.keys(contact).length) patch.contact = contact
  }

  // Deliberately excluded from model authority:
  // leadId, accountId, consent, productsShown, caseStudiesShown, sessionId,
  // timestamps, tool authorization, pricing, and transaction state.
  return patch
}

function canonicalProductCard(rawVisual, catalog) {
  if (!rawVisual || typeof rawVisual !== 'object' || Array.isArray(rawVisual)) return null
  const props = rawVisual.props && typeof rawVisual.props === 'object' && !Array.isArray(rawVisual.props)
    ? rawVisual.props
    : {}
  const productId = cleanText(props.id ?? rawVisual.productId, 120)
  if (!productId || !catalog?.get) return null
  const product = catalog.get(productId)
  if (!product) return null
  return {
    type: 'product_card',
    props: product,
  }
}

export function canonicalizeSalesVisual(rawVisual, catalog) {
  if (!rawVisual || typeof rawVisual !== 'object' || Array.isArray(rawVisual)) return null
  const type = cleanText(rawVisual.type, 80)
  if (type === 'product_card') return canonicalProductCard(rawVisual, catalog)
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
