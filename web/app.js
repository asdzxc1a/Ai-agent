import { Room, RoomEvent, Track } from '/vendor/livekit-client.esm.mjs'
import { startMicCapture } from './mic.js'
import { renderSalesVisual } from './sales-visual.js'
import { formatConfidence, formatStage, summarizeLearningBundle } from './sales-intelligence.js'

const $ = id => document.getElementById(id)
const state = {
  session: null,
  room: null,
  mic: null,
  micSocket: null,
  muted: false,
  pollTimer: null,
  visualKey: '',
  callStartedAt: null,
  timer: null,
  learningPolls: 0,
}

function setState(text, kind = '') {
  $('state').textContent = text
  $('state').dataset.kind = kind
}

function setBackendStatus(text, kind = '') {
  $('backendStatusText').textContent = text
  $('backendStatus').dataset.kind = kind
}

function setButtons(active, liveReady = true) {
  $('start').disabled = active || !liveReady
  $('stop').disabled = !active
  $('send').disabled = !active
  $('mic').disabled = !active
  $('interrupt').disabled = !active
}

function setTranscript(id, text, emptyText) {
  const element = $(id)
  const value = String(text || '').trim()
  element.textContent = value || emptyText
  element.classList.toggle('empty', !value)
}

function resetIntelligence() {
  $('intelStage').textContent = 'Connect'
  $('intelConfidence').textContent = '—'
  $('intelObjective').textContent = 'Listen first. Understand the buyer before making a recommendation.'
  $('buyerSignals').innerHTML = '<li class="signal-empty">Signals appear as the conversation develops.</li>'
  $('learningEvents').textContent = '0'
}

function renderIntelligence(bundle) {
  const summary = summarizeLearningBundle(bundle)
  $('intelStage').textContent = formatStage(summary.stage)
  $('intelConfidence').textContent = formatConfidence(summary.confidence)
  $('intelObjective').textContent = summary.objective
  $('learningEvents').textContent = summary.eventCount
  const list = $('buyerSignals')
  list.replaceChildren()
  const signals = summary.signals.length ? summary.signals : ['Signals appear as the conversation develops.']
  for (const signal of signals) {
    const item = document.createElement('li')
    item.textContent = signal
    if (!summary.signals.length) item.className = 'signal-empty'
    list.appendChild(item)
  }
}

async function jsonFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const text = await response.text()
  let body = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`)
  return body
}

function cleanupMediaElements() {
  $('stage').querySelectorAll('video,audio').forEach(element => element.remove())
  $('stagePlaceholder').hidden = false
}

function resetVisual() {
  state.visualKey = ''
  renderSalesVisual($('salesVisual'), null)
  $('visualArtifacts').textContent = '0'
}

function maybeRenderVisual(visual) {
  if (!visual) return
  let nextKey = ''
  try { nextKey = JSON.stringify(visual) } catch { nextKey = String(visual?.type || 'visual') }
  if (nextKey === state.visualKey) return
  state.visualKey = nextKey
  renderSalesVisual($('salesVisual'), visual)
}

function setLive(active) {
  $('liveChip').dataset.live = active ? 'true' : 'false'
  $('liveLabel').textContent = active ? 'Live conversation' : 'Ready'
}

function formatTimer(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function startTimer() {
  state.callStartedAt = Date.now()
  clearInterval(state.timer)
  $('callTimer').textContent = '00:00'
  state.timer = setInterval(() => {
    $('callTimer').textContent = formatTimer(Date.now() - state.callStartedAt)
  }, 1000)
}

function stopTimer() {
  clearInterval(state.timer)
  state.timer = null
  state.callStartedAt = null
}

async function checkHealth() {
  try {
    const health = await jsonFetch('/health')
    const config = health.configuration || {}
    const liveReady = config.liveReady !== false
    if (liveReady) {
      setBackendStatus('System ready', 'ok')
      setButtons(false, true)
      setState('System ready')
    } else {
      setBackendStatus('Preview mode', 'warn')
      setButtons(false, false)
      setState('Backend online — add OpenAI + LiveAvatar credentials to start a live call', 'warn')
    }
  } catch (error) {
    setBackendStatus('Backend offline', 'error')
    setButtons(false, false)
    setState(error.message, 'error')
  }
}

async function connectLiveKit(session) {
  const room = new Room({ adaptiveStream: true, dynacast: true })
  room.on(RoomEvent.TrackSubscribed, track => {
    if (![Track.Kind.Video, Track.Kind.Audio].includes(track.kind)) return
    const element = track.attach()
    element.autoplay = true
    if (track.kind === Track.Kind.Video) {
      element.playsInline = true
      element.className = 'avatar-video'
      $('stagePlaceholder').hidden = true
    } else {
      element.className = 'avatar-audio'
    }
    $('stage').appendChild(element)
  })
  room.on(RoomEvent.TrackUnsubscribed, track => {
    track.detach().forEach(element => element.remove())
  })
  room.on(RoomEvent.Disconnected, () => {
    setState('Avatar connection interrupted', 'warn')
    setBackendStatus('Reconnecting', 'warn')
  })
  await room.connect(session.livekitUrl, session.livekitClientToken)
  state.room = room
}

function controlWsUrl(path) {
  const url = new URL(path, location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

async function enableMic() {
  if (!state.session) return
  if (state.mic) {
    state.muted = !state.muted
    state.mic.setMuted(state.muted)
    $('micLabel').textContent = state.muted ? 'Unmute mic' : 'Mute mic'
    $('mic').setAttribute('aria-pressed', String(!state.muted))
    setState(state.muted ? 'Microphone muted' : 'Listening — speak naturally', state.muted ? 'warn' : 'ok')
    return
  }

  const socket = new WebSocket(controlWsUrl(`/sessions/${encodeURIComponent(state.session.id)}/audio`))
  socket.binaryType = 'arraybuffer'
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Microphone connection timed out')), 5_000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Microphone connection failed')) }, { once: true })
  })
  state.micSocket = socket
  state.mic = await startMicCapture(buffer => {
    if (socket.readyState === WebSocket.OPEN) socket.send(buffer)
  }, level => {
    $('meterBar').style.width = `${Math.min(100, Math.max(2, level * 450))}%`
  })
  $('micLabel').textContent = 'Mute mic'
  $('mic').setAttribute('aria-pressed', 'true')
  setState('Listening — speak naturally', 'ok')
}

async function pollLearning() {
  if (!state.session) return
  try {
    const bundle = await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}/learning`)
    renderIntelligence(bundle)
  } catch (error) {
    console.debug('learning bundle not ready', error.message)
  }
}

