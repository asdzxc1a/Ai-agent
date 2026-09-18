import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { liveSalesPreflight } from '../src/runtime/sales-frontend.mjs'

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  let body = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} -> ${response.status}: ${body.error || text}`)
  }
  return body
}

function waitForControlOrigin(child, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    const timer = setTimeout(() => reject(new Error('Timed out waiting for local avatar control server')), timeoutMs)
    const onData = chunk => {
      const text = chunk.toString()
      process.stdout.write(text)
      stdout += text
      const match = stdout.match(/\[sales-avatar\] avatar control: (http:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(timer)
        child.stdout.off('data', onData)
        resolve(match[1])
      }
      if (stdout.length > 16_000) stdout = stdout.slice(-8_000)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', chunk => process.stderr.write(chunk))
    child.once('exit', code => {
      clearTimeout(timer)
      reject(new Error(`Sales avatar server exited before readiness (code ${code})`))
    })
  })
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    once(child, 'exit').catch(() => {}),
    sleep(5_000).then(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }),
  ])
}

const preflight = liveSalesPreflight(process.env)
if (!preflight.ok) {
  for (const error of preflight.errors) console.error(`preflight error: ${error}`)
  process.exit(2)
}
if (String(process.env.LIVE_SMOKE_CONFIRM || '').trim().toUpperCase() !== 'YES') {
  console.error('Refusing to start a paid LiveAvatar/OpenAI session.')
  console.error('Set LIVE_SMOKE_CONFIRM=YES only when you intentionally want to spend live API credits.')
  process.exit(3)
}

const prompt = String(process.env.LIVE_SMOKE_PROMPT || 'We have 45 sales reps and need Salesforce and SSO. Which plan fits us and why?').trim()
const listenMs = Math.max(5_000, Number(process.env.LIVE_SMOKE_LISTEN_MS || 12_000))
const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    QWEN_GATEWAY_PORT: '0',
    AVATAR_CONTROL_PORT: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let controlOrigin = null
let sessionId = null
try {
  controlOrigin = await waitForControlOrigin(child)
  await jsonFetch(`${controlOrigin}/health`)
  const session = await jsonFetch(`${controlOrigin}/sessions`, {
    method: 'POST',
    body: '{}',
  })
  sessionId = session.id
  console.log(`[smoke] LiveAvatar session started: ${session.sessionId}`)
  console.log(`[smoke] input sample rate: ${session.inputSampleRate}`)
  console.log('[smoke] sending one sales prompt')
  await jsonFetch(`${controlOrigin}/sessions/${encodeURIComponent(sessionId)}/text`, {
    method: 'POST',
    body: JSON.stringify({ text: prompt }),
  })

  const deadline = Date.now() + listenMs
  let status = null
  while (Date.now() < deadline) {
    status = await jsonFetch(`${controlOrigin}/sessions/${encodeURIComponent(sessionId)}`)
    const metrics = status.bridge?.metrics || {}
    const passed = metrics.audioChunks > 0
      && metrics.assistantTranscriptFinals > 0
      && metrics.spawnThinkingCalls > 0
    if (passed) break
    await sleep(500)
  }

  status = await jsonFetch(`${controlOrigin}/sessions/${encodeURIComponent(sessionId)}`)
  const metrics = status.bridge?.metrics || {}
  console.log('[smoke] observed metrics:', JSON.stringify({
    responsesStarted: metrics.responsesStarted,
    audioChunks: metrics.audioChunks,
    audioBytes: metrics.audioBytes,
    assistantTranscriptFinals: metrics.assistantTranscriptFinals,
    spawnThinkingCalls: metrics.spawnThinkingCalls,
    toolCalls: metrics.toolCalls,
    interruptions: metrics.interruptions,
  }))
  if (!(metrics.audioChunks > 0)) throw new Error('Smoke failed: GPT-Live produced no 24 kHz audio for HeyGen')
  if (!(metrics.assistantTranscriptFinals > 0)) throw new Error('Smoke failed: no final assistant transcript observed')
  if (!(metrics.spawnThinkingCalls > 0)) throw new Error('Smoke failed: sales turn did not delegate through spawn_thinking')
  console.log(`[smoke] assistant: ${metrics.lastAssistantTranscript || '(transcript content unavailable)'}`)
  console.log('[smoke] PASS: Qwen -> sales backend -> GPT-Live -> HeyGen media path is active')
} finally {
  if (controlOrigin && sessionId) {
    await jsonFetch(`${controlOrigin}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(error => {
      console.warn(`[smoke] session cleanup warning: ${error.message}`)
    })
  }
  await stopChild(child)
}
