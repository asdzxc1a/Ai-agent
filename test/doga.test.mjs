import test from 'node:test'
import assert from 'node:assert/strict'
import { createSalesState, selectSalesOutline } from '../src/index.mjs'

test('DOGA routes a price objection to objection handling', () => {
  const state = createSalesState({ sessionId: 's', conversationStage: 'recommendation' })
  const selected = selectSalesOutline(state, 'That sounds expensive. Can you discount it?')
  assert.equal(selected.stage, 'objection')
  assert.equal(selected.objection, 'price')
  assert.match(selected.objectionHint, /Never invent a discount/i)
})

test('DOGA handles an existing concierge supplier as a non-displacement objection', () => {
  const state = createSalesState({ sessionId: 'dubai', conversationStage: 'discovery' })
  const selected = selectSalesOutline(state, "We already have two partners in Monaco and we're happy with them.")
  assert.equal(selected.stage, 'objection')
  assert.equal(selected.objection, 'existing_supplier')
  assert.match(selected.objectionHint, /Do not try to replace/i)
  assert.match(selected.objectionHint, /complementary coverage|specialist\/backup/i)
})

test('DOGA refuses to imply guaranteed access without verification', () => {
  const state = createSalesState({ sessionId: 'dubai-2', conversationStage: 'recommendation' })
  const selected = selectSalesOutline(state, 'Can you guarantee venue access in Monaco tomorrow?')
  assert.equal(selected.objection, 'availability')
  assert.match(selected.objectionHint, /Never promise/i)
  assert.match(selected.objectionHint, /verification/i)
})
