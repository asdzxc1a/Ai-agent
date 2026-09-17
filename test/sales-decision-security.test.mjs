import test from 'node:test'
import assert from 'node:assert/strict'
import {
  InMemorySalesSessionStore,
  ProductCatalog,
  SalesBackendAdapter,
} from '../src/index.mjs'

test('model cannot overwrite protected sales state or invent product-card facts', async () => {
  const sessions = new InMemorySalesSessionStore()
  const catalog = new ProductCatalog()
  const reasoner = {
    async decide() {
      return {
        statePatch: {
          leadId: 'invented-lead',
          accountId: 'invented-account',
          consent: { crmWrite: true, followUp: true },
          sessionId: 'attacker-session',
          teamSize: 999,
          requirements: ['SAML'],
          conversationStage: 'recommendation',
        },
        content: 'Recommend Enterprise.',
        visual: {
          type: 'product_card',
          props: {
            id: 'enterprise',
            name: 'Fake Enterprise',
            priceMonthly: 1,
            features: ['made-up unlimited discount'],
          },
        },
        confidence: 4.2,
      }
    },
  }
  const backend = new SalesBackendAdapter({ reasoner, sessions, catalog })

  const result = await backend.submit({
    taskId: 'secure-1',
    ownerId: 'lead-secure',
    sessionId: 'sales-session-secure',
    instruction: 'We have 45 sales reps and require Salesforce and SSO. Which plan fits?',
  })

  const state = sessions.get('sales-session-secure')
  assert.equal(state.teamSize, 45, 'explicit buyer fact must override model proposal')
  assert.equal(state.leadId, null)
  assert.equal(state.accountId, null)
  assert.deepEqual(state.consent, { crmWrite: false, followUp: false })
  assert.ok(state.requirements.includes('salesforce'))
  assert.ok(state.requirements.includes('sso'))
  assert.ok(state.requirements.includes('SAML'))
  assert.deepEqual(state.productsShown, ['enterprise'])

  const visual = result.artifacts[0].parts[0].data
  const canonical = catalog.get('enterprise')
  assert.equal(visual.type, 'product_card')
  assert.deepEqual(visual.props, canonical)
  assert.notEqual(visual.props.name, 'Fake Enterprise')
  assert.equal(visual.props.priceMonthly, null)
  assert.doesNotMatch(visual.props.features.join(' '), /discount/i)
})

test('unknown model-authored visual types are dropped until a structured hydrator exists', async () => {
  const backend = new SalesBackendAdapter({
    sessions: new InMemorySalesSessionStore(),
    catalog: new ProductCatalog(),
    reasoner: {
      async decide() {
        return {
          statePatch: {},
          content: 'Here is an ROI estimate.',
          visual: { type: 'roi', props: { annualSavings: 999999999 } },
          confidence: 0.7,
        }
      },
    },
  })

  const result = await backend.submit({
    taskId: 'secure-2',
    ownerId: 'lead-secure-2',
    instruction: 'Show me ROI.',
  })
  assert.deepEqual(result.artifacts, [])
})
