export const SALES_REWARD_COMPONENTS = Object.freeze([
  'factuality',
  'compliance',
  'strategyFit',
  'objectionUnderstanding',
  'informationGain',
  'customerProgress',
  'trustProgress',
  'relevance',
  'concision',
  'naturalness',
  'nextStepQuality',
  'businessOutcome',
])

export const SALES_REWARD_HARD_GATES = Object.freeze({ factuality: 0.95, compliance: 0.95 })

function unit(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`reward component must be numeric: ${value}`)
  return Math.min(1, Math.max(0, number))
}

export function createSalesRewardVector({ components = {}, weights = {}, source = 'manual', notes = null, metadata = {} } = {}) {
  const normalized = {}
  for (const key of SALES_REWARD_COMPONENTS) normalized[key] = unit(components[key])

  const missingHardGates = Object.keys(SALES_REWARD_HARD_GATES).filter(key => normalized[key] == null)
  const failedHardGates = Object.entries(SALES_REWARD_HARD_GATES)
    .filter(([key, threshold]) => normalized[key] != null && normalized[key] < threshold)
    .map(([key]) => key)

  let weighted = 0
  let totalWeight = 0
  for (const key of SALES_REWARD_COMPONENTS) {
    if (normalized[key] == null) continue
    const weight = Math.max(0, Number(weights[key] ?? 1) || 0)
    weighted += normalized[key] * weight
    totalWeight += weight
  }

  const gateStatus = failedHardGates.length
    ? 'failed'
    : missingHardGates.length
      ? 'pending'
      : 'passed'

  return {
    schemaVersion: 'salesos.reward.v1',
    source: String(source || 'manual'),
    components: normalized,
    hardGates: {
      thresholds: { ...SALES_REWARD_HARD_GATES },
      status: gateStatus,
      missing: missingHardGates,
      failed: failedHardGates,
    },
    score: gateStatus === 'failed' ? -1 : (totalWeight ? weighted / totalWeight : null),
    eligibleForTraining: gateStatus === 'passed',
    notes: notes == null ? null : String(notes),
    metadata: structuredClone(metadata || {}),
  }
}
