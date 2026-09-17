export { createSalesState, applyStatePatch, SALES_STAGES } from './domain/sales-state.mjs'
export { extractDeterministicSalesFacts } from './domain/fact-extractor.mjs'
export {
  canonicalizeSalesDecision,
  canonicalizeSalesVisual,
  sanitizeSalesStatePatch,
} from './domain/sales-decision.mjs'
export {
  SALES_VISUAL_MEDIA_TYPE,
  createSalesVisualArtifact,
  salesVisualFromArtifact,
  salesVisualsFromArtifacts,
} from './domain/sales-artifacts.mjs'
export { InMemorySalesSessionStore } from './runtime/session-store.mjs'
export { AvatarSessionManager, createAvatarSessionManagerFromEnv } from './runtime/avatar-session-manager.mjs'
export { createAvatarControlServer } from './runtime/avatar-control-server.mjs'
export { ProductCatalog } from './tools/product-catalog.mjs'
export { selectSalesOutline } from './strategy/doga.mjs'
export { MockSalesReasoner } from './reasoners/mock-reasoner.mjs'
export { OpenAICompatibleSalesReasoner } from './reasoners/openai-compatible.mjs'
export { SalesBackendAdapter } from './backend/sales-backend.mjs'
export { SalesBackendWorkRuntime } from './integrations/sales-backend-runtime.mjs'
export {
  bootstrapQwenGatewayIdentity,
  cookiePairFromSetCookie,
  mergeGatewaySocketOptions,
  prepareQwenGatewayIdentityEnvironment,
} from './integrations/qwen-identity.mjs'
export { LiveAvatarClient, LiveAvatarApiError, createLiveAvatarClientFromEnv } from './integrations/liveavatar-client.mjs'
export { HeyGenAudioSink } from './integrations/heygen-audio-sink.mjs'
export { QwenHeyGenBridge } from './integrations/qwen-heygen-bridge.mjs'
