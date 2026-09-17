import { randomUUID } from 'node:crypto'
import { createOpenAILiveWebRTCSession } from './openai-live-client.mjs'
import { GPTLiveSalesSideband } from './gpt-live-sideband.mjs'

function clean(value) { return String(value ?? '').trim() }

export class NativeGPTLiveSessionManager {
  constructor({
    apiKey,
    backend,
    harness = null,
    actionProposals = null,
    model = 'gpt-live-1',
    voice = 'marin',
    maxSessions = 8,
    createLiveSession = createOpenAILiveWebRTCSession,
    createSideband = options => new GPTLiveSalesSideband(options),
    log = () => {},
  } = {}) {
    if (!backend?.submit) throw new TypeError('backend is required')
    this.apiKey = clean(apiKey)
    this.backend = backend
    this.harness = harness
    this.actionProposals = actionProposals
    this.model = clean(model) || 'gpt-live-1'
    this.voice = clean(voice) || 'marin'
    this.maxSessions = Number(maxSessions) || 8
    this.createLiveSession = createLiveSession
    this.createSideband = createSideband
    this.log = log
    this.sessions = new Map()
    this.learningSessions = new Map()
  }

  async start({ sdp, id = randomUUID(), timeoutMs = 12_000 } = {}) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is required for native GPT-Live')
    if (this.sessions.size >= this.maxSessions) throw new Error('Native GPT-Live session capacity reached')
    if (this.sessions.has(id)) throw new Error(`Native GPT-Live session ${id} already exists`)
    const salesSessionId = `sales-live-${id}`
    const created = await this.createLiveSession({
      apiKey: this.apiKey,
      sdp,
      model: this.model,
      voice: this.voice,
    })
    const sideband = this.createSideband({
      liveSessionId: created.liveSessionId,
      apiKey: this.apiKey,
      salesSessionId,
      backend: this.backend,
      harness: this.harness,
      log: this.log,
    })
    try {
      await sideband.connect({ timeoutMs })
    } catch (error) {
      sideband.close?.()
      throw error
    }
    const record = {
      id,
      liveSessionId: created.liveSessionId,
      salesSessionId,
      sdp: created.sdp,
      sideband,
      createdAt: Date.now(),
    }
    this.sessions.set(id, record)
    this.learningSessions.set(id, salesSessionId)
    return {
      id,
      sessionId: created.liveSessionId,
      liveSessionId: created.liveSessionId,
      gatewaySessionId: salesSessionId,
      renderer: 'browser-webrtc',
      sdp: created.sdp,
    }
  }

  get(id) { return this.sessions.get(clean(id)) ?? null }

  resolveLearningSessionId(id) {
    return this.sessions.get(clean(id))?.salesSessionId || this.learningSessions.get(clean(id)) || null
  }

  status(id) {
    const record = this.get(id)
    if (!record) return null
    return {
      id: record.id,
      createdAt: record.createdAt,
      sessionId: record.liveSessionId,
      liveSessionId: record.liveSessionId,
      gatewaySessionId: record.salesSessionId,
      renderer: 'browser-webrtc',
      bridge: record.sideband.status(),
      pendingActions: this.actions(id)?.filter(action => action.status === 'pending').length ?? 0,
    }
  }

  learning(id) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.harness) return null
    return this.harness.exportLearningBundle(sessionId)
  }

  actions(id, { status = null } = {}) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.actionProposals?.list) return null
    return this.actionProposals.list({ sessionId, status })
  }

  confirmAction(id, proposalId) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.actionProposals?.confirm) throw new Error(`Unknown action session: ${id}`)
    const proposal = this.actionProposals.confirm(proposalId, { sessionId })
    this.harness?.recordActionLifecycle?.({ sessionId, type: 'sales.action.confirmed', proposal })
    return proposal
  }

  cancelAction(id, proposalId) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.actionProposals?.cancel) throw new Error(`Unknown action session: ${id}`)
    const proposal = this.actionProposals.cancel(proposalId, { sessionId })
    this.harness?.recordActionLifecycle?.({ sessionId, type: 'sales.action.cancelled', proposal })
    return proposal
  }

  sendText(id, text) {
    const record = this.get(id)
    if (!record) throw new Error(`Unknown native GPT-Live session: ${id}`)
    return record.sideband.handleTypedBuyerText(text)
  }

  async stop(id) {
    const key = clean(id)
    const record = this.sessions.get(key)
    if (!record) return false
    this.sessions.delete(key)
    record.sideband.close()
    return true
  }

  async close() {
    await Promise.allSettled([...this.sessions.keys()].map(id => this.stop(id)))
  }
}

export function createNativeGPTLiveSessionManagerFromEnv({
  backend,
  harness = null,
  actionProposals = null,
  env = process.env,
  options = {},
} = {}) {
  return new NativeGPTLiveSessionManager({
    apiKey: env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY,
    backend,
    harness,
    actionProposals,
    model: env.GPT_LIVE_MODEL || 'gpt-live-1',
    voice: env.GPT_LIVE_VOICE || 'marin',
    maxSessions: Number(env.SALES_AVATAR_MAX_SESSIONS || 8),
    ...options,
  })
}
