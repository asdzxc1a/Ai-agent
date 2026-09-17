import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { GatewayClient } from 'qwen-audio-agent/gateway-client-sdk'
import {
  GatewayClientCapability,
  GatewayClientProtocolEvent,
} from 'qwen-audio-agent/gateway-client-protocol'
import {
  GatewayClientEvent,
  GatewayServerEvent,
} from 'qwen-audio-agent/realtime-events'
import { HeyGenAudioSink } from './heygen-audio-sink.mjs'

function timeoutPromise(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}

export class QwenHeyGenBridge {
  constructor({
    gatewayOrigin,
    liveAvatarClient,
    outputVoice = '',
    gatewaySessionId = `sales-${randomUUID()}`,
    clientFactory = options => new GatewayClient(options),
    createGatewaySocket = url => new WebSocket(url),
    audioSinkFactory = () => new HeyGenAudioSink(),
    log = () => {},
    onError = () => {},
  } = {}) {
    if (!gatewayOrigin) throw new TypeError('gatewayOrigin is required')
    if (!liveAvatarClient) throw new TypeError('liveAvatarClient is required')
    this.gatewayOrigin = gatewayOrigin
    this.liveAvatarClient = liveAvatarClient
    this.outputVoice = outputVoice
    this.gatewaySessionId = gatewaySessionId
    this.clientFactory = clientFactory
    this.createGatewaySocket = createGatewaySocket
    this.audioSinkFactory = audioSinkFactory
    this.log = log
    this.onError = onError
    this.client = null
    this.audioSink = null
    this.avatarSession = null
    this.inputSampleRate = null
    this.playbackStarted = new Set()
    this.voiceReadyResolve = null
    this.gatewayReadyResolve = null
    this.gatewayReadyReject = null
    this.voiceReadyReject = null
  }

  async start({ timeoutMs = 30_000 } = {}) {
    if (this.client) throw new Error('QwenHeyGenBridge is already started')
    this.avatarSession = await this.liveAvatarClient.startSession()
    this.audioSink = this.audioSinkFactory()
    await this.audioSink.connect(this.avatarSession, { timeoutMs })

    const gatewayReady = new Promise((resolve, reject) => {
      this.gatewayReadyResolve = resolve
      this.gatewayReadyReject = reject
    })
    const voiceReady = new Promise((resolve, reject) => {
      this.voiceReadyResolve = resolve
      this.voiceReadyReject = reject
    })

    const wsUrl = new URL('/api/realtime', this.gatewayOrigin)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl.searchParams.set('sessionId', this.gatewaySessionId)

    this.client = this.clientFactory({
      url: wsUrl.toString(),
      createSocket: this.createGatewaySocket,
      clientType: 'sales-avatar-bridge',
      clientVersion: '0.3.0',
      clientInstanceId: `sales-avatar-${randomUUID()}`,
      clientLabel: 'Sales Avatar Bridge',
      reconnect: true,
      capabilities: [
        GatewayClientCapability.INPUT_AUDIO,
        GatewayClientCapability.INPUT_TEXT,
        GatewayClientCapability.PLAYBACK_RECEIPTS,
        GatewayClientCapability.TASK_COMMANDS,
        GatewayClientCapability.PERMISSION_RESPOND,
        GatewayClientCapability.INPUT_RESPOND,
        GatewayClientCapability.SESSION_OUTPUT_VOICE,
      ],
      locale: 'en-US',
      timeZone: 'UTC',
      configure: {
        voiceEnabled: true,
        inputEnabled: true,
        outputEnabled: true,
        textOnly: false,
        ...(this.outputVoice ? { outputVoice: this.outputVoice } : {}),
      },
      onStatus: status => {
        if (status.state === 'ready') this.gatewayReadyResolve?.()
        if (status.state === 'unavailable') {
          const error = status.error || new Error('Qwen Gateway unavailable')
          this.gatewayReadyReject?.(error)
          this.voiceReadyReject?.(error)
          this.onError(error)
        }
      },
      onEvent: event => this.handleEvent(event),
    })

    this.client.start()
    try {
      await Promise.race([gatewayReady, timeoutPromise(timeoutMs, 'Timed out waiting for Qwen Gateway readiness')])
      this.client.send({ type: GatewayClientEvent.UNMUTE })
      this.client.send({ type: GatewayClientEvent.INPUT_UNMUTE })
      const ready = await Promise.race([voiceReady, timeoutPromise(timeoutMs, 'Timed out waiting for Qwen realtime voice readiness')])
      this.inputSampleRate = ready.inputSampleRate
      return {
        ...this.avatarSession,
        gatewaySessionId: this.gatewaySessionId,
        inputSampleRate: this.inputSampleRate,
      }
    } catch (error) {
      await this.close()
      throw error
    }
  }

