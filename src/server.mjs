import { once } from 'node:events'
import { createSalesBackendFromEnv } from './runtime/build-runtime.mjs'
import { createAvatarSessionManagerFromEnv } from './runtime/avatar-session-manager.mjs'
import { createAvatarControlServer } from './runtime/avatar-control-server.mjs'
import { SALES_SPAWN_THINKING_DESCRIPTION } from './runtime/sales-frontend.mjs'
import { createQwenSalesGateway } from './integrations/qwen-gateway.mjs'
import { prepareQwenGatewayIdentityEnvironment } from './integrations/qwen-identity.mjs'

function present(value) { return Boolean(String(value || '').trim()) }
function nativeVoiceMode(env = process.env) {
  return ['native-gpt-live', 'gpt-live-native', 'native-live'].includes(
    String(env.SALES_VOICE_MODE || '').trim().toLowerCase(),
  )
}

function runtimeConfiguration(env = process.env, { actionExecutionMode = null } = {}) {
  const nativeLive = nativeVoiceMode(env)
  const voiceMode = nativeLive ? 'native-gpt-live' : 'qwen-heygen'
  const provider = nativeLive ? 'gpt-live-1' : String(env.QWEN_AUDIO_REALTIME_PROVIDER || 'qwen-default').trim().toLowerCase()
  const reasonerMode = String(env.SALES_REASONER_MODE || 'mock').trim().toLowerCase()
  const realtimeProviderReady = ['gpt-live', 'openai', 'gptlive', 'gpt-realtime'].includes(provider)
  const hasOpenAIKey = present(env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY)
  const hasLiveAvatarKey = present(env.LIVEAVATAR_API_KEY)
  const hasReasonerKey = present(env.SALES_REASONER_API_KEY)
  const reasonerReady = reasonerMode === 'mock'
    || (reasonerMode === 'deepseek' && hasReasonerKey)
    || (
      reasonerMode === 'openai-compatible'
      && present(env.SALES_REASONER_BASE_URL)
      && hasReasonerKey
      && present(env.SALES_REASONER_MODEL)
    )
  const liveReady = nativeLive
    ? hasOpenAIKey && reasonerReady
    : realtimeProviderReady && hasOpenAIKey && hasLiveAvatarKey && reasonerReady

  return {
    app: 'arcana-salesos',
    ui: 'cockpit-v1',
    salesOS: 'harness-v1',
    actionControl: 'proposal-confirmation-v1',
    actionExecutionMode: actionExecutionMode || String(env.SALES_ACTION_EXECUTION_MODE || 'disabled').trim().toLowerCase(),
    voiceMode,
    provider,
    liveModel: nativeLive ? String(env.GPT_LIVE_MODEL || 'gpt-live-1') : String(env.GPT_LIVE_REALTIME_MODEL || ''),
    reasonerMode,
    reasonerModel: reasonerMode === 'deepseek' ? String(env.SALES_REASONER_MODEL || 'deepseek-flash') : String(env.SALES_REASONER_MODEL || ''),
    reasonerReady,
    liveReady,
    hasOpenAIKey,
    hasReasonerKey,
    hasLiveAvatarKey,
    hasAvatarId: present(env.LIVEAVATAR_AVATAR_ID),
  }
}

const nativeLive = nativeVoiceMode(process.env)
const {
  backend,
  harness,
  actionProposals,
  actionExecution,
  actionExecutor,
} = createSalesBackendFromEnv(process.env)

let application = null
let gatewayOrigin = null
let qwenIdentity = null

if (!nativeLive) {
  qwenIdentity = prepareQwenGatewayIdentityEnvironment(process.env)
  application = await createQwenSalesGateway({
    backend,
    applicationOptions: {
      autoStart: false,
      spawnThinkingDescription: SALES_SPAWN_THINKING_DESCRIPTION,
    },
  })

  const qwenHost = process.env.QWEN_GATEWAY_HOST || '127.0.0.1'
  const qwenPort = Number(process.env.QWEN_GATEWAY_PORT || 8765)
  const qwenServer = application.start({ host: qwenHost, port: qwenPort })
  if (!qwenServer.listening) await once(qwenServer, 'listening')
  const qwenAddress = qwenServer.address()
  const boundQwenPort = typeof qwenAddress === 'object' && qwenAddress ? qwenAddress.port : qwenPort
  gatewayOrigin = `http://${qwenHost}:${boundQwenPort}`
}

const avatarManager = createAvatarSessionManagerFromEnv({
  gatewayOrigin,
  env: process.env,
  backend,
  harness,
  actionProposals,
  actionExecutor,
  bridgeOptions: {
    log: message => console.log(`[voice-bridge] ${message}`),
    onError: error => console.error('[voice-bridge]', error),
  },
})

const publicPort = Number(process.env.PORT || process.env.AVATAR_CONTROL_PORT || 8788)
const publicHost = process.env.AVATAR_CONTROL_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')
const avatarControl = createAvatarControlServer({
  manager: avatarManager,
  host: publicHost,
  port: publicPort,
  configuration: () => runtimeConfiguration(process.env, { actionExecutionMode: actionExecution.mode }),
  log: message => console.log(`[avatar-control] ${message}`),
})
const control = await avatarControl.start()

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[sales-avatar] ${signal}: shutting down`)
  await avatarControl.close().catch(error => console.error(error))
  await application?.close?.().catch(error => console.error(error))
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

const config = runtimeConfiguration(process.env, { actionExecutionMode: actionExecution.mode })
if (gatewayOrigin) console.log(`[sales-avatar] Qwen Gateway: ${gatewayOrigin}`)
console.log(`[sales-avatar] control: ${control.origin}`)
if (qwenIdentity) console.log(`[sales-avatar] qwen identity=${qwenIdentity.mode}${qwenIdentity.generatedSecret ? ' (process-local signing secret)' : ''}`)
console.log(`[sales-avatar] voice=${config.voiceMode}/${config.liveModel || config.provider} salesos=${config.salesOS} brain=${config.reasonerMode}/${config.reasonerModel || 'mock'} actions=${config.actionControl}/${config.actionExecutionMode} liveReady=${config.liveReady}`)
