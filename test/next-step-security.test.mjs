import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalizeSalesVisual } from '../src/index.mjs'

test('next_step keeps only proposal fields and cannot claim execution', () => {
  const visual = canonicalizeSalesVisual({
    type: 'next_step',
    kind: 'book_demo',
    props: {
      label: 'Schedule a technical demo',
      description: 'Review SSO and Salesforce requirements with a specialist.',
      executed: true,
      requiresConfirmation: false,
      calendarUrl: 'javascript:alert(1)',
      meetingTime: 'Tomorrow at 2 PM',
      recipient: 'victim@example.com',
      crmWrite: true,
    },
  })

  assert.equal(visual.type, 'next_step')
  assert.deepEqual(visual.props, {
    kind: 'book_demo',
    label: 'Schedule a technical demo',
    description: 'Review SSO and Salesforce requirements with a specialist.',
    requiresConfirmation: true,
    executed: false,
  })
})

test('next_step rejects unknown action kinds', () => {
  assert.equal(canonicalizeSalesVisual({
    type: 'next_step',
    kind: 'charge_credit_card',
    props: { label: 'Pay now' },
  }), null)
})

test('next_step uses safe server label when the model omits one', () => {
  const visual = canonicalizeSalesVisual({ type: 'next_step', kind: 'human_handoff' })
  assert.equal(visual.props.label, 'Talk to a specialist')
  assert.equal(visual.props.requiresConfirmation, true)
  assert.equal(visual.props.executed, false)
})