  handleEvent(event) {
    if (!event?.type) return
    if (event.type === GatewayServerEvent.VOICE_READY) {
      this.voiceReadyResolve?.(event)
      return
    }
    if (event.type === GatewayServerEvent.AUDIO_DELTA) {
      if (Number(event.sampleRate) !== 24_000) {
        const error = new Error(`HeyGen LITE requires 24 kHz PCM; Qwen emitted ${event.sampleRate}`)
        this.onError(error)
        return
      }
      if (event.responseId && !this.playbackStarted.has(event.responseId)) {
        this.playbackStarted.add(event.responseId)
        this.client?.send({ type: GatewayClientEvent.PLAYBACK_STARTED, responseId: event.responseId })
      }
      this.audioSink?.writePcm24k(event.audio)
      return
    }
    if (event.type === GatewayServerEvent.AUDIO_DONE) {
      if (event.responseId) {
        if (!this.playbackStarted.has(event.responseId)) {
          this.playbackStarted.add(event.responseId)
          this.client?.send({ type: GatewayClientEvent.PLAYBACK_STARTED, responseId: event.responseId })
        }
        this.client?.send({ type: GatewayClientEvent.PLAYBACK_ENDED, responseId: event.responseId })
        this.playbackStarted.delete(event.responseId)
      }
      return
    }
    if (event.type === GatewayServerEvent.RESPONSE_INTERRUPTED || event.type === GatewayServerEvent.PLAYBACK_CLEAR) {
      this.audioSink?.interrupt()
      if (event.responseId) {
        this.client?.send({
          type: GatewayClientEvent.PLAYBACK_CANCELLED,
          responseId: event.responseId,
          reason: 'interrupted',
        })
        this.playbackStarted.delete(event.responseId)
      } else {
        for (const responseId of this.playbackStarted) {
          this.client?.send({ type: GatewayClientEvent.PLAYBACK_CANCELLED, responseId, reason: 'playback-clear' })
        }
        this.playbackStarted.clear()
      }
      return
    }
    if (event.type === GatewayServerEvent.ERROR) {
      this.onError(new Error(event.message || 'Qwen realtime error'))
    }
  }

  sendInputAudio(base64Pcm16) {
    if (!this.client) throw new Error('QwenHeyGenBridge is not started')
    if (!base64Pcm16) return false
    return this.client.send({
      type: GatewayClientProtocolEvent.INPUT_AUDIO_APPEND,
      audio: base64Pcm16,
    })
  }

  interrupt() {
    if (!this.client) return false
    this.audioSink?.interrupt()
    return this.client.send({ type: GatewayClientEvent.INTERRUPT })
  }

  async close() {
    const client = this.client
    const sink = this.audioSink
    const avatar = this.avatarSession
    this.client = null
    this.audioSink = null
    this.avatarSession = null
    this.playbackStarted.clear()
    client?.stop()
    await sink?.close?.()
    if (avatar?.sessionId) {
      await this.liveAvatarClient.stopSession(avatar.sessionId).catch(error => {
        this.log(`LiveAvatar stop failed: ${error.message}`)
      })
    }
  }
}
