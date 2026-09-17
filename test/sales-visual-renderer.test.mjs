import test from 'node:test'
import assert from 'node:assert/strict'
import { salesVisualMarkup } from '../web/sales-visual.js'

test('product_card renderer shows backend product facts', () => {
  const markup = salesVisualMarkup({
    type: 'product_card',
    props: { id: 'enterprise', name: 'Enterprise', priceMonthly: 299, features: ['sso', 'salesforce'] },
  })
  assert.match(markup, /Enterprise/)
  assert.match(markup, /\$299\/month/)
  assert.match(markup, /sso/)
  assert.match(markup, /salesforce/)
})

test('product_card renderer treats missing price as custom pricing', () => {
  const markup = salesVisualMarkup({ type: 'product_card', props: { name: 'Enterprise', priceMonthly: null, features: [] } })
  assert.match(markup, /Custom pricing/)
})

test('pricing renderer shows canonical product pricing', () => {
  const markup = salesVisualMarkup({
    type: 'pricing',
    props: { product: { id: 'pro', name: 'Pro', priceMonthly: 299, features: ['advanced analytics'] } },
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

test('case-study renderer shows approved summary, metrics, evidence, and source as escaped text', () => {
  const markup = salesVisualMarkup({
    type: 'case_study',
    props: {
      caseStudy: {
        title: 'Enterprise rollout',
        customer: 'Reference Customer',
        summary: 'Approved summary.',
        metrics: [{ label: 'Deployment', value: '12 weeks', evidence: 'Approved note' }],
        sourceUrl: 'https://example.com/proof?x=<unsafe>',
      },
    },
  })
  assert.match(markup, /Approved case study/)
  assert.match(markup, /Enterprise rollout/)
  assert.match(markup, /12 weeks/)
  assert.match(markup, /Approved note/)
  assert.match(markup, /Source:/)
  assert.match(markup, /&lt;unsafe&gt;/)
  assert.doesNotMatch(markup, /href=/)
})

test('ROI renderer labels estimate and exposes assumptions/disclaimer', () => {
  const markup = salesVisualMarkup({
    type: 'roi',
    props: {
      product: { id: 'pro', name: 'Pro' },
      currency: 'USD',
      teamSize: 10,
      monthlyHoursSaved: 12,
      annualGrossValue: 10800,
      annualNetValue: 7212,
      paybackMonths: 0.33,
      assumptions: [{ key: 'adoptionRate', value: 0.6, unit: 'ratio' }],
      disclaimer: 'Illustrative estimate using configured assumptions; not a guarantee.',
    },
  })
  assert.match(markup, /Illustrative ROI estimate/)
  assert.match(markup, /\$10,800/)
  assert.match(markup, /\$7,212/)
  assert.match(markup, /0\.33 mo/)
  assert.match(markup, /adoptionRate=0\.6 ratio/)
  assert.match(markup, /not a guarantee/i)
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
    type: 'next_step',
    props: { headline: '<b>Book a demo</b>', score: 3 },
  })
  assert.match(markup, /next step/)
  assert.doesNotMatch(markup, /<b>Book a demo<\/b>/)
  assert.match(markup, /&lt;b&gt;Book a demo&lt;\/b&gt;/)
})
