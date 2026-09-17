import { createSalesBackendFromEnv } from './runtime/build-runtime.mjs'
import { createQwenSalesGateway } from './integrations/qwen-gateway.mjs'

const { backend } = createSalesBackendFromEnv(process.env)
const application = await createQwenSalesGateway({ backend })

async function shutdown(signal) {
  console.log(`[sales-avatar] ${signal}: shutting down`)
  await application.close()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

console.log('[sales-avatar] Qwen Gateway started with sales backend')
console.log(`[sales-avatar] reasoner=${process.env.SALES_REASONER_MODE || 'mock'} realtime=${process.env.QWEN_AUDIO_REALTIME_PROVIDER || 'qwen-default'}`)
