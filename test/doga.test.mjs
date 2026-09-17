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
