const OUTLINES = {
  connect: { objective: 'Earn permission to ask one useful question.', moves: ['brief greeting', 'state how you can help', 'ask why they came'], avoid: ['long pitch', 'feature dump'] },
  discovery: { objective: 'Understand pain, desired outcome, and current workflow before recommending.', moves: ['ask one question at a time', 'reflect the pain', 'quantify impact where natural'], avoid: ['premature pricing', 'generic product monologue'] },
  qualification: { objective: 'Learn fit constraints without making the conversation feel like a form.', moves: ['team size', 'timeline', 'requirements', 'decision process'], avoid: ['interrogation', 'asking known facts again'] },
  recommendation: { objective: 'Recommend the smallest solution that fully satisfies known requirements.', moves: ['tie each recommendation to a stated need', 'name tradeoffs', 'show evidence'], avoid: ['invented facts', 'unearned upsell'] },
  objection: { objective: 'Diagnose the objection before answering it.', moves: ['acknowledge', 'clarify the real constraint', 'answer with evidence', 'check resolution'], avoid: ['arguing', 'discounting without authority'] },
  commitment: { objective: 'Convert clear intent into a specific low-friction next step.', moves: ['summarize fit', 'offer one concrete next step', 'ask for confirmation'], avoid: ['pressure', 'multiple competing CTAs'] },
  next_step: { objective: 'Confirm ownership, timing, and what happens next.', moves: ['confirm date/action', 'capture needed details', 'set expectation'], avoid: ['vague follow-up'] }
}

const OBJECTION_HINTS = {
  price: 'Separate price from value: identify budget constraint, quantify outcome, then discuss fit. Never invent a discount.',
  implementation: 'Reduce perceived risk: identify rollout constraint, show implementation path/evidence, offer staged next step.',
  competitor: 'Compare only verifiable dimensions tied to the buyer requirements; do not disparage the competitor.',
  trust: 'Use proof: relevant case study, security documentation, references, or a reversible pilot.'
}

export function selectSalesOutline(state, turn) {
  const text = String(turn ?? '').toLowerCase()
  let stage = state.conversationStage
  let objection = null
  if (/price|cost|expensive|budget|discount/.test(text)) objection = 'price'
  else if (/implement|migration|rollout|deploy|integration time/.test(text)) objection = 'implementation'
  else if (/competitor|versus| vs |compare/.test(text)) objection = 'competitor'
  else if (/trust|security|safe|proof|reference/.test(text)) objection = 'trust'
  if (objection) stage = 'objection'
  if (stage === 'connect' && state.turnCount > 0) stage = 'discovery'
  return { stage, objection, outline: OUTLINES[stage] ?? OUTLINES.discovery, objectionHint: objection ? OBJECTION_HINTS[objection] : null }
}
