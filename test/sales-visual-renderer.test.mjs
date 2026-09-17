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

test('pricing renderer shows canonical product pricing', () => {
  const markup = salesVisualMarkup({
    type: 'pricing',
    props: {
      product: {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 299,
        features: ['advanced analytics'],
      },
    },
  })
  assert.match(markup, /Current pricing/)
  assert.match(markup, /Pro/)
  assert.match(markup, /\$299\/month/)
})

test('comparison renderer shows multiple canonical products', () => {
  const markup = salesVisualMarkup({
    type: 'comparison',
    props: {
      products: [
        { id: 'starter', name: 'Starter', priceMonthly: 99, features: ['email support'] },
        { id: 'pro', name: 'Pro', priceMonthly: 299, features: ['advanced analytics'] },
      ],
    },
  })
  assert.match(markup, /Product comparison/)
  assert.match(markup, /Starter/)
  assert.match(markup, /Pro/)
  assert.match(markup, /\$99\/month/)
  assert.match(markup, /\$299\/month/)
  assert.match(markup, /comparison-grid/)
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
    type: 'roi',
    props: { headline: '<b>ROI</b>', score: 3 },
  })
  assert.match(markup, /roi/)
  assert.doesNotMatch(markup, /<b>ROI<\/b>/)
  assert.match(markup, /&lt;b&gt;ROI&lt;\/b&gt;/)
})
