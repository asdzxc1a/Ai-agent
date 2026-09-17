import { randomUUID } from 'node:crypto'
import { createLiveAvatarClientFromEnv } from '../integrations/liveavatar-client.mjs'
import { QwenHeyGenBridge } from '../integrations/qwen-heygen-bridge.mjs'

function executionDisabledError() {
  const error = new Error('Sales action execution is disabled')
  error.code = 'ACTION_EXECUTION_DISABLED'
  return error
}

export class AvatarSessionManager {
  constructor({
    createBridge,
    maxSessions = 8,
    harness = null,
    actionProposals = null,
    actionExecutor = null,
  } = {}) {
    if (typeof createBridge !== 'function') throw new TypeError('createBridge is required')
    this.createBridge = createBridge
    this.maxSessions = maxSessions
    this.harness = harness
    this.actionProposals = actionProposals
    this.actionExecutor = actionExecutor
    this.sessions = new Map()
    this.learningSessions = new Map()
  }

  async start(options = {}) {
    if (this.sessions.size >= this.maxSessions) throw new Error('Avatar session capacity reached')
    const id = options.id || randomUUID()
    if (this.sessions.has(id)) throw new Error(`Avatar session ${id} already exists`)
    const bridge = this.createBridge({ id, ...options })
    const started = await bridge.start({ timeoutMs: options.timeoutMs || 30_000 })
    const record = { id, bridge, started, createdAt: Date.now() }
    this.sessions.set(id, record)
    if (started.gatewaySessionId) this.learningSessions.set(id, started.gatewaySessionId)
    return {
      id,
      sessionId: started.sessionId,
      gatewaySessionId: started.gatewaySessionId || null,
      livekitUrl: started.livekitUrl,
      livekitClientToken: started.livekitClientToken,
      inputSampleRate: started.inputSampleRate,
    }
  }

  get(id) { return this.sessions.get(id) ?? null }

  resolveLearningSessionId(id) {
    return this.sessions.get(id)?.started?.gatewaySessionId || this.learningSessions.get(id) || null
  }

  status(id) {
    const record = this.sessions.get(id)
    if (!record) return null
    return {
      id: record.id,
      createdAt: record.createdAt,
      sessionId: record.started.sessionId,
      gatewaySessionId: record.started.gatewaySessionId || null,
      inputSampleRate: record.started.inputSampleRate,
      bridge: typeof record.bridge.getStatus === 'function' ? record.bridge.getStatus() : { started: true },
      pendingActions: this.actions(id)?.filter(action => action.status === 'pending').length ?? 0,
      actionExecutionEnabled: Boolean(this.actionExecutor),
    }
  }

  learning(id) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.harness) return null
    return this.harness.exportLearningBundle(sessionId)
  }

  recordReward(id, input = {}) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.harness) throw new Error(`Unknown learning session: ${id}`)
    return this.harness.recordReward(sessionId, input)
  }

  promoteExperience(id, input = {}) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId || !this.harness) throw new Error(`Unknown learning session: ${id}`)
    return this.harness.promoteExperience({ ...input, sessionId })
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

  async executeAction(id, proposalId) {
    const sessionId = this.resolveLearningSessionId(id)
    if (!sessionId) throw new Error(`Unknown action session: ${id}`)
    if (!this.actionExecutor?.execute) throw executionDisabledError()
    return this.actionExecutor.execute(proposalId, {
      sessionId,
      context: {
        avatarSessionId: id,
        gatewaySessionId: sessionId,
      },
    })
  }

  sendAudio(id, base64Pcm16) {
    const record = this.sessions.get(id)
    if (!record) throw new Error(`Unknown avatar session: ${id}`)
    return record.bridge.sendInputAudio(base64Pcm16)
  }

  sendText(id, text) {
    const record = this.sessions.get(id)
    if (!record) throw new Error(`Unknown avatar session: ${id}`)
    return record.bridge.sendText(text)
  }

  interrupt(id) {
    const record = this.sessions.get(id)
    if (!record) throw new Error(`Unknown avatar session: ${id}`)
    return record.bridge.interrupt()
  }

  async stop(id) {
    const record = this.sessions.get(id)
    if (!record) return false
    this.sessions.delete(id)
    await record.bridge.close()
    return true
  }

  async close() {
    const ids = [...this.sessions.keys()]
    await Promise.allSettled(ids.map(id => this.stop(id)))
  }
}

export function createAvatarSessionManagerFromEnv({
  gatewayOrigin,
  env = process.env,
  bridgeOptions = {},
  harness = null,
  actionProposals = null,
  actionExecutor = null,
} = {}) {
  if (!gatewayOrigin) throw new TypeError('gatewayOrigin is required')
  const liveAvatarClient = createLiveAvatarClientFromEnv(env)
  return new AvatarSessionManager({
    maxSessions: Number(env.SALES_AVATAR_MAX_SESSIONS || 8),
    harness,
    actionProposals,
    actionExecutor,
    createBridge: ({ id }) => new QwenHeyGenBridge({
      gatewayOrigin,
      liveAvatarClient,
      gatewaySessionId: `sales-avatar-${id}`,
      outputVoice: env.GPT_LIVE_REALTIME_VOICE || '',
      harness,
      ...bridgeOptions,
    }),
  })
}
