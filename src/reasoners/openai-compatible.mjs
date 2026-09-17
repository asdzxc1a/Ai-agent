export class OpenAICompatibleSalesReasoner {
  constructor({ baseUrl, apiKey, model, fetchImpl = fetch, timeoutMs = 12000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.model = model
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async decide({ state, turn, strategy, catalog }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const system = `You are the hidden sales supervisor, not the speaking avatar. Return JSON only.\nUse only catalog facts provided. Never invent pricing, discounts, integrations, or customer facts.\nSales strategy: ${JSON.stringify(strategy)}\nReturn {statePatch, content, visual, confidence}. content is factual guidance for the realtime frontend, not a script or chain-of-thought.`
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({ model: this.model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: system }, { role: 'user', content: JSON.stringify({ state, turn, catalog: catalog.list() }) } ] })
      })
      if (!response.ok) throw new Error(`Reasoner HTTP ${response.status}: ${await response.text()}`)
      const body = await response.json()
      const raw = body.choices?.[0]?.message?.content
      if (!raw) throw new Error('Reasoner returned no message content')
      return JSON.parse(raw)
    } finally { clearTimeout(timeout) }
  }
}
