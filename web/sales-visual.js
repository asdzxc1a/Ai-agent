function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function priceLabel(priceMonthly) {
  if (priceMonthly === null || priceMonthly === undefined || priceMonthly === '') {
    return 'Custom pricing'
  }
  const amount = Number(priceMonthly)
  if (!Number.isFinite(amount)) return escapeHtml(priceMonthly)
  return `$${amount.toLocaleString('en-US')}/month`
}

function featureMarkup(features, limit = 12) {
  const list = Array.isArray(features) ? features.slice(0, limit) : []
  if (!list.length) return ''
  return `<div class="product-features">${list.map(feature => `<span class="feature-pill">${escapeHtml(feature)}</span>`).join('')}</div>`
}

function productSummary(product, { label = '', featureLimit = 12 } = {}) {
  const value = product && typeof product === 'object' && !Array.isArray(product) ? product : {}
  const name = escapeHtml(value.name || value.id || 'Product')
  return [
    label ? `<div class="visual-type">${escapeHtml(label)}</div>` : '',
    `<div class="product-name">${name}</div>`,
    `<div class="product-price">${priceLabel(value.priceMonthly)}</div>`,
    featureMarkup(value.features, featureLimit),
  ].join('')
}

export function salesVisualMarkup(visual) {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    return '<div class="visual-empty">Waiting for a backend product/recommendation artifact…</div>'
  }

  const type = String(visual.type || 'visual')
  const props = visual.props && typeof visual.props === 'object' && !Array.isArray(visual.props)
    ? visual.props
    : {}

  if (type === 'product_card') {
    return productSummary(props, { label: 'Recommended product' })
  }

  if (type === 'pricing') {
    return productSummary(props.product, { label: 'Current pricing', featureLimit: 6 })
  }

  if (type === 'comparison') {
    const products = Array.isArray(props.products) ? props.products.slice(0, 4) : []
    if (products.length >= 2) {
      return [
        '<div class="visual-type">Product comparison</div>',
        '<div class="comparison-grid">',
        ...products.map(product => `<div class="comparison-item">${productSummary(product, { featureLimit: 6 })}</div>`),
        '</div>',
      ].join('')
    }
  }

  return [
    `<div class="visual-type">${escapeHtml(type.replaceAll('_', ' '))}</div>`,
    `<div class="visual-json">${escapeHtml(safeJson(props))}</div>`,
  ].join('')
}

export function renderSalesVisual(element, visual) {
  if (!element) return false
  element.classList.toggle('visual-empty', !visual)
  element.innerHTML = salesVisualMarkup(visual)
  return true
}
