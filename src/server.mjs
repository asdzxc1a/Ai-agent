import { once } from 'node:events'
import { createSalesBackendFromEnv } from './runtime/build-runtime.mjs'
import { createAvatarSessionManagerFromEnv } from './runtime/avatar-session-manager.mjs'
import { createAvatarControlServer } from './runtime/avatar-control-server.mjs'
import { SALES_SPAWN_THINKING_DESCRIPTION } from './runtime/sales-frontend.mjs'
import { createQwenSalesGateway } from './integrations/qwen-gateway.mjs'
import { prepareQwenGatewayIdentityEnvironment } from './integrations/qwen-identity.mjs'

function present(value) {
  return Boolean(String(value || '').trim())
}

function runtimeConfiguration(env = process.env) {
  const provider = String(env.QWEN_AUDIO_REALTIME_PROVIDER || 'qwen-default').trim().toLowerCase()
  const reasonerMode = String(env.SALES_REASONER_MODE || 'mock').trim().toLowerCase()
  const realtimeProviderReady = ['gpt-live', 'openai', 'gptlive', 'gpt-realtime'].includes(provider)
  const hasOpenAIKey = present(env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY)
  const hasLiveAvatarKey = present(env.LIVEAVATAR_API_KEY)
  const reasonerReady = reasonerMode === 'mock' || (
    reasonerMode === 'openai-compatible'
    && present(env.SALES_REASONER_BASE_URL)
    && present(env.SALES_REASONER_API_KEY)
    && present(env.SALES_REASONER_MODEL)
  )

  return {
    app: 'arcana-salesos',
    ui: 'cockpit-v1',
    salesOS: 'harness-v1',
    provider,
    reasonerMode,
    reasonerReady,
    liveReady: realtimeProviderReady && hasOpenAIKey && hasLiveAvatarKey,
    hasOpenAIKey,
    hasLiveAvatarKey,
    hasAvatarId: present(env.LIVEAVATAR_AVATAR_ID),
  }
}

// Qwen's configuration module reads identity settings when the Gateway package
// is dynamically imported. Prepare them before createQwenSalesGateway() so the
// sales product defaults to one Qwen owner per buyer rather than user_personal.
const qwenIdentity = prepareQwenGatewayIdentityEnvironment(process.env)

const { backend, harness } = createSalesBackendFromEnv(process.env)
const application = await createQwenSalesGateway({
  backend,
  applicationOptions: {
    autoStart: false,
    spawnThinkingDescription: SALES_SPAWN_THINKING_DESCRIPTION,
  },
})

// Keep the Qwen Gateway private to the process. The public browser talks only
// to the control server; the bridge talks to Qwen over localhost.
const qwenHost = process.env.QWEN_GATEWAY_HOST || '127.0.0.1'
const qwenPort = Number(process.env.QWEN_GATEWAY_PORT || 8765)
const qwenServer = application.start({ host: qwenHost, port: qwenPort })
if (!qwenServer.listening) await once(qwenServer, 'listening')
const qwenAddress = qwenServer.address()
const boundQwenPort = typeof qwenAddress === 'object' && qwenAddress ? qwenAddress.port : qwenPort
const gatewayOrigin = `http://${qwenHost}:${boundQwenPort}`

const avatarManager = createAvatarSessionManagerFromEnv({
  gatewayOrigin,
  env: process.env,
  harness,
  bridgeOptions: {
    log: message => console.log(`[avatar-bridge] ${message}`),
    onError: error => console.error('[avatar-bridge]', error),
  },
})

// Render and similar hosts inject PORT and require a public bind. Local
// development remains localhost-only unless explicitly configured otherwise.
const publicPort = Number(process.env.PORT || process.env.AVATAR_CONTROL_PORT || 8788)
const publicHost = process.env.AVATAR_CONTROL_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')
const avatarControl = createAvatarControlServer({
  manager: avatarManager,
  host: publicHost,
  port: publicPort,
  configuration: () => runtimeConfiguration(process.env),
  log: message => console.log(`[avatar-control] ${message}`),
})
const control = await avatarControl.start()

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[sales-avatar] ${signal}: shutting down`)
  await avatarControl.close().catch(error => console.error(error))
  await application.close().catch(error => console.error(error))
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

const config = runtimeConfiguration(process.env)
console.log(`[sales-avatar] Qwen Gateway: ${gatewayOrigin}`)
console.log(`[sales-avatar] avatar control: ${control.origin}`)
console.log(`[sales-avatar] qwen identity=${qwenIdentity.mode}${qwenIdentity.generatedSecret ? ' (process-local signing secret)' : ''}`)
console.log(`[sales-avatar] salesos=${config.salesOS} reasoner=${config.reasonerMode} realtime=${config.provider} liveReady=${config.liveReady}`)
