import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatConfidence,
  formatStage,
  summarizeLearningBundle,
} from '../web/sales-intelligence.js'

test('cockpit summarizes the latest structured sales decision without private reasoning', () => {
  const bundle = {
    trajectory: {
      events: [
        { type: 'realtime.transcript.final', data: { role: 'user', content: 'We already have partners.' } },
        {
          type: 'sales.decision',
          data: {
            deterministicPatch: {
              objections: ['existing supplier'],
              requirements: ['white label'],
            },
            strategy: {
              stage: 'objection',
              objection: 'trust',
              outline: { objective: 'Position Arcana as complementary capacity, not a replacement.' },
            },
            decision: { confidence: 0.86 },
            stateAfter: {
              conversationStage: 'objection',
              objections: ['existing supplier'],
              requirements: ['white label'],
              currentSolution: 'incumbent Monaco partner',
            },
          },
        },
      ],
    },
    rewards: [{ total: 0.71, trainingEligible: true }],
  }

  const summary = summarizeLearningBundle(bundle)
  assert.equal(summary.eventCount, 2)
  assert.equal(summary.stage, 'objection')
  assert.equal(summary.objective, 'Position Arcana as complementary capacity, not a replacement.')
  assert.equal(summary.confidence, 0.86)
  assert.equal(summary.trainingEligible, true)
  assert.equal(summary.rewardTotal, 0.71)
  assert.ok(summary.signals.includes('Objection: Existing Supplier'))
  assert.ok(summary.signals.includes('Need: White Label'))
  assert.ok(summary.signals.includes('Current partner: incumbent Monaco partner'))
})

test('cockpit formatting stays clear with an empty learning bundle', () => {
  const summary = summarizeLearningBundle({})
  assert.equal(summary.stage, 'connect')
  assert.equal(summary.confidence, null)
  assert.deepEqual(summary.signals, [])
  assert.equal(formatStage('next_step'), 'Next Step')
  assert.equal(formatConfidence(0.734), '73%')
  assert.equal(formatConfidence(null), '—')
})
