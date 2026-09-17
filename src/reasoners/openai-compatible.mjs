export class OpenAICompatibleSalesReasoner {
  constructor({ baseUrl, apiKey, model, fetchImpl = fetch, timeoutMs = 12000, businessContext = '' }) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.model = model
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.businessContext = String(businessContext || '').trim()
  }

  async decide({ state, turn, backendInstruction = '', strategy, catalog, caseStudies, roiAvailable = false, signal }) {
    const timeoutController = new AbortController()
    const timeout = setTimeout(() => {
      timeoutController.abort(new Error(`Sales reasoner timed out after ${this.timeoutMs}ms`))
    }, this.timeoutMs)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal

    const visualRules = [
      'You may request at most one visual.',
      'Allowed visual requests are:',
      '{"type":"product_card","productId":"..."}',
      '{"type":"pricing","productId":"..."}',
      '{"type":"comparison","productIds":["...","..."]}',
      '{"type":"case_study","caseStudyId":"..."}',
      roiAvailable ? '{"type":"roi","productId":"..."}' : 'ROI visual is unavailable.',
      '{"type":"next_step","kind":"book_demo|human_handoff|start_trial|send_followup|review_proposal","props":{"label":"optional","description":"optional"}}',
      'next_step is proposal-only. Never include calendar slots, URLs, recipients, CRM writes, discounts, order data, or claim an action already happened.',
      'Never put prices, features, metrics, ROI numbers, testimonials, or financial assumptions inside visual props. The server hydrates all such facts.',
    ].join('\n')

    const system = [
      'You are the hidden sales supervisor, not the speaking voice. Return JSON only.',
      'Use only operator-approved context and structured facts provided.',
      'Never invent pricing, discounts, venue availability, guaranteed access, supplier availability, client names, celebrity or royal involvement, deadlines, integrations, customer facts, case-study claims, or ROI numbers.',
      this.businessContext ? `Operator-approved business context: ${this.businessContext}` : '',
      `Sales strategy: ${JSON.stringify(strategy)}`,
      visualRules,
      'Return {statePatch, content, visual, confidence}.',
      'content must be concise, factual, speakable guidance that a live voice model can naturally paraphrase. It is not a script and must not expose chain-of-thought.',
    ].filter(Boolean).join('\n')

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        signal: requestSignal,
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: JSON.stringify({
                state,
                turn,
                recentConversationContext: String(backendInstruction || '').slice(0, 9000),
                catalog: catalog.list(),
                approvedCaseStudies: caseStudies?.list?.() || [],
              }),
            },
          ],
        }),
      })
      if (!response.ok) throw new Error(`Reasoner HTTP ${response.status}: ${await response.text()}`)
      const body = await response.json()
      const raw = body.choices?.[0]?.message?.content
      if (!raw) throw new Error('Reasoner returned no message content')
      return JSON.parse(raw)
    } finally {
      clearTimeout(timeout)
    }
  }
}
