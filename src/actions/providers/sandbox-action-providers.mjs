import { randomUUID } from 'node:crypto'
import { SALES_ACTION_KINDS } from '../action-proposal-store.mjs'

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return [...text].slice(0, max).join('')
}

export function createSandboxActionHandlers({
  idFactory = () => randomUUID(),
} = {}) {
  if (typeof idFactory !== 'function') throw new TypeError('sandbox idFactory must be a function')
  const handlers = new Map()

  for (const kind of SALES_ACTION_KINDS) {
    handlers.set(kind, async ({ proposal } = {}) => {
      const referenceToken = clean(idFactory(), 160) || 'generated'
      const label = clean(proposal?.label, 160) || kind
      return {
        provider: 'sandbox',
        referenceId: `sandbox_${kind}_${referenceToken}`,
        status: 'completed',
        summary: `Sandbox acknowledged ${label}; no external side effect occurred.`,
        sandbox: true,
      }
    })
  }

  return handlers
}
