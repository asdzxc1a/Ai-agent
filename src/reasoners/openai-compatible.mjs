export class OpenAICompatibleSalesReasoner {
  constructor({ baseUrl, apiKey, model, fetchImpl = fetch, timeoutMs = 12000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.model = model
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async decide({ state, turn, strategy, catalog, caseStudies, roiAvailable = false, signal }) {
    const timeoutController = new AbortController()
    const timeout = setTimeout(() => {
      timeoutController.abort(new Error(`Sales reasoner timed out after ${this.timeoutMs}ms`))
    }, this.timeoutMs)
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal

    const visualRules = [
      'You may request at most one visual.',
      'Allowed visual requests are ID-only:',
      '{"type":"product_card","productId":"..."}',
      '{"type":"pricing","productId":"..."}',
      '{"type":"comparison","productIds":["...","..."]}',
      '{"type":"case_study","caseStudyId":"..."}',
      roiAvailable ? '{"type":"roi","productId":"..."}' : 'ROI visual is unavailable.',
      'Never put prices, features, metrics, ROI numbers, testimonials, or financial assumptions inside visual props. The server hydrates all such facts.',
    ].join('\n')

    const system = `You are the hidden sales supervisor, not the speaking avatar. Return JSON only.\nUse only structured facts provided. Never invent pricing, discounts, integrations, customer facts, case-study claims, or ROI numbers.\nSales strategy: ${JSON.stringify(strategy)}\n${visualRules}\nReturn {statePatch, content, visual, confidence}. content is factual guidance for the realtime frontend, not a script or chain-of-thought.`

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
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