async function pollStatus() {
  if (!state.session) return
  try {
    const status = await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}`)
    const bridge = status.bridge || {}
    const metrics = bridge.metrics || {}
    $('audioChunks').textContent = metrics.audioChunks ?? 0
    $('delegations').textContent = metrics.spawnThinkingCalls ?? 0
    $('toolCalls').textContent = metrics.toolCalls ?? 0
    $('visualArtifacts').textContent = metrics.visualArtifacts ?? 0
    $('interruptions').textContent = metrics.interruptions ?? 0
    maybeRenderVisual(bridge.lastVisual)
    if (metrics.lastUserTranscript) setTranscript('userTranscript', metrics.lastUserTranscript, 'Waiting for the buyer…')
    if (metrics.lastAssistantTranscript) setTranscript('assistantTranscript', metrics.lastAssistantTranscript, "The salesperson's final spoken response will appear here.")
    state.learningPolls += 1
    if (state.learningPolls % 2 === 0) void pollLearning()
  } catch (error) {
    console.warn(error)
    setBackendStatus('Connection issue', 'warn')
  }
}

function startPolling() {
  clearInterval(state.pollTimer)
  state.learningPolls = 0
  state.pollTimer = setInterval(pollStatus, 800)
  void pollStatus()
  void pollLearning()
}

async function startSession() {
  setState('Connecting realtime voice and avatar…')
  setBackendStatus('Connecting', 'warn')
  $('start').disabled = true
  resetVisual()
  resetIntelligence()
  setTranscript('userTranscript', '', 'Waiting for the buyer…')
  setTranscript('assistantTranscript', '', "The salesperson's final spoken response will appear here.")
  try {
    const session = await jsonFetch('/sessions', { method: 'POST', body: '{}' })
    state.session = session
    await connectLiveKit(session)
    setButtons(true)
    setLive(true)
    startTimer()
    startPolling()
    setBackendStatus('Live', 'ok')
    setState('Connected — start speaking or send a rehearsal message', 'ok')
  } catch (error) {
    setState(error.message, 'error')
    setBackendStatus('Could not start', 'error')
    $('start').disabled = false
  }
}

async function sendText() {
  if (!state.session) return
  const text = $('prompt').value.trim()
  if (!text) return
  $('send').disabled = true
  try {
    await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}/text`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
    setTranscript('userTranscript', text, 'Waiting for the buyer…')
    setState('Buyer message sent — SalesOS is deciding the next move', 'ok')
  } catch (error) {
    setState(error.message, 'error')
  } finally {
    $('send').disabled = false
  }
}

async function interrupt() {
  if (!state.session) return
  try {
    await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}/interrupt`, {
      method: 'POST', body: '{}',
    })
    setState('Response paused — listening again', 'warn')
  } catch (error) {
    setState(error.message, 'error')
  }
}

async function stopSession() {
  const session = state.session
  state.session = null
  clearInterval(state.pollTimer)
  state.pollTimer = null
  state.mic?.stop()
  state.mic = null
  state.micSocket?.close()
  state.micSocket = null
  state.muted = false
  $('micLabel').textContent = 'Start mic'
  $('mic').setAttribute('aria-pressed', 'false')
  $('meterBar').style.width = '2%'
  if (state.room) {
    await state.room.disconnect()
    state.room = null
  }
  cleanupMediaElements()
  if (session) {
    await jsonFetch(`/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' }).catch(console.warn)
  }
  stopTimer()
  setLive(false)
  setButtons(false)
  setBackendStatus('System ready', 'ok')
  setState('Call ended — the learning trajectory remains available', 'ok')
}

$('start').addEventListener('click', () => void startSession())
$('stop').addEventListener('click', () => void stopSession())
$('send').addEventListener('click', () => void sendText())
$('mic').addEventListener('click', () => void enableMic().catch(error => setState(error.message, 'error')))
$('interrupt').addEventListener('click', () => void interrupt())
$('prompt').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendText()
  }
})
window.addEventListener('beforeunload', () => {
  state.mic?.stop()
  state.micSocket?.close()
  state.room?.disconnect()
})

setButtons(false, false)
resetVisual()
resetIntelligence()
setLive(false)
void checkHealth()
