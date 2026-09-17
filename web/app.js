import { Room, RoomEvent, Track } from '/vendor/livekit-client.esm.mjs'
import { startMicCapture } from './mic.js'
import { renderSalesVisual } from './sales-visual.js'

const $ = id => document.getElementById(id)
const state = {
  session: null,
  room: null,
  mic: null,
  micSocket: null,
  muted: false,
  pollTimer: null,
  visualKey: '',
}

function setState(text, kind = '') {
  $('state').textContent = text
  $('state').dataset.kind = kind
}

function setButtons(active) {
  $('start').disabled = active
  $('stop').disabled = !active
  $('send').disabled = !active
  $('mic').disabled = !active
  $('interrupt').disabled = !active
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

async function connectLiveKit(session) {
  const room = new Room({ adaptiveStream: true, dynacast: true })
  room.on(RoomEvent.TrackSubscribed, track => {
    if (![Track.Kind.Video, Track.Kind.Audio].includes(track.kind)) return
    const element = track.attach()
    element.autoplay = true
    if (track.kind === Track.Kind.Video) {
      element.playsInline = true
      element.className = 'avatar-video'
    } else {
      element.className = 'avatar-audio'
    }
    $('stage').appendChild(element)
  })
  room.on(RoomEvent.TrackUnsubscribed, track => {
    track.detach().forEach(element => element.remove())
  })
  room.on(RoomEvent.Disconnected, () => setState('LiveKit disconnected', 'warn'))
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
    $('mic').textContent = state.muted ? 'Unmute mic' : 'Mute mic'
    return
  }

  const socket = new WebSocket(controlWsUrl(`/sessions/${encodeURIComponent(state.session.id)}/audio`))
  socket.binaryType = 'arraybuffer'
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Mic socket timed out')), 5_000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Mic socket failed')) }, { once: true })
  })
  state.micSocket = socket
  state.mic = await startMicCapture(buffer => {
    if (socket.readyState === WebSocket.OPEN) socket.send(buffer)
  }, level => {
    $('meterBar').style.width = `${Math.min(100, Math.max(2, level * 450))}%`
  })
  $('mic').textContent = 'Mute mic'
  setState('Mic live — speak naturally', 'ok')
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
    if (metrics.lastUserTranscript) $('userTranscript').textContent = metrics.lastUserTranscript
    if (metrics.lastAssistantTranscript) $('assistantTranscript').textContent = metrics.lastAssistantTranscript
  } catch (error) {
    console.warn(error)
  }
}

function startPolling() {
  clearInterval(state.pollTimer)
  state.pollTimer = setInterval(pollStatus, 750)
  void pollStatus()
}

async function startSession() {
  setState('Starting LiveAvatar + GPT-Live…')
  $('start').disabled = true
  resetVisual()
  try {
    const session = await jsonFetch('/sessions', { method: 'POST', body: '{}' })
    state.session = session
    await connectLiveKit(session)
    setButtons(true)
    startPolling()
    setState('Connected — type a test prompt or enable the mic', 'ok')
  } catch (error) {
    setState(error.message, 'error')
    $('start').disabled = false
    throw error
  }
}

async function sendText() {
  if (!state.session) return
  const text = $('prompt').value.trim()
  if (!text) return
  await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}/text`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  $('userTranscript').textContent = text
  setState('Prompt sent', 'ok')
}

async function interrupt() {
  if (!state.session) return
  await jsonFetch(`/sessions/${encodeURIComponent(state.session.id)}/interrupt`, {
    method: 'POST', body: '{}',
  })
  setState('Interrupted', 'warn')
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
  $('mic').textContent = 'Start mic'
  $('meterBar').style.width = '2%'
  if (state.room) {
    await state.room.disconnect()
    state.room = null
  }
  cleanupMediaElements()
  if (session) {
    await jsonFetch(`/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' }).catch(console.warn)
  }
  setButtons(false)
  resetVisual()
  setState('Stopped')
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

setButtons(false)
resetVisual()
