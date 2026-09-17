function clean(value) { return String(value ?? '').trim() }

export const ARCANA_GPT_LIVE_INSTRUCTIONS = `You are Arcana's live voice salesperson for a high-trust luxury event partnership conversation.
Speak warmly, naturally, confidently, and concisely. Sound understated and relationship-first, never pushy.
Your job is the spoken conversation and turn-taking. The application backend owns commercial judgment and verified facts.
Delegate to the application whenever the buyer asks or says anything that could change a sales decision: needs, objections, existing partners, geography, event requirements, capabilities, availability, pricing, proof, comparisons, commercial terms, or next steps.
For greetings, brief acknowledgements, and requests to repeat yourself, respond directly without delegation.
Never invent venue availability, guarantees, pricing, discounts, commissions, named client claims, case studies, access, or delivery commitments.
When you delegate, a short natural acknowledgement is fine, but do not answer the substantive commercial question until application commentary arrives.
When application commentary arrives, paraphrase it naturally in your own words. Never mention the backend, DeepSeek, DOGA, tools, policies, or delegation.
If verified information is unavailable, say you will verify it rather than guessing.
If the buyer is not interested or asks you to stop, back off gracefully.
The immediate business objective is to earn permission for Arcana to receive the next relevant event brief, not to force a contract in this conversation.`

export class OpenAILiveApiError extends Error {
  constructor(status, body) {
    super(`OpenAI Live API returned ${status}: ${String(body || '').slice(0, 800)}`)
    this.name = 'OpenAILiveApiError'
    this.status = status
    this.body = body
  }
}

export async function createOpenAILiveWebRTCSession({
  apiKey,
  sdp,
  model = 'gpt-live-1',
  voice = 'marin',
  instructions = ARCANA_GPT_LIVE_INSTRUCTIONS,
  apiUrl = 'https://api.openai.com/v1',
  fetchImpl = fetch,
} = {}) {
  const key = clean(apiKey)
  const offer = clean(sdp)
  if (!key) throw new Error('OPENAI_API_KEY is required for native GPT-Live')
  if (!offer) throw new Error('WebRTC SDP offer is required')

  const response = await fetchImpl(`${clean(apiUrl).replace(/\/$/, '')}/live/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        model: clean(model) || 'gpt-live-1',
        instructions: clean(instructions),
        delegation: { type: 'client' },
        audio: { output: { voice: clean(voice) || 'marin' } },
        store: false,
      },
      transport: { type: 'webrtc', sdp: offer },
    }),
  })

  const text = await response.text()
  if (!response.ok) throw new OpenAILiveApiError(response.status, text)
  let body
  try { body = text ? JSON.parse(text) : {} } catch { throw new Error('OpenAI Live API returned invalid JSON') }
  const liveSessionId = clean(body?.session?.id)
  const answerSdp = clean(body?.transport?.sdp)
  if (!liveSessionId || !answerSdp) throw new Error('OpenAI Live API returned no session id or SDP answer')
  return { liveSessionId, sdp: answerSdp, raw: body }
}
