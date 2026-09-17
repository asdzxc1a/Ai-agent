import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { salesVisualsFromArtifacts } from '../domain/sales-artifacts.mjs'

function clean(value, max = 8000) {
  const text = String(value ?? '').trim()
  return [...text].slice(0, max).join('')
}

function wsReady(ws) { return ws?.readyState === WebSocket.OPEN || ws?.readyState === 1 }

function waitForOpen(ws, timeoutMs = 10_000) {
  if (wsReady(ws)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out attaching GPT-Live sideband')), timeoutMs)
    const resolveOpen = () => { clearTimeout(timer); resolve() }
    const rejectError = error => { clearTimeout(timer); reject(error) }
    if (typeof ws.once === 'function') {
      ws.once('open', resolveOpen)
      ws.once('error', rejectError)
    } else {
      ws.addEventListener?.('open', resolveOpen, { once: true })
      ws.addEventListener?.('error', rejectError, { once: true })
    }
  })
}

function listen(ws, event, listener) {
  if (typeof ws.on === 'function') ws.on(event, listener)
  else ws.addEventListener?.(event, listener)
}

export class GPTLiveSalesSideband {
  constructor({
    liveSessionId,
    apiKey,
    salesSessionId,
    backend,
    harness = null,
    wsFactory = (url, options) => new WebSocket(url, options),
    apiUrl = 'https://api.openai.com/v1',
    log = () => {},
  } = {}) {
    if (!clean(liveSessionId)) throw new TypeError('liveSessionId is required')
    if (!clean(apiKey)) throw new TypeError('apiKey is required')
    if (!clean(salesSessionId)) throw new TypeError('salesSessionId is required')
    if (!backend?.submit) throw new TypeError('backend is required')
    this.liveSessionId = clean(liveSessionId)
    this.apiKey = clean(apiKey)
    this.salesSessionId = clean(salesSessionId)
    this.backend = backend
    this.harness = harness
    this.wsFactory = wsFactory
    this.apiUrl = clean(apiUrl).replace(/\/$/, '')
    this.log = log
    this.ws = null
    this.fragments = []
    this.seenDelegations = new Set()
    this.lastDelegationOffsetMs = 0
    this.lastUserTranscript = ''
    this.lastAssistantTranscript = ''
    this.lastUserEndMs = 0
    this.lastAssistantEndMs = 0
    this.lastVisual = null
    this.metrics = {
      delegations: 0,
      backendDecisions: 0,
      sidebandErrors: 0,
      inputTranscriptFragments: 0,
      outputTranscriptFragments: 0,
      lastEventAt: null,
    }
  }

  async connect({ timeoutMs = 10_000 } = {}) {
    if (this.ws) throw new Error('GPT-Live sideband is already connected')
    const url = new URL(`${this.apiUrl}/live/sessions/${encodeURIComponent(this.liveSessionId)}/attach`)
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
    this.ws = this.wsFactory(url.toString(), { headers: { authorization: `Bearer ${this.apiKey}` } })
    listen(this.ws, 'message', data => this.#handleRaw(data?.data ?? data))
    listen(this.ws, 'error', error => {
      this.metrics.sidebandErrors += 1
      this.log(`GPT-Live sideband error: ${error?.message || error}`)
    })
    await waitForOpen(this.ws, timeoutMs)
    return this
  }

  #send(event) {
    if (!wsReady(this.ws)) throw new Error('GPT-Live sideband is not connected')
    this.ws.send(JSON.stringify(event))
  }

