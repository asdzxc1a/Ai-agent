import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesOSHarness } from '../src/harness/sales-os-harness.mjs'
import { createSalesRewardVector } from '../src/harness/reward.mjs'

test('reward hard gates block training eligibility before factuality and compliance pass', () => {
  const failed = createSalesRewardVector({ components: { factuality: 0.8, compliance: 1, strategyFit: 1 } })
  assert.equal(failed.hardGates.status, 'failed')
  assert.equal(failed.eligibleForTraining, false)
  assert.equal(failed.score, -1)

  const passed = createSalesRewardVector({ components: { factuality: 1, compliance: 1, strategyFit: 0.8 } })
  assert.equal(passed.hardGates.status, 'passed')
  assert.equal(passed.eligibleForTraining, true)
})

test('harness exports backend, realtime, reward and promoted experience as one learning bundle', () => {
  const harness = new SalesOSHarness()
  harness.recordBackendDecision({
    sessionId: 's1', taskId: 't1', ownerId: 'buyer-1', buyerTurn: 'We already have a Monaco partner.',
    stateBefore: { conversationStage: 'discovery' }, observedState: { conversationStage: 'objection' },
    deterministicPatch: { objections: ['existing supplier'] },
    strategy: { stage: 'objection', objection: 'existing supplier', outline: { objective: 'diagnose' } },
    decision: { content: 'Position as additive capacity.', confidence: 0.9, statePatch: { conversationStage: 'objection' } },
    stateAfter: { conversationStage: 'objection' }, artifacts: [],
  })
  harness.recordRealtimeEvent({ sessionId: 's1', event: { type: 'transcript.final', role: 'assistant', content: 'I would not ask you to replace anyone.' } })
  harness.recordRealtimeEvent({ sessionId: 's1', event: { type: 'audio.delta', audio: 'do-not-store' } })
  const { reward } = harness.recordReward('s1', { components: { factuality: 1, compliance: 1, strategyFit: 0.9 } })
  harness.promoteExperience({ sessionId: 's1', strategy: 'position_as_additional_capacity', state: { objection: 'existing supplier' }, outcome: { progressed: true }, reward, tags: ['objection'] })

  const bundle = harness.exportLearningBundle('s1')
  assert.equal(bundle.schemaVersion, 'salesos.learning-bundle.v1')
  assert.equal(bundle.trajectory.events.some(event => event.type === 'sales.decision'), true)
  assert.equal(bundle.trajectory.events.some(event => event.type.includes('audio.delta')), false)
  assert.equal(bundle.rewards.length, 1)
  assert.equal(bundle.experiences.length, 1)
})
