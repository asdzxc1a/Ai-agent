import { randomUUID } from 'node:crypto'
import { createLiveAvatarClientFromEnv } from '../integrations/liveavatar-client.mjs'
import { QwenHeyGenBridge } from '../integrations/qwen-heygen-bridge.mjs'

export class AvatarSessionManager {
  constructor({ createBridge, maxSessions = 8 } = {}) {
    if (typeof createBridge !== 'function') throw new TypeError('createBridge is required')
    this.createBridge = createBridge
    this.maxSessions = maxSessions
    this.sessions = new Map()
  }

  async start(options = {}) {
    if (this.sessions.size >= this.maxSessions) throw new Error('Avatar session capacity reached')
    const id = options.id || randomUUID()
    if (this.sessions.has(id)) throw new Error(`Avatar session ${id} already exists`)
    const bridge = this.createBridge({ id, ...options })
    const started = await bridge.start({ timeoutMs: options.timeoutMs || 30_000 })
    const record = { id, bridge, started, createdAt: Date.now() }
    this.sessions.set(id, record)
    return {
      id,
      sessionId: started.sessionId,
      livekitUrl: started.livekitUrl,
      livekitClientToken: started.livekitClientToken,
      inputSampleRate: started.inputSampleRate,
    }
  }

  get(id) { return this.sessions.get(id) ?? null }

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

export function createAvatarSessionManagerFromEnv({ gatewayOrigin, env = process.env, bridgeOptions = {} } = {}) {
  if (!gatewayOrigin) throw new TypeError('gatewayOrigin is required')
  const liveAvatarClient = createLiveAvatarClientFromEnv(env)
  return new AvatarSessionManager({
    maxSessions: Number(env.SALES_AVATAR_MAX_SESSIONS || 8),
    createBridge: ({ id }) => new QwenHeyGenBridge({
      gatewayOrigin,
      liveAvatarClient,
      gatewaySessionId: `sales-avatar-${id}`,
      outputVoice: env.GPT_LIVE_REALTIME_VOICE || '',
      ...bridgeOptions,
    }),
  })
}