  #handleRaw(raw) {
    let event
    try { event = JSON.parse(String(raw)) } catch { return }
    this.metrics.lastEventAt = new Date().toISOString()
    if (event.type === 'session.input_transcript.delta') {
      this.#recordTranscript('user', event)
      return
    }
    if (event.type === 'session.output_transcript.delta') {
      this.#recordTranscript('assistant', event)
      return
    }
    if (event.type === 'session.delegation.created' && event.delegation?.target === 'client') {
      void this.#handleDelegation(event).catch(error => {
        this.metrics.sidebandErrors += 1
        this.log(`GPT-Live delegation failed: ${error.message}`)
      })
      return
    }
    if (event.type === 'error') {
      this.metrics.sidebandErrors += 1
      this.log(`GPT-Live error: ${event.error?.message || event.message || 'unknown error'}`)
    }
  }

  #recordTranscript(role, event) {
    const delta = clean(event.delta, 2000)
    if (!delta) return
    const startMs = Number(event.start_ms) || 0
    const endMs = Number(event.end_ms) || startMs
    this.fragments.push({ role, text: delta, startMs, endMs })
    if (this.fragments.length > 300) this.fragments.splice(0, this.fragments.length - 300)

    if (role === 'user') {
      if (startMs && this.lastUserEndMs && startMs - this.lastUserEndMs > 1500) this.lastUserTranscript = ''
      this.lastUserTranscript = clean(`${this.lastUserTranscript}${delta}`, 4000)
      this.lastUserEndMs = Math.max(this.lastUserEndMs, endMs)
      this.metrics.inputTranscriptFragments += 1
    } else {
      if (startMs && this.lastAssistantEndMs && startMs - this.lastAssistantEndMs > 1500) this.lastAssistantTranscript = ''
      this.lastAssistantTranscript = clean(`${this.lastAssistantTranscript}${delta}`, 4000)
      this.lastAssistantEndMs = Math.max(this.lastAssistantEndMs, endMs)
      this.metrics.outputTranscriptFragments += 1
    }

    this.harness?.recordRealtimeEvent?.({
      sessionId: this.salesSessionId,
      event: { type: 'transcript.delta', role, content: delta },
    })
  }

  #buyerTurnAt(offsetMs) {
    const ceiling = Number(offsetMs) || Number.MAX_SAFE_INTEGER
    let relevant = this.fragments.filter(item => item.role === 'user' && item.endMs <= ceiling && item.endMs > this.lastDelegationOffsetMs)
    if (!relevant.length) relevant = this.fragments.filter(item => item.role === 'user' && item.endMs <= ceiling && item.endMs >= ceiling - 20_000)
    return clean(relevant.map(item => item.text).join(''), 5000) || clean(this.lastUserTranscript, 5000) || 'The buyer requested sales guidance.'
  }

  #recentConversation(offsetMs) {
    const ceiling = Number(offsetMs) || Number.MAX_SAFE_INTEGER
    const relevant = this.fragments.filter(item => item.endMs <= ceiling && item.endMs >= ceiling - 90_000).slice(-80)
    const lines = []
    let role = null
    let text = ''
    for (const item of relevant) {
      if (item.role !== role) {
        if (role && text) lines.push(`${role}: ${text}`)
        role = item.role
        text = item.text
      } else text += item.text
    }
    if (role && text) lines.push(`${role}: ${text}`)
    return clean(lines.join('\n'), 9000)
  }

  async #handleDelegation(event) {
    const delegationId = clean(event.delegation?.id, 240)
    if (!delegationId || this.seenDelegations.has(delegationId)) return
    this.seenDelegations.add(delegationId)
    this.metrics.delegations += 1
    const offsetMs = Number(event.offset_ms) || this.lastUserEndMs || 0
    const buyerTurn = this.#buyerTurnAt(offsetMs)
    const recentConversation = this.#recentConversation(offsetMs)
    const taskId = `live_${delegationId}_${randomUUID().slice(0, 8)}`

    try {
      const result = await this.backend.submit({
        id: taskId,
        taskId,
        ownerId: this.salesSessionId,
        sessionId: this.salesSessionId,
        objective: buyerTurn,
        originalRequest: buyerTurn,
        instruction: `GPT-Live delegated a commercial decision. Use the buyer's latest turn as the authoritative new input. Recent spoken context follows for continuity only:\n${recentConversation}`,
      })
      this.metrics.backendDecisions += 1
      const visuals = salesVisualsFromArtifacts(result.artifacts)
      if (visuals.length) this.lastVisual = visuals.at(-1)
      const content = clean(result.content, 1800) || 'Acknowledge the buyer, ask one useful clarifying question, and do not invent any commercial fact.'
      this.#send({
        type: 'session.commentary.append',
        event_id: `salesos_${randomUUID().replaceAll('-', '')}`,
        delegation_id: delegationId,
        content,
      })
    } catch (error) {
      this.#send({
        type: 'session.commentary.append',
        event_id: `salesos_error_${randomUUID().replaceAll('-', '')}`,
        delegation_id: delegationId,
        content: 'Do not guess or make a commercial promise. Say that you want to verify that point, then ask the smallest useful clarifying question if appropriate.',
      })
      throw error
    } finally {
      this.lastDelegationOffsetMs = Math.max(this.lastDelegationOffsetMs, offsetMs)
    }
  }

  async handleTypedBuyerText(text) {
    const buyerTurn = clean(text, 5000)
    if (!buyerTurn) return false
    const taskId = `typed_${randomUUID()}`
    const result = await this.backend.submit({
      id: taskId,
      taskId,
      ownerId: this.salesSessionId,
      sessionId: this.salesSessionId,
      objective: buyerTurn,
      originalRequest: buyerTurn,
      instruction: 'This is a typed rehearsal buyer turn. Treat it exactly like the buyer said it aloud.',
    })
    this.metrics.backendDecisions += 1
    this.lastUserTranscript = buyerTurn
    const visuals = salesVisualsFromArtifacts(result.artifacts)
    if (visuals.length) this.lastVisual = visuals.at(-1)
    this.#send({
      type: 'session.thinking.append',
      event_id: `typed_context_${randomUUID().replaceAll('-', '')}`,
      delegation_id: null,
      content: `The buyer just typed this rehearsal message: ${buyerTurn}`,
    })
    this.#send({
      type: 'session.commentary.append',
      event_id: `typed_result_${randomUUID().replaceAll('-', '')}`,
      delegation_id: null,
      content: clean(result.content, 1800),
    })
    return true
  }

  status() {
    return {
      started: Boolean(this.ws && wsReady(this.ws)),
      renderer: 'browser-webrtc',
      liveSessionId: this.liveSessionId,
      gatewaySessionId: this.salesSessionId,
      lastVisual: this.lastVisual ? structuredClone(this.lastVisual) : null,
      metrics: {
        audioChunks: 0,
        spawnThinkingCalls: this.metrics.backendDecisions,
        toolCalls: this.metrics.delegations,
        visualArtifacts: this.lastVisual ? 1 : 0,
        interruptions: 0,
        lastUserTranscript: this.lastUserTranscript,
        lastAssistantTranscript: this.lastAssistantTranscript,
        ...structuredClone(this.metrics),
      },
    }
  }

  close() {
    const ws = this.ws
    this.ws = null
    if (!ws) return
    try {
      if (wsReady(ws)) ws.send(JSON.stringify({ type: 'session.close', event_id: `close_${randomUUID().replaceAll('-', '')}` }))
    } catch {}
    try { ws.close() } catch {}
  }
}
