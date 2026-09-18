const DEFAULT_PRODUCTS = [
  { id: 'starter', name: 'Starter', priceMonthly: 99, features: ['core analytics', 'email support'], maxSeats: 20, tags: ['small-team', 'low-complexity'] },
  { id: 'pro', name: 'Pro', priceMonthly: 299, features: ['advanced analytics', 'crm integration', 'priority support'], maxSeats: 75, tags: ['growth', 'crm'] },
  { id: 'enterprise', name: 'Enterprise', priceMonthly: null, features: ['sso', 'salesforce', 'advanced analytics', 'security review', 'custom sla'], maxSeats: null, tags: ['enterprise', 'sso', 'salesforce', 'security'] },
]

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return [...text].slice(0, max).join('')
}

function uniqueStrings(values = [], max = 48) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 240)).filter(Boolean))].slice(0, max)
}

function normalizeProduct(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('product must be an object')
  const id = clean(input.id, 120)
  const name = clean(input.name, 240)
  if (!id || !name) throw new TypeError('product requires id and name')

  let priceMonthly = null
  if (input.priceMonthly !== null && input.priceMonthly !== undefined && input.priceMonthly !== '') {
    const price = Number(input.priceMonthly)
    if (!Number.isFinite(price) || price < 0) throw new TypeError(`invalid monthly price for product ${id}`)
    priceMonthly = Math.round((price + Number.EPSILON) * 100) / 100
  }

  let maxSeats = null
  if (input.maxSeats !== null && input.maxSeats !== undefined && input.maxSeats !== '') {
    const seats = Number(input.maxSeats)
    if (!Number.isSafeInteger(seats) || seats <= 0) throw new TypeError(`invalid maxSeats for product ${id}`)
    maxSeats = seats
  }

  return {
    id,
    name,
    priceMonthly,
    features: uniqueStrings(input.features),
    maxSeats,
    tags: uniqueStrings(input.tags),
  }
}

export class ProductCatalog {
  constructor(products = DEFAULT_PRODUCTS) {
    this.products = (Array.isArray(products) ? products : []).map(normalizeProduct)
    const ids = new Set()
    for (const product of this.products) {
      if (ids.has(product.id)) throw new Error(`Duplicate product id: ${product.id}`)
      ids.add(product.id)
    }
  }
  list() { return structuredClone(this.products) }
  get(id) { return structuredClone(this.products.find(product => product.id === String(id || '').trim()) ?? null) }
  getMany(ids = [], { limit = 4 } = {}) {
    const seen = new Set()
    const products = []
    for (const value of Array.isArray(ids) ? ids : []) {
      const id = String(value || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const product = this.products.find(item => item.id === id)
      if (product) products.push(structuredClone(product))
      if (products.length >= limit) break
    }
    return products
  }
  search({ requirements = [], teamSize = null } = {}) {
    const req = requirements.map(value => String(value).toLowerCase())
    return this.products.map(product => {
      const haystack = [...product.features, ...product.tags].join(' ').toLowerCase()
      const requirementScore = req.filter(value => haystack.includes(value)).length
      const seatFit = !teamSize || !product.maxSeats || teamSize <= product.maxSeats ? 1 : -2
      return { product, score: requirementScore * 3 + seatFit }
    }).sort((left, right) => right.score - left.score).map(({ product }) => structuredClone(product))
  }
}
