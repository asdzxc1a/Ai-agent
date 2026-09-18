export class MockSalesReasoner {
  async decide({ state, turn, strategy, catalog, caseStudies, roiAvailable = false }) {
    const text = turn.toLowerCase()
    const patch = { conversationStage: strategy.stage }
    const products = catalog.search({ requirements: state.requirements, teamSize: state.teamSize })

    const wantsComparison = /\b(compare|comparison|versus|vs\.?|difference between)\b/.test(text)
    const wantsPricing = /\b(price|pricing|cost|costs|how much|expensive)\b/.test(text)
    const wantsRoi = /\b(roi|return on investment|business case|payback|savings|value estimate)\b/.test(text)
    const wantsCaseStudy = /\b(case study|customer story|customer proof|reference customer|example customer)\b/.test(text)
    const wantsNextStep = /\b(next step|book|meeting|demo|human|specialist|trial|follow[- ]?up|proposal)\b/.test(text)
    const wantsRecommendation = ['recommendation','objection'].includes(strategy.stage)
      || /recommend|which plan|what plan|best fit/.test(text)

    let visual = null
    let content = `Continue ${strategy.stage}. ${strategy.outline.objective}`

    if (wantsComparison && products.length >= 2) {
      const chosen = products.slice(0, 2)
      visual = { type: 'comparison', productIds: chosen.map(product => product.id) }
      content = `Compare ${chosen.map(product => product.name).join(' and ')} using the buyer's stated requirements and only catalog-backed facts.`
    } else if (wantsPricing && products[0]) {
      visual = { type: 'pricing', productId: products[0].id }
      content = `Use the structured pricing for ${products[0].name}. Do not invent discounts or alternate prices.`
    } else if (wantsRoi && roiAvailable && products[0]) {
      visual = { type: 'roi', productId: products[0].id }
      content = `Present the deterministic ROI estimate for ${products[0].name} as illustrative, and state that configured assumptions—not model judgment—produced the numbers.`
    } else if (wantsCaseStudy && caseStudies?.search && products[0]) {
      const matches = caseStudies.search({ productIds: [products[0].id], tags: state.requirements, limit: 1 })
      if (matches[0]) {
        visual = { type: 'case_study', caseStudyId: matches[0].id }
        content = `Use only the structured case-study record ${matches[0].id}; do not add metrics or claims that are not in that record.`
      } else {
        content = 'No approved matching case study is loaded. Say that honestly rather than inventing customer proof.'
      }
    } else if (wantsNextStep) {
      const kind = /\btrial\b/.test(text)
        ? 'start_trial'
        : /\b(human|specialist)\b/.test(text)
          ? 'human_handoff'
          : /follow[- ]?up/.test(text)
            ? 'send_followup'
            : /\bproposal\b/.test(text)
              ? 'review_proposal'
              : 'book_demo'
      visual = { type: 'next_step', kind }
      patch.nextStep = kind
      content = 'Offer the proposed next step, but make clear that no external action occurs until the buyer explicitly confirms it.'
    } else if (wantsRecommendation && products[0]) {
      visual = { type: 'product_card', productId: products[0].id }
      content = `The current best fit is ${products[0].name}. Explain the recommendation using the buyer's stated requirements, not generic upselling.`
    }

    return { statePatch: patch, content, visual, confidence: 0.8, debug: { strategy } }
  }
}
