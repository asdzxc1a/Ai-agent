function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeJson(value) {
  try { return JSON.stringify(value, null, 2) } catch { return String(value ?? '') }
}

function priceLabel(priceMonthly) {
  if (priceMonthly === null || priceMonthly === undefined || priceMonthly === '') return 'Custom pricing'
  const amount = Number(priceMonthly)
  if (!Number.isFinite(amount)) return escapeHtml(priceMonthly)
  return `$${amount.toLocaleString('en-US')}/month`
}

function moneyLabel(value, currency = 'USD') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${escapeHtml(currency)} ${amount.toLocaleString('en-US')}`
  }
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

function caseStudyMarkup(caseStudy) {
  const value = caseStudy && typeof caseStudy === 'object' && !Array.isArray(caseStudy) ? caseStudy : {}
  const metrics = Array.isArray(value.metrics) ? value.metrics.slice(0, 8) : []
  return [
    '<div class="visual-type">Approved case study</div>',
    `<div class="product-name">${escapeHtml(value.title || 'Case study')}</div>`,
    value.customer ? `<div class="product-price">${escapeHtml(value.customer)}</div>` : '',
    `<div class="visual-copy">${escapeHtml(value.summary || '')}</div>`,
    metrics.length ? `<div class="metric-list">${metrics.map(metric => `<div class="metric-row"><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span>${metric.evidence ? `<small>${escapeHtml(metric.evidence)}</small>` : ''}</div>`).join('')}</div>` : '',
    value.sourceUrl ? `<div class="visual-source">Source: ${escapeHtml(value.sourceUrl)}</div>` : '',
  ].join('')
}

function roiMarkup(props) {
  const currency = String(props.currency || 'USD')
  const product = props.product || {}
  const assumptions = Array.isArray(props.assumptions) ? props.assumptions.slice(0, 8) : []
  return [
    '<div class="visual-type">Illustrative ROI estimate</div>',
    `<div class="product-name">${escapeHtml(product.name || product.id || 'Product')}</div>`,
    `<div class="roi-grid"><div><strong>${moneyLabel(props.annualGrossValue, currency)}</strong><span>annual gross value</span></div><div><strong>${props.annualNetValue == null ? 'Pricing required' : moneyLabel(props.annualNetValue, currency)}</strong><span>annual net value</span></div><div><strong>${escapeHtml(props.monthlyHoursSaved ?? '—')}</strong><span>hours saved / month</span></div><div><strong>${props.paybackMonths == null ? '—' : `${escapeHtml(props.paybackMonths)} mo`}</strong><span>illustrative payback</span></div></div>`,
    `<div class="visual-copy">Team size: ${escapeHtml(props.teamSize ?? '—')}. ${escapeHtml(props.disclaimer || '')}</div>`,
    assumptions.length ? `<div class="visual-json">Assumptions: ${escapeHtml(assumptions.map(item => `${item.key}=${item.value} ${item.unit}`).join(' · '))}</div>` : '',
  ].join('')
}

export function salesVisualMarkup(visual) {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    return '<div class="visual-empty">Commercial evidence appears here only when SalesOS selects verified proof for the conversation.</div>'
  }

  const type = String(visual.type || 'visual')
  const props = visual.props && typeof visual.props === 'object' && !Array.isArray(visual.props) ? visual.props : {}

  if (type === 'product_card') return productSummary(props, { label: 'Recommended fit' })
  if (type === 'pricing') return productSummary(props.product, { label: 'Verified pricing', featureLimit: 6 })
  if (type === 'comparison') {
    const products = Array.isArray(props.products) ? props.products.slice(0, 4) : []
    if (products.length >= 2) {
      return ['<div class="visual-type">Verified comparison</div>','<div class="comparison-grid">',...products.map(product => `<div class="comparison-item">${productSummary(product, { featureLimit: 6 })}</div>`),'</div>'].join('')
    }
  }
  if (type === 'case_study') return caseStudyMarkup(props.caseStudy)
  if (type === 'roi') return roiMarkup(props)

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
