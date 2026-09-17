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

export function salesVisualMarkup(visual) {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    return '<div class="visual-empty">Waiting for a backend product/recommendation artifact…</div>'
  }

  const type = String(visual.type || 'visual')
  const props = visual.props && typeof visual.props === 'object' && !Array.isArray(visual.props)
    ? visual.props
    : {}

  if (type === 'product_card') {
    const name = escapeHtml(props.name || props.id || 'Product')
    const price = priceLabel(props.priceMonthly)
    const features = Array.isArray(props.features) ? props.features.slice(0, 12) : []
    const featureMarkup = features.length
      ? `<div class="product-features">${features.map(feature => `<span class="feature-pill">${escapeHtml(feature)}</span>`).join('')}</div>`
      : ''
    return [
      '<div class="visual-type">Recommended product</div>',
      `<div class="product-name">${name}</div>`,
      `<div class="product-price">${price}</div>`,
      featureMarkup,
    ].join('')
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
