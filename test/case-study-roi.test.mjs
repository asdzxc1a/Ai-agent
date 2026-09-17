import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CaseStudyCatalog,
  ProductCatalog,
  RoiCalculator,
  canonicalizeSalesDecision,
  createSalesState,
} from '../src/index.mjs'

const approvedCase = {
  id: 'proof-enterprise-1',
  title: 'Approved enterprise rollout',
  customer: 'Reference Customer',
  summary: 'Approved summary from the evidence store.',
  metrics: [{ label: 'Deployment', value: '12 weeks', evidence: 'Approved evidence note' }],
  productIds: ['enterprise'],
  tags: ['sso', 'salesforce'],
  sourceUrl: 'https://example.com/approved-source',
}

test('CaseStudyCatalog stores normalized approved evidence and searches by product/tags', () => {
  const catalog = new CaseStudyCatalog([approvedCase])
  assert.deepEqual(catalog.get('proof-enterprise-1'), approvedCase)
  assert.equal(catalog.search({ productIds: ['enterprise'] })[0].id, 'proof-enterprise-1')
  assert.equal(catalog.search({ tags: ['sso'] })[0].id, 'proof-enterprise-1')
})

test('case-study visual ignores model-authored claims and rehydrates approved record by id', () => {
  const caseStudies = new CaseStudyCatalog([approvedCase])
  const decision = canonicalizeSalesDecision({
    visual: {
      type: 'case_study',
      caseStudyId: 'proof-enterprise-1',
      props: {
        summary: 'Invented summary',
        metrics: [{ label: 'Revenue', value: '+999%' }],
      },
    },
  }, { caseStudies })

  assert.equal(decision.visual.type, 'case_study')
  assert.deepEqual(decision.visual.props.caseStudy, approvedCase)
  assert.doesNotMatch(JSON.stringify(decision.visual), /999%|Invented summary/)
})

test('RoiCalculator derives estimate only from server state, catalog price, and configured assumptions', () => {
  const products = new ProductCatalog()
  const calculator = new RoiCalculator({
    currency: 'USD',
    fullyLoadedHourlyCost: 75,
    hoursSavedPerRepPerMonth: 2,
    adoptionRate: 0.6,
    assumptionSet: 'test-v1',
  })
  const state = createSalesState({ teamSize: 10 })
  const estimate = calculator.calculate({ state, product: products.get('pro') })

  assert.equal(estimate.monthlyHoursSaved, 12)
  assert.equal(estimate.monthlyGrossValue, 900)
  assert.equal(estimate.annualGrossValue, 10800)
  assert.equal(estimate.monthlyProductCost, 299)
  assert.equal(estimate.annualProductCost, 3588)
  assert.equal(estimate.annualNetValue, 7212)
  assert.equal(estimate.paybackMonths, 0.33)
  assert.equal(estimate.assumptionSet, 'test-v1')
  assert.match(estimate.disclaimer, /Illustrative estimate/i)
})

test('ROI visual discards model-authored financial numbers and uses deterministic calculator', () => {
  const catalog = new ProductCatalog()
  const roiCalculator = new RoiCalculator({
    fullyLoadedHourlyCost: 75,
    hoursSavedPerRepPerMonth: 2,
    adoptionRate: 0.6,
  })
  const state = createSalesState({ teamSize: 10 })
  const decision = canonicalizeSalesDecision({
    visual: {
      type: 'roi',
      productId: 'pro',
      props: {
        annualGrossValue: 999999999,
        annualNetValue: 999999999,
        paybackMonths: 0.0001,
      },
    },
  }, { catalog, roiCalculator, state })

  assert.equal(decision.visual.type, 'roi')
  assert.equal(decision.visual.props.annualGrossValue, 10800)
  assert.equal(decision.visual.props.annualNetValue, 7212)
  assert.equal(decision.visual.props.paybackMonths, 0.33)
  assert.doesNotMatch(JSON.stringify(decision.visual), /999999999/)
})

test('ROI request is rejected when authoritative team size is unavailable', () => {
  const catalog = new ProductCatalog()
  const decision = canonicalizeSalesDecision({
    visual: { type: 'roi', productId: 'pro' },
  }, {
    catalog,
    roiCalculator: new RoiCalculator(),
    state: createSalesState(),
  })
  assert.equal(decision.visual, null)
})
