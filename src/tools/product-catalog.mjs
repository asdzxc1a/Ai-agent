const DEFAULT_PRODUCTS = [
  { id: 'starter', name: 'Starter', priceMonthly: 99, features: ['core analytics', 'email support'], maxSeats: 20, tags: ['small-team', 'low-complexity'] },
  { id: 'pro', name: 'Pro', priceMonthly: 299, features: ['advanced analytics', 'crm integration', 'priority support'], maxSeats: 75, tags: ['growth', 'crm'] },
  { id: 'enterprise', name: 'Enterprise', priceMonthly: null, features: ['sso', 'salesforce', 'advanced analytics', 'security review', 'custom sla'], maxSeats: null, tags: ['enterprise', 'sso', 'salesforce', 'security'] }
]

export class ProductCatalog {
  constructor(products = DEFAULT_PRODUCTS) { this.products = products }
  list() { return structuredClone(this.products) }
  get(id) { return structuredClone(this.products.find(p => p.id === id) ?? null) }
  search({ requirements = [], teamSize = null } = {}) {
    const req = requirements.map(x => String(x).toLowerCase())
    return this.products.map(product => {
      const haystack = [...product.features, ...product.tags].join(' ').toLowerCase()
      const requirementScore = req.filter(r => haystack.includes(r)).length
      const seatFit = !teamSize || !product.maxSeats || teamSize <= product.maxSeats ? 1 : -2
      return { product, score: requirementScore * 3 + seatFit }
    }).sort((a,b) => b.score - a.score).map(x => structuredClone(x.product))
  }
}
