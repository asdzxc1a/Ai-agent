export class MockSalesReasoner {
  async decide({ state, turn, strategy, catalog }) {
    const text = turn.toLowerCase()
    const patch = { conversationStage: strategy.stage }
    if (/\b(\d{1,4})\s*(people|employees|reps|users|seats|agents)\b/.test(text)) {
      const match = text.match(/\b(\d{1,4})\s*(people|employees|reps|users|seats|agents)\b/)
      patch.teamSize = Number(match[1])
    }
    const requirements = []
    if (text.includes('salesforce')) requirements.push('salesforce')
    if (text.includes('sso')) requirements.push('sso')
    if (text.includes('analytics')) requirements.push('advanced analytics')
    if (requirements.length) patch.requirements = requirements
    const products = catalog.search({ requirements: [...state.requirements, ...requirements], teamSize: patch.teamSize ?? state.teamSize })
    const shouldRecommend = ['recommendation','objection'].includes(strategy.stage) || /recommend|which plan|what plan|best fit/.test(text)
    const visual = shouldRecommend && products[0] ? { type: 'product_card', props: products[0] } : null
    return {
      statePatch: patch,
      content: shouldRecommend && products[0] ? `The current best fit is ${products[0].name}. The recommendation must be explained using the buyer's stated requirements, not generic upselling.` : `Continue ${strategy.stage}. ${strategy.outline.objective}`,
      visual,
      confidence: 0.8,
      debug: { strategy }
    }
  }
}
