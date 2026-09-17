import { once } from 'node:events'
import { createSalesBackendFromEnv } from './runtime/build-runtime.mjs'
import { createAvatarSessionManagerFromEnv } from './runtime/avatar-session-manager.mjs'
import { createAvatarControlServer } from './runtime/avatar-control-server.mjs'
import { SALES_SPAWN_THINKING_DESCRIPTION } from './runtime/sales-frontend.mjs'
import { createQwenSalesGateway } from './integrations/qwen-gateway.mjs'
import { prepareQwenGatewayIdentityEnvironment } from './integrations/qwen-identity.mjs'

// Qwen's configuration module reads identity settings when the Gateway package
// is dynamically imported. Prepare them before createQwenSalesGateway() so the
// sales product defaults to one Qwen owner per buyer rather than user_personal.
const qwenIdentity = prepareQwenGatewayIdentityEnvironment(process.env)

const { backend } = createSalesBackendFromEnv(process.env)
const application = await createQwenSalesGateway({
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
const gatewayOrigin = `http://${qwenHost}:${boundQwenPort}`

const avatarManager = createAvatarSessionManagerFromEnv({
  gatewayOrigin,
  env: process.env,
  bridgeOptions: {
    log: message => console.log(`[avatar-bridge] ${message}`),
    onError: error => console.error('[avatar-bridge]', error),
  },
})
const avatarControl = createAvatarControlServer({
  manager: avatarManager,
  host: process.env.AVATAR_CONTROL_HOST || '127.0.0.1',
  port: Number(process.env.AVATAR_CONTROL_PORT || 8788),
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

console.log(`[sales-avatar] Qwen Gateway: ${gatewayOrigin}`)
console.log(`[sales-avatar] avatar control: ${control.origin}`)
console.log(`[sales-avatar] qwen identity=${qwenIdentity.mode}${qwenIdentity.generatedSecret ? ' (process-local signing secret)' : ''}`)
console.log(`[sales-avatar] reasoner=${process.env.SALES_REASONER_MODE || 'mock'} realtime=${process.env.QWEN_AUDIO_REALTIME_PROVIDER || 'qwen-default'}`)
