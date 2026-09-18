const OUTLINES = {
  connect: { objective: 'Earn permission to ask one useful question.', moves: ['brief greeting', 'state how you can help', 'ask why they came'], avoid: ['long pitch', 'feature dump'] },
  discovery: { objective: 'Understand pain, desired outcome, and current workflow before recommending.', moves: ['ask one question at a time', 'reflect the pain', 'quantify impact where natural'], avoid: ['premature pricing', 'generic product monologue'] },
  qualification: { objective: 'Learn fit constraints without making the conversation feel like a form.', moves: ['scope', 'timing', 'requirements', 'decision process'], avoid: ['interrogation', 'asking known facts again'] },
  recommendation: { objective: 'Recommend the smallest solution that fully satisfies known requirements.', moves: ['tie each recommendation to a stated need', 'name tradeoffs', 'show evidence'], avoid: ['invented facts', 'unearned upsell'] },
  objection: { objective: 'Diagnose the objection before answering it.', moves: ['acknowledge', 'clarify the real constraint', 'answer with evidence', 'check resolution'], avoid: ['arguing', 'discounting without authority'] },
  commitment: { objective: 'Convert clear intent into a specific low-friction next step.', moves: ['summarize fit', 'offer one concrete next step', 'ask for confirmation'], avoid: ['pressure', 'multiple competing CTAs'] },
  next_step: { objective: 'Confirm ownership, timing, and what happens next.', moves: ['confirm action', 'capture needed details', 'set expectation'], avoid: ['vague follow-up'] },
}

const OBJECTION_HINTS = {
  existing_supplier: 'Do not try to replace a partner the buyer already trusts. Remove displacement risk, position Arcana as complementary coverage or a specialist/backup for difficult Monaco, European, unusual, overflow, or last-minute briefs, then ask where current coverage becomes hardest.',
  price: 'Separate price from value and scope. Understand the commercial structure and brief before defending price. Never invent a discount or quote.',
  implementation: 'Reduce perceived execution risk: identify the operational constraint, explain only verified process/capability, and offer a low-risk first brief or next step.',
  competitor: 'Compare only verifiable dimensions tied to the buyer requirements; do not disparage the competitor or incumbent supplier.',
  trust: 'Treat discretion and client ownership as core risk. Use only approved proof, clarify white-label/non-circumvention expectations, and suggest a controlled first project where appropriate.',
  no_current_need: 'Do not manufacture urgency. Earn permission to stay available and make the future handoff easy; the best outcome can be the next relevant brief rather than a meeting today.',
  send_materials: 'Treat “send the deck” as ambiguous. Agree without pressure, then ask one short question about what they care about so the follow-up is relevant and earns a concrete next step.',
  availability: 'Never promise a venue, supplier, talent, access, deadline, or last-minute feasibility before verification. Emphasize rapid checking and honest feasibility rather than certainty.',
}

export function selectSalesOutline(state, turn) {
  const text = String(turn ?? '').toLowerCase()
  let stage = state.conversationStage
  let objection = null

  if (/already (?:have|work with|use)|existing (?:partner|supplier|agency)|our (?:partner|supplier|agency)|we have .*partner|we're happy with (?:them|our)/.test(text)) objection = 'existing_supplier'
  else if (/send (?:me |us )?(?:the )?(?:deck|presentation|portfolio|info|information|details)|email (?:me|us)/.test(text)) objection = 'send_materials'
  else if (/nothing (?:right now|at the moment)|no (?:need|demand|brief|project) (?:right now|currently)|not looking (?:right now|currently)/.test(text)) objection = 'no_current_need'
  else if (/guarantee|guaranteed|can you get|can you secure|availability|available tomorrow|venue access|exclusive access/.test(text)) objection = 'availability'
  else if (/price|cost|expensive|budget|discount|commission|margin|fee/.test(text)) objection = 'price'
  else if (/implement|migration|rollout|deploy|integration time|execution risk|last[- ]minute/.test(text)) objection = 'implementation'
  else if (/competitor|versus| vs |compare|another agency/.test(text)) objection = 'competitor'
  else if (/trust|security|safe|proof|reference|confidential|discretion|white[- ]label|circumvent|client ownership/.test(text)) objection = 'trust'

  if (objection) stage = 'objection'
  if (stage === 'connect' && state.turnCount > 0) stage = 'discovery'
  return {
    stage,
    objection,
    outline: OUTLINES[stage] ?? OUTLINES.discovery,
    objectionHint: objection ? OBJECTION_HINTS[objection] : null,
  }
}
