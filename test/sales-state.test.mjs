import test from 'node:test'
import assert from 'node:assert/strict'
import { applyStatePatch, createSalesState } from '../src/index.mjs'

test('server-owned sales state merges facts without duplicates', () => {
  const state = createSalesState({ sessionId: 's1', requirements: ['sso'] })
  const next = applyStatePatch(state, { requirements: ['sso', 'salesforce'], teamSize: 45, conversationStage: 'qualification' })
  assert.deepEqual(next.requirements, ['sso', 'salesforce'])
  assert.equal(next.teamSize, 45)
  assert.equal(next.conversationStage, 'qualification')
  assert.equal(next.turnCount, 1)
})
