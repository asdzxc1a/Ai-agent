/** Integration seam for Qwen Audio Agent. */
export async function createQwenSalesGateway({ backend }) {
  let sdk
  let gateway
  try {
    sdk = await import('qwen-audio-agent/backend-adapter-sdk')
    gateway = await import('qwen-audio-agent/gateway-application')
  } catch (error) {
    throw new Error(`qwen-audio-agent is not installed yet: ${error.message}`)
  }
  const agent = sdk.createBackendAgentHost(backend)
  return gateway.createGatewayApplication({ agent })
}
