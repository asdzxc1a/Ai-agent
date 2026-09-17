import { randomUUID } from 'node:crypto'
import {
  ActionProposalError,
  SALES_ACTION_KINDS,
} from './action-proposal-store.mjs'

const ALLOWED_KINDS = new Set(SALES_ACTION_KINDS)

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return [...text].slice(0, max).join('')
}

export function sanitizeActionReceipt(raw = {}) {
  const receipt = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    provider: clean(receipt.provider, 120) || 'unknown',
    referenceId: clean(receipt.referenceId, 240) || null,
    status: clean(receipt.status, 80) || 'completed',
    summary: clean(receipt.summary, 500) || '',
    sandbox: receipt.sandbox === true,
  }
}

export class ActionToolRegistry {
  #handlers = new Map()

  register(kind, handler) {
    const actionKind = clean(kind, 80)
    if (!ALLOWED_KINDS.has(actionKind)) throw new ActionProposalError(`Unsupported action kind: ${actionKind}`, 'UNSUPPORTED_ACTION')
    if (typeof handler !== 'function') throw new TypeError(`Action handler for ${actionKind} must be a function`)
    this.#handlers.set(actionKind, handler)
    return this
  }

  has(kind) { return this.#handlers.has(clean(kind, 80)) }

  async run(kind, input) {
    const actionKind = clean(kind, 80)
    const handler = this.#handlers.get(actionKind)
    if (!handler) throw new ActionProposalError(`No execution tool registered for ${actionKind}`, 'ACTION_TOOL_UNAVAILABLE')
    return handler(input)
  }
}

export class SalesActionExecutor {
  constructor({ store, tools, harness = null } = {}) {
    if (!store) throw new TypeError('SalesActionExecutor requires store')
    if (!tools) throw new TypeError('SalesActionExecutor requires tools')
    this.store = store
    this.tools = tools
    this.harness = harness
  }

  async execute(proposalId, { sessionId, context = {} } = {}) {
    const proposal = this.store.get(proposalId, { sessionId })
    if (!proposal) throw new ActionProposalError(`Unknown action proposal: ${proposalId}`, 'NOT_FOUND')

    // Idempotent successful replay: never run a side-effect tool twice merely
    // because an HTTP client retried after losing the response.
    if (proposal.status === 'executed') return proposal
    if (!this.tools.has(proposal.kind)) {
      throw new ActionProposalError(`No execution tool registered for ${proposal.kind}`, 'ACTION_TOOL_UNAVAILABLE')
    }

    const executing = this.store.beginExecution(proposal.id, { sessionId })
    this.harness?.recordActionLifecycle?.({ sessionId: proposal.sessionId, type: 'sales.action.executing', proposal: executing })

    try {
      const rawReceipt = await this.tools.run(proposal.kind, {
        proposal: structuredClone(executing),
        context: structuredClone(context || {}),
      })
      const receipt = sanitizeActionReceipt(rawReceipt)
      const completed = this.store.completeExecution(proposal.id, { sessionId, receipt })
      this.harness?.recordActionLifecycle?.({ sessionId: proposal.sessionId, type: 'sales.action.executed', proposal: completed })
      return completed
    } catch (error) {
      const failed = this.store.failExecution(proposal.id, error, { sessionId })
      this.harness?.recordActionLifecycle?.({ sessionId: proposal.sessionId, type: 'sales.action.failed', proposal: failed })
      throw error
    }
  }
}

export function createSandboxActionToolRegistry({ idFactory = () => randomUUID() } = {}) {
  const registry = new ActionToolRegistry()
  for (const kind of SALES_ACTION_KINDS) {
    registry.register(kind, async ({ proposal }) => ({
      provider: 'sandbox',
      referenceId: `sandbox_${kind}_${idFactory()}`,
      status: 'completed',
      summary: `Sandbox acknowledged ${proposal.label || kind}; no external side effect occurred.`,
      sandbox: true,
      // Deliberately ignored by sanitizeActionReceipt if a test/custom handler
      // adds arbitrary fields, credentials, PII, or provider payloads.
    }))
  }
  return registry
}
