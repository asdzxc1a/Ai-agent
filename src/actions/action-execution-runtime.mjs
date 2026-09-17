import {
  ActionToolRegistry,
  SalesActionExecutor,
  createSandboxActionToolRegistry,
} from './action-executor.mjs'

export const SALES_ACTION_EXECUTION_MODES = Object.freeze([
  'disabled',
  'sandbox',
])

function normalizeMode(value) {
  return String(value || 'disabled').trim().toLowerCase()
}

export function createActionExecutionRuntime({ env = process.env, store, harness = null } = {}) {
  if (!store) throw new TypeError('createActionExecutionRuntime requires store')

  const mode = normalizeMode(env.SALES_ACTION_EXECUTION_MODE)
  if (!SALES_ACTION_EXECUTION_MODES.includes(mode)) {
    throw new Error(`Unsupported SALES_ACTION_EXECUTION_MODE: ${mode}`)
  }

  if (mode === 'disabled') {
    return {
      mode,
      enabled: false,
      tools: new ActionToolRegistry(),
      executor: null,
    }
  }

  const tools = createSandboxActionToolRegistry()
  const executor = new SalesActionExecutor({ store, tools, harness })
  return {
    mode,
    enabled: true,
    tools,
    executor,
  }
}
