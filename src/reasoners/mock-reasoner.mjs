export class MockSalesReasoner {
  async decide({ state, turn, strategy, catalog }) {
    const text = turn.toLowerCase()
    const patch = { conversationStage: strategy.stage }
    const products = catalog.search({
      requirements: state.requirements,
      teamSize: state.teamSize,
    })

    const wantsComparison = /\b(compare|comparison|versus|vs\.?|difference between)\b/.test(text)
    const wantsPricing = /\b(price|pricing|cost|costs|how much|expensive)\b/.test(text)
    const wantsRecommendation = ['recommendation','objection'].includes(strategy.stage)
      || /recommend|which plan|what plan|best fit/.test(text)

    let visual = null
    let content = `Continue ${strategy.stage}. ${strategy.outline.objective}`

    if (wantsComparison && products.length >= 2) {
      const chosen = products.slice(0, 2)
      visual = {
        type: 'comparison',
        productIds: chosen.map(product => product.id),
      }
      content = `Compare ${chosen.map(product => product.name).join(' and ')} using the buyer's stated requirements and only catalog-backed facts.`
    } else if (wantsPricing && products[0]) {
      visual = {
        type: 'pricing',
        productId: products[0].id,
      }
      content = `Use the structured pricing for ${products[0].name}. Do not invent discounts or alternate prices.`
    } else if (wantsRecommendation && products[0]) {
      visual = {
        type: 'product_card',
        productId: products[0].id,
      }
      content = `The current best fit is ${products[0].name}. Explain the recommendation using the buyer's stated requirements, not generic upselling.`
    }

    return {
      statePatch: patch,
      content,
      visual,
      confidence: 0.8,
      debug: { strategy },
    }
  }
}
