import WebSocket from 'ws'
import { salesVisualFromArtifact } from '../domain/sales-artifacts.mjs'

function clean(value, max = 8_000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function sidebandUrl(baseUrl, sessionId) {
  const url = new URL(baseUrl.replace(/\/$/, '') + `/live/sessions/${encodeURIComponent(sessionId)}/attach`)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  return url.toString()
}

function liveInstructions() {
  return [
    'You are the live voice of Arcana, a high-trust luxury event sales agent.',
    'Sound warm, elegant, concise, energetic and relationship-first. Never sound like a call-center script.',
    'Your job is conversational timing, listening, natural acknowledgements and faithful delivery of verified SalesOS guidance.',
    'Delegate to the client application BEFORE answering any turn that involves sales strategy, buyer needs, objections, pricing, venue or supplier claims, availability, capabilities, proof, recommendations, negotiation, commitments, next steps, or any factual business claim that could matter commercially.',
    'You may answer only greetings, thanks, very short social acknowledgements, and requests to repeat what you literally just said without delegation.',
    'Never invent venue availability, access, client names, celebrity or royal involvement, pricing, discounts, deadlines, guarantees, case studies or supplier facts.',
    'When SalesOS returns commentary for a delegation, communicate it naturally and faithfully. Do not add unsupported claims.',
    'If SalesOS cannot verify something, say that it needs to be confirmed rather than guessing.',
    'Keep most spoken turns short. Ask one useful question at a time. If the buyer interrupts, stop and listen.',
  ].join(' ')
}

export class NativeGptLiveBridge {
  constructor({
    backend,
    harness = null,
    openaiApiKey,
    openaiBaseUrl = 'https://api.openai.com/v1',
    model = 'gpt-live-1',
    voice = 'marin',
    salesSessionId,
    fetchImpl = fetch,
    WebSocketImpl = WebSocket,
    log = () => {},
    onError = () => {},
  } = {}) {
    if (!backend) throw new TypeError('backend is required')
    if (!salesSessionId) throw new TypeError('salesSessionId is required')
    this.backend = backend
    this.harness = harness
    this.openaiApiKey = clean(openaiApiKey, 4_000)
    this.openaiBaseUrl = String(openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
    this.model = clean(model, 120) || 'gpt-live-1'
    this.voice = clean(voice, 120) || 'marin'
    this.salesSessionId = salesSessionId
    this.fetchImpl = fetchImpl
    this.WebSocketImpl = WebSocketImpl
    this.log = log
    this.onError = onError
    this.liveSessionId = null
    this.sideband = null
    this.pendingBuyerTranscript = ''
    this.pendingAssistantTranscript = ''
    this.history = []
    this.lastVisual = null
    this.delegationQueue = Promise.resolve()
    this.metrics = {
      responsesStarted: 0,
      audioChunks: 0,
      interruptions: 0,
      assistantTranscriptFinals: 0,
      userTranscriptFinals: 0,
      toolCalls: 0,
      spawnThinkingCalls: 0,
      delegations: 0,
      visualArtifacts: 0,
      lastAssistantTranscript: '',
      lastUserTranscript: '',
      lastEventAt: null,
    }
  }

  #sessionBody(sdp) {
    return {
      session: {
        model: this.model,
        audio: { output: { voice: this.voice } },
        client: {
          data_channel: {
            // The browser only carries media and receives status. All control,
            // delegation results, and prompt updates stay on the trusted sideband.
            allowed_client_events: [],
          },
        },
        delegation: { type: 'client' },
        instructions: liveInstructions(),
        store: false,
      },
      transport: { type: 'webrtc', sdp },
    }
  }

  async start({ sdp, timeoutMs = 30_000 } = {}) {
    if (!this.openaiApiKey) throw new Error('OPENAI_API_KEY is required for native GPT-Live')
    const offer = String(sdp || '')
    if (!offer.trim()) throw new Error('WebRTC SDP offer is required')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Timed out creating GPT-Live session')), timeoutMs)
    let body
    try {
      const response = await this.fetchImpl(`${this.openaiBaseUrl}/live/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.openaiApiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(this.#sessionBody(offer)),
      })
      if (!response.ok) throw new Error(`GPT-Live session HTTP ${response.status}: ${await response.text()}`)
      body = await response.json()
    } finally {
      clearTimeout(timer)
    }

    this.liveSessionId = clean(body?.session?.id, 240)
    const answerSdp = String(body?.transport?.sdp || '')
    if (!this.liveSessionId || !answerSdp.trim()) throw new Error('GPT-Live returned an incomplete WebRTC session')
    await this.#connectSideband({ timeoutMs })

    return {
      sessionId: this.liveSessionId,
      gatewaySessionId: this.salesSessionId,
      answerSdp,
      transport: 'webrtc',
      voiceMode: 'native-gpt-live',
      inputSampleRate: null,
    }
  }

  async #connectSideband({ timeoutMs }) {
    const ws = new this.WebSocketImpl(sidebandUrl(this.openaiBaseUrl, this.liveSessionId), {
      headers: { Authorization: `Bearer ${this.openaiApiKey}` },
    })
    this.sideband = ws
    ws.on('message', data => this.#handleRaw(data))
    ws.on('error', error => this.onError(error))
    ws.on('close', () => { if (this.sideband === ws) this.sideband = null })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out attaching GPT-Live sideband')), timeoutMs)
      ws.once('open', () => { clearTimeout(timer); resolve() })
      ws.once('error', error => { clearTimeout(timer); reject(error) })
    })
  }

  #send(event) {
    if (!this.sideband || this.sideband.readyState !== this.WebSocketImpl.OPEN) return false
    this.sideband.send(JSON.stringify(event))
    return true
  }

  #recordHistory(role, text) {
    const value = clean(text, 2_000)
    if (!value) return
    this.history.push({ role, text: value })
    if (this.history.length > 12) this.history.splice(0, this.history.length - 12)
  }

  #flushAssistantTranscript() {
    const content = clean(this.pendingAssistantTranscript, 2_000)
    if (!content) return ''
    this.pendingAssistantTranscript = ''
    this.metrics.lastAssistantTranscript = content
    this.metrics.assistantTranscriptFinals += 1
    this.#recordHistory('assistant', content)
    this.harness?.recordRealtimeEvent?.({
      sessionId: this.salesSessionId,
      event: { type: 'transcript.final', role: 'assistant', content },
    })
    return content
  }

  #recentContext() {
    return this.history.slice(-8).map(item => `${item.role}: ${item.text}`).join('\n')
  }

  #handleRaw(data) {
    let event
    try { event = JSON.parse(String(data)) } catch { return }
    if (!event?.type) return
    this.metrics.lastEventAt = new Date().toISOString()

    if (event.type === 'session.input_transcript.delta') {
      const delta = String(event.delta || '')
      if (delta) this.pendingBuyerTranscript += delta
      return
    }
    if (event.type === 'session.output_transcript.delta') {
      const delta = String(event.delta || '')
      if (delta) {
        this.pendingAssistantTranscript += delta
        this.metrics.lastAssistantTranscript = clean(this.pendingAssistantTranscript, 2_000)
      }
      return
    }
    if (event.type === 'session.delegation.created' && event.delegation?.target === 'client') {
      this.metrics.delegations += 1
      this.metrics.spawnThinkingCalls += 1
      this.metrics.toolCalls += 1
      this.delegationQueue = this.delegationQueue
        .then(() => this.#handleDelegation(event))
        .catch(error => this.onError(error))
      return
    }
    if (event.type === 'session.closed') {
      this.#flushAssistantTranscript()
      return
    }
    if (event.type === 'error') this.onError(new Error(event.error?.message || event.message || 'GPT-Live error'))
  }

  async #handleDelegation(event) {
    await delay(40)
    const delegationId = clean(event?.delegation?.id, 240)
    if (!delegationId) return

    this.#flushAssistantTranscript()

    const buyerTurn = clean(this.pendingBuyerTranscript, 4_000)
    this.pendingBuyerTranscript = ''
    if (!buyerTurn) {
      this.#send({
        type: 'session.commentary.append',
        delegation_id: delegationId,
        content: 'The buyer turn was not transcribed clearly. Ask one short clarifying question instead of guessing.',
      })
      return
    }

    this.metrics.lastUserTranscript = buyerTurn
    this.metrics.userTranscriptFinals += 1
    this.#recordHistory('buyer', buyerTurn)
    this.harness?.recordRealtimeEvent?.({
      sessionId: this.salesSessionId,
      event: { type: 'transcript.final', role: 'user', content: buyerTurn },
    })

    const taskId = `live-${delegationId}`
    try {
      this.#send({
        type: 'session.thinking.append',
        delegation_id: delegationId,
        content: 'SalesOS is checking buyer state, strategy, and verified business facts. Do not invent details while waiting.',
      })
      const result = await this.backend.submit({
        taskId,
        ownerId: this.salesSessionId,
        sessionId: this.salesSessionId,
        objective: buyerTurn,
        instruction: `Recent live conversation:\n${this.#recentContext()}\n\nMake the next sales decision for the latest buyer turn.`,
      })
      for (const artifact of result.artifacts || []) {
        const visual = salesVisualFromArtifact(artifact)
        if (visual) {
          this.lastVisual = visual
          this.metrics.visualArtifacts += 1
        }
      }
      // Commentary is deliberately compact because Live commentary context is
      // bounded; the hidden reasoner prompt also asks for concise guidance.
      const guidance = clean(result.content, 1_600)
        || 'Acknowledge the buyer, avoid unsupported claims, and ask one useful clarifying question.'
      this.#send({
        type: 'session.commentary.append',
        delegation_id: delegationId,
        content: guidance,
      })
    } catch (error) {
      this.log(`GPT-Live delegation failed: ${error.message}`)
      this.#send({
        type: 'session.commentary.append',
        delegation_id: delegationId,
        content: 'I could not verify the commercial answer safely. Say that you want to confirm the detail rather than guessing, then ask one short clarifying question if useful.',
      })
      throw error
    }
  }

  sendInputAudio() { throw new Error('Native GPT-Live uses browser WebRTC audio; server PCM input is disabled') }
  sendText() { throw new Error('Text rehearsal is disabled in native GPT-Live mode; use the microphone') }
  interrupt() { return false }

  getStatus() {
    return {
      started: Boolean(this.liveSessionId),
      voiceMode: 'native-gpt-live',
      liveSessionId: this.liveSessionId,
      gatewaySessionId: this.salesSessionId,
      lastVisual: this.lastVisual ? structuredClone(this.lastVisual) : null,
      metrics: structuredClone(this.metrics),
    }
  }

  async close() {
    const ws = this.sideband
    this.sideband = null
    if (ws?.readyState === this.WebSocketImpl.OPEN) {
      try { ws.send(JSON.stringify({ type: 'session.close' })) } catch {}
    }
    try { ws?.close?.() } catch {}
    await this.delegationQueue.catch(() => {})
    this.#flushAssistantTranscript()
    this.liveSessionId = null
  }
}
