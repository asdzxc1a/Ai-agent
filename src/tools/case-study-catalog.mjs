function clean(value, max = 2_000) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return [...text].slice(0, max).join('')
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 240)).filter(Boolean))]
}

function normalizeMetric(metric) {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) return null
  const label = clean(metric.label, 160)
  const value = clean(metric.value, 160)
  if (!label || !value) return null
  return {
    label,
    value,
    ...(clean(metric.evidence, 500) ? { evidence: clean(metric.evidence, 500) } : {}),
  }
}

function normalizeCaseStudy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('case study must be an object')
  }
  const id = clean(input.id, 120)
  const title = clean(input.title, 240)
  const customer = clean(input.customer, 240)
  const summary = clean(input.summary, 1_500)
  const sourceUrl = clean(input.sourceUrl, 1_000)
  if (!id || !title || !summary || !sourceUrl) {
    throw new TypeError('case study requires id, title, summary, and sourceUrl')
  }
  return {
    id,
    title,
    customer: customer || null,
    summary,
    metrics: (Array.isArray(input.metrics) ? input.metrics : []).map(normalizeMetric).filter(Boolean).slice(0, 12),
    productIds: unique(input.productIds).slice(0, 12),
    tags: unique(input.tags).slice(0, 24),
    sourceUrl,
  }
}

export class CaseStudyCatalog {
  constructor(items = []) {
    this.items = (Array.isArray(items) ? items : []).map(normalizeCaseStudy)
    const ids = new Set()
    for (const item of this.items) {
      if (ids.has(item.id)) throw new Error(`Duplicate case study id: ${item.id}`)
      ids.add(item.id)
    }
  }

  list() { return structuredClone(this.items) }

  get(id) {
    const key = clean(id, 120)
    return structuredClone(this.items.find(item => item.id === key) ?? null)
  }

  search({ productIds = [], tags = [], limit = 5 } = {}) {
    const products = new Set(unique(productIds).map(value => value.toLowerCase()))
    const wantedTags = new Set(unique(tags).map(value => value.toLowerCase()))
    return this.items
      .map(item => {
        const productScore = item.productIds.filter(value => products.has(value.toLowerCase())).length * 3
        const tagScore = item.tags.filter(value => wantedTags.has(value.toLowerCase())).length
        return { item, score: productScore + tagScore }
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 5)))
      .map(({ item }) => structuredClone(item))
  }
}
