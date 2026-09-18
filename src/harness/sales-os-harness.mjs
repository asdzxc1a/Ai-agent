import { InMemoryExperienceBank } from './experience-bank.mjs'
import { createSalesRewardVector } from './reward.mjs'
import { InMemoryTrajectoryStore } from './trajectory-store.mjs'

function clean(value) { return String(value || '').trim() }
function bounded(value, max = 500) { return [...clean(value)].slice(0, max).join('') }
function clone(value) { return value == null ? value : structuredClone(value) }

function realtimeEnvelope(event) {
  const type = clean(event?.type)
  if (!type) return null
  const lower = type.toLowerCase()
  if (lower.includes('audio.delta')) return null
  if (lower.includes('transcript')) {
    return { role: clean(event.role) || null, content: clean(event.content), turnId: clean(event.turnId) || null, responseId: clean(event.responseId) || null }
  }
  if (lower.includes('tool')) {
    return { name: clean(event.name) || null, callId: clean(event.callId) || null, turnId: clean(event.turnId) || null, taskId: clean(event.taskId) || null }
  }
  if (lower.includes('interrupt') || lower.includes('playback.clear')) {
    return { responseId: clean(event.responseId) || null, turnId: clean(event.turnId) || null }
  }
  if (lower.includes('response.started') || lower.includes('audio.done') || lower.includes('voice.ready')) {
    return { responseId: clean(event.responseId) || null, turnId: clean(event.turnId) || null, sampleRate: Number(event.sampleRate) || null }
  }
  return null
}

function actionReceiptEnvelope(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null
  return {
    provider: bounded(receipt.provider, 120) || 'unknown',
    referenceId: bounded(receipt.referenceId, 240) || null,
    status: bounded(receipt.status, 80) || 'completed',
    summary: bounded(receipt.summary, 500),
    sandbox: receipt.sandbox === true,
  }
}

function actionEnvelope(proposal = {}) {
  return {
    proposalId: bounded(proposal.id, 240) || null,
    taskId: bounded(proposal.taskId, 200) || null,
    kind: bounded(proposal.kind, 80) || null,
    label: bounded(proposal.label, 160) || null,
    status: bounded(proposal.status, 80) || null,
    requiresConfirmation: proposal.requiresConfirmation === true,
    executed: proposal.executed === true,
    createdAt: bounded(proposal.createdAt, 80) || null,
    confirmedAt: bounded(proposal.confirmedAt, 80) || null,
    cancelledAt: bounded(proposal.cancelledAt, 80) || null,
    executedAt: bounded(proposal.executedAt, 80) || null,
    failedAt: bounded(proposal.failedAt, 80) || null,
    receipt: actionReceiptEnvelope(proposal.receipt),
    error: bounded(proposal.error, 500) || null,
  }
}

export class SalesOSHarness {
  constructor({ trajectories = new InMemoryTrajectoryStore(), experiences = new InMemoryExperienceBank() } = {}) {
    this.trajectories = trajectories
    this.experiences = experiences
  }

  #append(event) {
    try { return this.trajectories.append(event) } catch { return null }
  }

  recordBackendDecision({ sessionId, taskId, ownerId, buyerTurn, stateBefore, observedState, deterministicPatch, strategy, decision, stateAfter, artifacts = [] } = {}) {
    return this.#append({
      sessionId,
      taskId,
      source: 'sales-backend',
      type: 'sales.decision',
      data: {
        ownerId: clean(ownerId) || null,
        buyerTurn: clean(buyerTurn),
        stateBefore: clone(stateBefore),
        observedState: clone(observedState),
        deterministicPatch: clone(deterministicPatch),
        strategy: clone(strategy),
        decision: {
          content: clean(decision?.content),
          confidence: Number(decision?.confidence) || null,
          statePatch: clone(decision?.statePatch || {}),
          visualType: clean(decision?.visual?.type) || null,
        },
        stateAfter: clone(stateAfter),
        artifactIds: artifacts.map(artifact => clean(artifact?.artifactId)).filter(Boolean),
      },
    })
  }

  recordBackendFailure({ sessionId, taskId, ownerId, buyerTurn, error } = {}) {
    return this.#append({
      sessionId,
      taskId,
      source: 'sales-backend',
      type: 'sales.decision.failed',
      data: {
        ownerId: clean(ownerId) || null,
        buyerTurn: clean(buyerTurn),
        error: { name: clean(error?.name) || 'Error', code: clean(error?.code) || null, message: clean(error?.message) },
      },
    })
  }

  recordActionLifecycle({ sessionId, type, proposal } = {}) {
    const eventType = clean(type)
    if (!eventType.startsWith('sales.action.')) return null
    const data = actionEnvelope(proposal)
    return this.#append({
      sessionId,
      taskId: data.taskId,
      source: 'action-control',
      type: eventType,
      data,
    })
  }

  recordRealtimeEvent({ sessionId, event } = {}) {
    const data = realtimeEnvelope(event)
    if (!data) return null
    return this.#append({
      sessionId,
      source: 'realtime',
      type: `realtime.${clean(event.type)}`,
      turnId: data.turnId,
      taskId: data.taskId,
      data,
    })
  }

  recordReward(sessionId, input = {}) {
    const reward = createSalesRewardVector(input)
    const event = this.#append({ sessionId, source: 'evaluator', type: 'sales.reward', data: { reward } })
    return { event, reward }
  }

  promoteExperience(input = {}) {
    const experience = this.experiences.add(input)
    this.#append({ sessionId: experience.sessionId, source: 'experience-bank', type: 'sales.experience.promoted', data: { experienceId: experience.id, strategy: experience.strategy, tags: experience.tags } })
    return experience
  }

  exportLearningBundle(sessionId) {
    const id = clean(sessionId)
    const trajectory = this.trajectories.exportSession(id)
    const rewards = trajectory.events.filter(event => event.type === 'sales.reward').map(event => event.data.reward)
    return {
      schemaVersion: 'salesos.learning-bundle.v1',
      sessionId: id,
      trajectory,
      rewards,
      experiences: this.experiences.list({ sessionId: id }),
    }
  }
}
