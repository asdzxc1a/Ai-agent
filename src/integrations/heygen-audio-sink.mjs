import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class HeyGenAudioSink {
  constructor({
    createSocket = url => new WebSocket(url),
    log = () => {},
    pingIntervalMs = 30_000,
    keepAliveIntervalMs = 120_000,
    maxConnectAttempts = 5,
    initialBackoffMs = 1_000,
    maxBackoffMs = 8_000,
  } = {}) {
    this.createSocket = createSocket
    this.log = log
    this.pingIntervalMs = pingIntervalMs
    this.keepAliveIntervalMs = keepAliveIntervalMs
    this.maxConnectAttempts = maxConnectAttempts
    this.initialBackoffMs = initialBackoffMs
    this.maxBackoffMs = maxBackoffMs
    this.socket = null
    this.wsUrl = ''
    this.closed = true
    this.ready = false
    this.waiters = new Set()
    this.loopPromise = null
  }

  setReady(value) {
    this.ready = value
    if (!value) return
    for (const resolve of this.waiters) resolve(true)
    this.waiters.clear()
  }

  waitUntilReady(timeoutMs = 10_000) {
    if (this.ready) return Promise.resolve(true)
    if (this.closed) return Promise.resolve(false)
    return new Promise(resolve => {
      let settled = false
      const finish = value => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.waiters.delete(finish)
        resolve(value)
      }
      const timer = setTimeout(() => finish(false), Math.max(0, timeoutMs))
      this.waiters.add(finish)
    })
  }

  async connect(session, { timeoutMs = 10_000 } = {}) {
    const wsUrl = typeof session === 'string' ? session : session?.wsUrl
    if (!wsUrl) throw new Error('HeyGen LITE wsUrl is required')
    if (this.loopPromise) throw new Error('HeyGen audio sink is already connected')
    this.wsUrl = wsUrl
    this.closed = false
    this.loopPromise = this.runLoop().finally(() => { this.loopPromise = null })
    if (!(await this.waitUntilReady(timeoutMs))) {
      await this.close()
      throw new Error('Timed out waiting for HeyGen media server state=connected')
    }
    return this
  }

  async runLoop() {
    let attempt = 0
    while (!this.closed) {
      const connectedAt = await this.connectOnce()
      if (this.closed) return
      if (connectedAt && Date.now() - connectedAt >= 5_000) attempt = 0
      attempt += 1
      if (attempt >= this.maxConnectAttempts) {
        this.log(`HeyGen media server: gave up after ${attempt} attempts`)
        this.closed = true
        for (const resolve of this.waiters) resolve(false)
        this.waiters.clear()
        return
      }
      const delay = Math.min(this.maxBackoffMs, this.initialBackoffMs * 2 ** (attempt - 1))
      this.log(`HeyGen media server: reconnecting in ${delay}ms`)
      await sleep(delay)
    }
  }

  connectOnce() {
    return new Promise(resolve => {
      let connectedAt = null
      const ws = this.createSocket(this.wsUrl)
      const timers = []
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        for (const timer of timers) clearInterval(timer)
        if (this.socket === ws) this.socket = null
        this.ready = false
        resolve(connectedAt)
      }

      ws.on('open', () => {
        this.socket = ws
        connectedAt = Date.now()
        if (typeof ws.ping === 'function' && this.pingIntervalMs > 0) {
          timers.push(setInterval(() => {
            if (ws.readyState === 1) ws.ping()
          }, this.pingIntervalMs))
        }
        if (this.keepAliveIntervalMs > 0) {
          timers.push(setInterval(() => {
            this.send({ type: 'session.keep_alive', event_id: randomUUID() })
          }, this.keepAliveIntervalMs))
        }
      })
      ws.on('message', raw => this.handleServerEvent(String(raw)))
      ws.on('error', error => this.log(`HeyGen media server: ${error.message}`))
      ws.on('close', finish)
    })
  }

  handleServerEvent(raw) {
    let event
    try { event = JSON.parse(raw) } catch { return }
    if (event.type === 'session.state_updated') {
      this.log(`HeyGen media server: state ${event.state}`)
      if (event.state === 'connected') this.setReady(true)
      if (event.state === 'closing' || event.state === 'closed') this.ready = false
    } else if (event.type === 'error') {
      this.log(`HeyGen media server error: ${raw.slice(0, 300)}`)
    }
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== 1 || !this.ready) return false
    this.socket.send(JSON.stringify(payload))
    return true
  }

  writePcm24k(base64Pcm16) {
    if (!base64Pcm16) return false
    return this.send({ type: 'agent.speak', audio: base64Pcm16 })
  }

  interrupt() {
    return this.send({ type: 'agent.interrupt' })
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.ready = false
    for (const resolve of this.waiters) resolve(false)
    this.waiters.clear()
    const socket = this.socket
    this.socket = null
    if (socket && socket.readyState < 2) socket.close()
    await this.loopPromise?.catch(() => {})
  }
}
