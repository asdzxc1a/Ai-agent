import test from 'node:test'
import assert from 'node:assert/strict'
import { salesVisualMarkup } from '../web/sales-visual.js'

test('product_card renderer shows backend product facts', () => {
  const markup = salesVisualMarkup({
    type: 'product_card',
    props: {
      id: 'enterprise',
      name: 'Enterprise',
      priceMonthly: 299,
      features: ['sso', 'salesforce'],
    },
  })
  assert.match(markup, /Enterprise/)
  assert.match(markup, /\$299\/month/)
  assert.match(markup, /sso/)
  assert.match(markup, /salesforce/)
})

test('product_card renderer treats missing price as custom pricing', () => {
  const markup = salesVisualMarkup({
    type: 'product_card',
    props: { name: 'Enterprise', priceMonthly: null, features: [] },
  })
  assert.match(markup, /Custom pricing/)
})

test('sales visual renderer escapes untrusted backend display strings', () => {
  const markup = salesVisualMarkup({
    type: 'product_card',
    props: {
      name: '<img src=x onerror=alert(1)>',
      priceMonthly: null,
      features: ['<script>alert(1)</script>'],
    },
  })
  assert.doesNotMatch(markup, /<script>|<img/)
  assert.match(markup, /&lt;img/)
  assert.match(markup, /&lt;script&gt;/)
})

test('unknown visual types use an escaped JSON fallback', () => {
  const markup = salesVisualMarkup({
    type: 'comparison',
    props: { headline: '<b>Compare</b>', score: 3 },
  })
  assert.match(markup, /comparison/)
  assert.doesNotMatch(markup, /<b>Compare<\/b>/)
  assert.match(markup, /&lt;b&gt;Compare&lt;\/b&gt;/)
})
