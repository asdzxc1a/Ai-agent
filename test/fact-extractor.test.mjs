import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDeterministicSalesFacts } from '../src/index.mjs'

for (const [text, expected] of [
  ['We have 45 sales reps.', 45],
  ['There are 80 employees.', 80],
  ['Our team is 12 agents.', 12],
  ['We need this for 60 seats.', 60],
]) {
  test(`extracts team size from: ${text}`, () => {
    assert.equal(extractDeterministicSalesFacts(text).teamSize, expected)
  })
}

test('extracts explicit high-confidence product requirements', () => {
  const patch = extractDeterministicSalesFacts(
    'We require Salesforce, SSO, and advanced analytics.',
  )
  assert.deepEqual(
    patch.requirements.sort(),
    ['advanced analytics', 'salesforce', 'sso'],
  )
})
