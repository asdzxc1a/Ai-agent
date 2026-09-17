function clean(value) { return String(value ?? '').trim() }
function title(value) {
  return clean(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function latestDecision(bundle) {
  const events = Array.isArray(bundle?.trajectory?.events) ? bundle.trajectory.events : []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'sales.decision') return events[index]
  }
  return null
}

function latestReward(bundle) {
  const rewards = Array.isArray(bundle?.rewards) ? bundle.rewards : []
  return rewards.at(-1) ?? null
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))]
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buyerSignals(data = {}) {
  const patch = data.deterministicPatch || {}
  const state = data.stateAfter || data.observedState || {}
  const signals = []
  const arrays = [
    ['Objection', patch.objections || state.objections],
    ['Need', patch.requirements || state.requirements],
    ['Goal', patch.goals || state.goals],
    ['Pain', patch.pains || state.pains],
  ]
  for (const [label, values] of arrays) {
    for (const value of Array.isArray(values) ? values.slice(-2) : []) {
      signals.push(`${label}: ${title(value)}`)
    }
  }
  if (patch.currentSolution || state.currentSolution) signals.push(`Current partner: ${clean(patch.currentSolution || state.currentSolution)}`)
  if (patch.budgetBand || state.budgetBand) signals.push(`Budget: ${clean(patch.budgetBand || state.budgetBand)}`)
  if (patch.purchaseTimeline || state.purchaseTimeline) signals.push(`Timing: ${clean(patch.purchaseTimeline || state.purchaseTimeline)}`)
  if (patch.teamSize || state.teamSize) signals.push(`Team size: ${patch.teamSize || state.teamSize}`)
  return unique(signals).slice(0, 5)
}

export function summarizeLearningBundle(bundle) {
  const events = Array.isArray(bundle?.trajectory?.events) ? bundle.trajectory.events : []
  const decisionEvent = latestDecision(bundle)
  const data = decisionEvent?.data || {}
  const strategy = data.strategy || {}
  const decision = data.decision || {}
  const reward = latestReward(bundle)
  const confidence = optionalNumber(decision.confidence)
  const rewardTotal = optionalNumber(reward?.total)
  return {
    eventCount: events.length,
    stage: clean(strategy.stage || data.stateAfter?.conversationStage || 'connect'),
    objection: clean(strategy.objection),
    objective: clean(strategy.outline?.objective || 'Listen first. Understand the buyer before making a recommendation.'),
    confidence: confidence == null ? null : Math.max(0, Math.min(1, confidence)),
    signals: buyerSignals(data),
    trainingEligible: reward?.trainingEligible ?? null,
    rewardTotal,
  }
}

export function formatStage(value) {
  return title(value || 'connect')
}

export function formatConfidence(value) {
  const number = optionalNumber(value)
  return number == null ? '—' : `${Math.round(number * 100)}%`
}
