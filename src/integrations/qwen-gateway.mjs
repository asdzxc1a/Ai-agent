/**
 * Public integration seam for Qwen Audio Agent.
 *
 * The sales backend stays protocol-neutral. Qwen owns task lifecycle,
 * realtime-frontend orchestration, memory/tools and client transport.
 */
export async function createQwenSalesGateway({
  backend,
  applicationOptions = {},
} = {}) {
  if (!backend) throw new TypeError('backend is required')

  const sdk = await import('qwen-audio-agent/backend-adapter-sdk')
  const gateway = await import('qwen-audio-agent/gateway-application')

  const agent = sdk.createBackendAgentHost(backend, {
    name: 'Sales backend',
  })

  return gateway.createGatewayApplication({
    agent,
    ...applicationOptions,
  })
}
