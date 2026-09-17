export const SALES_STAGES = Object.freeze([
  'connect', 'rapport', 'discovery', 'qualification', 'recommendation',
  'demo', 'objection', 'commitment', 'next_step', 'closed'
])

export function createSalesState(seed = {}) {
  return {
    sessionId: seed.sessionId ?? crypto.randomUUID(),
    leadId: seed.leadId ?? null,
    accountId: seed.accountId ?? null,
    contact: {
      name: seed.contact?.name ?? null,
      role: seed.contact?.role ?? null,
      company: seed.contact?.company ?? null,
      email: seed.contact?.email ?? null,
    },
    pains: [...(seed.pains ?? [])],
    goals: [...(seed.goals ?? [])],
    requirements: [...(seed.requirements ?? [])],
    objections: [...(seed.objections ?? [])],
    currentSolution: seed.currentSolution ?? null,
    teamSize: seed.teamSize ?? null,
    budgetBand: seed.budgetBand ?? null,
    purchaseTimeline: seed.purchaseTimeline ?? null,
    productsShown: [...(seed.productsShown ?? [])],
    caseStudiesShown: [...(seed.caseStudiesShown ?? [])],
    qualificationStatus: seed.qualificationStatus ?? 'unknown',
    nextStep: seed.nextStep ?? null,
    consent: seed.consent ?? { crmWrite: false, followUp: false },
    conversationStage: seed.conversationStage ?? 'connect',
    turnCount: seed.turnCount ?? 0,
    updatedAt: new Date().toISOString(),
  }
}

function unique(values) { return [...new Set(values.filter(Boolean))] }

export function applyStatePatch(state, patch = {}, { incrementTurn = true } = {}) {
  if (patch.conversationStage && !SALES_STAGES.includes(patch.conversationStage)) {
    throw new Error(`Invalid sales stage: ${patch.conversationStage}`)
  }
  const next = structuredClone(state)
  if (patch.contact) next.contact = { ...next.contact, ...patch.contact }
  for (const key of ['pains', 'goals', 'requirements', 'objections', 'productsShown', 'caseStudiesShown']) {
    if (patch[key]) next[key] = unique([...next[key], ...patch[key]])
  }
  for (const key of ['leadId','accountId','currentSolution','teamSize','budgetBand','purchaseTimeline','qualificationStatus','nextStep','conversationStage']) {
    if (key in patch) next[key] = patch[key]
  }
  if (patch.consent) next.consent = { ...next.consent, ...patch.consent }
  next.turnCount = state.turnCount + (incrementTurn ? 1 : 0)
  next.updatedAt = new Date().toISOString()
  return next
}
