import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { createAvatarControlServer } from '../src/runtime/avatar-control-server.mjs'

class FakeManager {
  constructor() {
    this.sessions = new Map()
    this.audio = []
    this.text = []
    this.interrupts = []
    this.actionRecords = [{
      id: 'action-1',
      sessionId: 'gateway-1',
      kind: 'book_demo',
      label: 'Book a demo',
      status: 'pending',
      requiresConfirmation: true,
      executed: false,
    }]
  }
  async start() {
    const session = {
      id: 'session-1',
      sessionId: 'live-1',
      gatewaySessionId: 'gateway-1',
      livekitUrl: 'wss://livekit',
      livekitClientToken: 'token',
      inputSampleRate: 24000,
    }
    this.sessions.set(session.id, session)
    return session
  }
  get(id) { return this.sessions.get(id) ?? null }
  status(id) {
    if (!this.sessions.has(id)) return null
    return {
      id,
      sessionId: 'live-1',
      pendingActions: this.actionRecords.filter(action => action.status === 'pending').length,
      bridge: {
        metrics: { audioChunks: 2, spawnThinkingCalls: 1, visualArtifacts: 1 },
        lastVisual: {
          type: 'product_card',
          props: { id: 'enterprise', name: 'Enterprise', priceMonthly: null, features: ['sso'] },
        },
      },
    }
  }
  learning(id) {
    if (!this.sessions.has(id)) return null
    return {
      schemaVersion: 'salesos.learning-bundle.v1',
      sessionId: 'gateway-1',
      trajectory: { events: [] },
      rewards: [],
      experiences: [],
    }
  }
  actions(id) { return this.sessions.has(id) ? structuredClone(this.actionRecords) : null }
  confirmAction(id, proposalId) {
    if (!this.sessions.has(id)) return null
    const action = this.actionRecords.find(item => item.id === proposalId)
    if (!action) return null
    action.status = 'confirmed'
    return structuredClone(action)
  }
  cancelAction(id, proposalId) {
    if (!this.sessions.has(id)) return null
    const action = this.actionRecords.find(item => item.id === proposalId)
    if (!action) return null
    action.status = 'cancelled'
    return structuredClone(action)
  }
  sendAudio(id, audio) { this.audio.push({ id, audio }); return true }
  sendText(id, text) { this.text.push({ id, text }); return true }
  interrupt(id) { this.interrupts.push(id); return true }
  async stop(id) { return this.sessions.delete(id) }
  async close() { this.sessions.clear() }
}

test('avatar control server serves Arcana SalesOS and routes session inputs', async () => {
  const manager = new FakeManager()
  const control = createAvatarControlServer({
    manager,
    port: 0,
    configuration: { app: 'arcana-salesos', liveReady: false, salesOS: 'harness-v1' },
  })
  const { origin } = await control.start()
  try {
    const health = await fetch(`${origin}/health`)
    assert.equal(health.status, 200)
    const healthBody = await health.json()
    assert.equal(healthBody.configuration.app, 'arcana-salesos')
    assert.equal(healthBody.configuration.liveReady, false)

    const html = await fetch(`${origin}/`)
    assert.equal(html.status, 200)
    assert.match(html.headers.get('content-type'), /text\/html/)
    const htmlText = await html.text()
    assert.match(htmlText, /Arcana SalesOS/)
    assert.match(htmlText, /Live sales intelligence/)
    assert.match(htmlText, /salesVisual/)

    for (const [path, pattern] of [
      ['/app.js', /summarizeLearningBundle/],
      ['/action-ui.js', /actionProposalMarkup/],
      ['/sales-visual.js', /salesVisualMarkup/],
      ['/sales-intelligence.js', /summarizeLearningBundle/],
      ['/action-ui.js', /actionProposalMarkup/],
      ['/styles.css', /\.workspace/],
    ]) {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 200)
      assert.match(await response.text(), pattern)
    }

    const vendor = await fetch(`${origin}/vendor/livekit-client.esm.mjs`)
    assert.equal(vendor.status, 200)
    assert.match(vendor.headers.get('content-type'), /javascript/)

    const createdResponse = await fetch(`${origin}/sessions`, { method: 'POST' })
    assert.equal(createdResponse.status, 201)
    const created = await createdResponse.json()
    assert.equal(created.id, 'session-1')

    const learningResponse = await fetch(`${origin}/sessions/session-1/learning`)
    assert.equal(learningResponse.status, 200)
    assert.equal((await learningResponse.json()).schemaVersion, 'salesos.learning-bundle.v1')

    const actionsResponse = await fetch(`${origin}/sessions/session-1/actions`)
    assert.equal(actionsResponse.status, 200)
    const actions = await actionsResponse.json()
    assert.equal(actions.length, 1)
    assert.equal(actions[0].status, 'pending')
    assert.equal(actions[0].executed, false)

    const confirm = await fetch(`${origin}/sessions/session-1/actions/action-1/confirm`, { method: 'POST' })
    assert.equal(confirm.status, 200)
    assert.equal((await confirm.json()).status, 'confirmed')

    const cancel = await fetch(`${origin}/sessions/session-1/actions/action-1/cancel`, { method: 'POST' })
    assert.equal(cancel.status, 200)
    const cancelled = await cancel.json()
    assert.equal(cancelled.status, 'cancelled')
    assert.equal(cancelled.executed, false)

    const noExecute = await fetch(`${origin}/sessions/session-1/actions/action-1/execute`, { method: 'POST' })
    assert.equal(noExecute.status, 404, 'manager without executeAction fails closed')

    const textResponse = await fetch(`${origin}/sessions/session-1/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'show me enterprise' }),
    })
    assert.equal(textResponse.status, 202)
    assert.deepEqual(manager.text, [{ id: 'session-1', text: 'show me enterprise' }])

    const statusResponse = await fetch(`${origin}/sessions/session-1`)
    assert.equal(statusResponse.status, 200)
    const status = await statusResponse.json()
    assert.equal(status.bridge.metrics.spawnThinkingCalls, 1)
    assert.equal(status.bridge.metrics.visualArtifacts, 1)
    assert.equal(status.bridge.lastVisual.type, 'product_card')
    assert.equal(status.bridge.lastVisual.props.id, 'enterprise')

    const wsUrl = new URL('/sessions/session-1/audio', origin)
    wsUrl.protocol = 'ws:'
    const ws = new WebSocket(wsUrl)
    await once(ws, 'open')
    ws.send(Buffer.from([1, 2, 3, 4]))
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(manager.audio, [{ id: 'session-1', audio: Buffer.from([1, 2, 3, 4]).toString('base64') }])

    const interruptResponse = await fetch(`${origin}/sessions/session-1/interrupt`, { method: 'POST' })
    assert.equal(interruptResponse.status, 200)
    assert.deepEqual(manager.interrupts, ['session-1'])

    ws.close()
    const stopped = await fetch(`${origin}/sessions/session-1`, { method: 'DELETE' })
    assert.equal(stopped.status, 200)
    assert.equal(manager.sessions.size, 0)
  } finally {
    await control.close()
  }
})
