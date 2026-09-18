import { randomUUID } from 'node:crypto'

export const SALES_ACTION_KINDS = Object.freeze([
  'book_demo',
  'human_handoff',
  'start_trial',
  'send_followup',
  'review_proposal',
])

export const SALES_ACTION_LABELS = Object.freeze({
  book_demo: 'Book a demo',
  human_handoff: 'Talk to a specialist',
  start_trial: 'Start a trial',
  send_followup: 'Send a follow-up',
  review_proposal: 'Review a proposal',
})

const ALLOWED_KINDS = new Set(SALES_ACTION_KINDS)

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return [...text].slice(0, max).join('')
}

function clone(value) { return value == null ? value : structuredClone(value) }

export class ActionProposalError extends Error {
  constructor(message, code = 'ACTION_PROPOSAL_ERROR') {
    super(message)
    this.name = 'ActionProposalError'
    this.code = code
  }
}

export class InMemoryActionProposalStore {
  #records = new Map()

  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.clock = clock
  }

  create({ sessionId, taskId = null, kind, label = '', description = '' } = {}) {
    const sid = clean(sessionId, 200)
    const actionKind = clean(kind, 80)
    if (!sid) throw new ActionProposalError('Action proposal requires sessionId', 'INVALID_SESSION')
    if (!ALLOWED_KINDS.has(actionKind)) throw new ActionProposalError(`Unsupported action kind: ${actionKind}`, 'UNSUPPORTED_ACTION')
    const now = this.clock()
    const record = {
      id: `action_${randomUUID()}`,
      schemaVersion: 'sales.action-proposal.v1',
      sessionId: sid,
      taskId: clean(taskId, 200) || null,
      kind: actionKind,
      label: clean(label, 160) || SALES_ACTION_LABELS[actionKind],
      description: clean(description, 500),
      status: 'pending',
      requiresConfirmation: true,
      executed: false,
      createdAt: now,
      confirmedAt: null,
      cancelledAt: null,
      supersededAt: null,
      supersededByProposalId: null,
      executedAt: null,
      failedAt: null,
      receipt: null,
      error: null,
    }
    this.#records.set(record.id, record)
    return clone(record)
  }

  get(id, { sessionId = null } = {}) {
    const record = this.#records.get(clean(id, 240))
    if (!record) return null
    if (sessionId && record.sessionId !== clean(sessionId, 200)) return null
    return clone(record)
  }

  list({ sessionId = null, status = null } = {}) {
    const sid = clean(sessionId, 200)
    const wantedStatus = clean(status, 80)
    return [...this.#records.values()]
      .filter(record => !sid || record.sessionId === sid)
      .filter(record => !wantedStatus || record.status === wantedStatus)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone)
  }

  supersedePending({ sessionId, kind, supersededByProposalId } = {}) {
    const sid = clean(sessionId, 200)
    const actionKind = clean(kind, 80)
    const replacementId = clean(supersededByProposalId, 240)
    if (!sid) throw new ActionProposalError('Superseding actions requires sessionId', 'INVALID_SESSION')
    if (!ALLOWED_KINDS.has(actionKind)) throw new ActionProposalError(`Unsupported action kind: ${actionKind}`, 'UNSUPPORTED_ACTION')
    if (!replacementId || !this.#records.has(replacementId)) {
      throw new ActionProposalError('Superseding actions requires a valid replacement proposal', 'NOT_FOUND')
    }
    const replacement = this.#records.get(replacementId)
    if (replacement.sessionId !== sid || replacement.kind !== actionKind) {
      throw new ActionProposalError('Replacement proposal does not match the action scope', 'SESSION_MISMATCH')
    }
    if (replacement.status !== 'pending') {
      throw new ActionProposalError('Replacement proposal must still be pending', 'INVALID_TRANSITION')
    }

    const now = this.clock()
    const changed = []
    for (const record of this.#records.values()) {
      if (record.id === replacementId) break
      if (record.sessionId !== sid || record.kind !== actionKind || record.status !== 'pending') continue
      record.status = 'superseded'
      record.supersededAt = now
      record.supersededByProposalId = replacementId
      changed.push(clone(record))
    }
    return changed
  }

  confirm(id, { sessionId } = {}) {
    const record = this.#mutable(id, sessionId)
    if (record.status === 'confirmed') return clone(record)
    if (record.status !== 'pending') throw new ActionProposalError(`Cannot confirm action in status ${record.status}`, 'INVALID_TRANSITION')
    record.status = 'confirmed'
    record.confirmedAt = this.clock()
    return clone(record)
  }

  cancel(id, { sessionId } = {}) {
    const record = this.#mutable(id, sessionId)
    if (record.status === 'cancelled') return clone(record)
    if (!['pending', 'confirmed'].includes(record.status)) {
      throw new ActionProposalError(`Cannot cancel action in status ${record.status}`, 'INVALID_TRANSITION')
    }
    record.status = 'cancelled'
    record.cancelledAt = this.clock()
    return clone(record)
  }

  beginExecution(id, { sessionId } = {}) {
    const record = this.#mutable(id, sessionId)
    if (record.status !== 'confirmed') {
      throw new ActionProposalError('Action must be explicitly confirmed before execution', 'CONFIRMATION_REQUIRED')
    }
    record.status = 'executing'
    record.error = null
    return clone(record)
  }

  completeExecution(id, { sessionId, receipt = null } = {}) {
    const record = this.#mutable(id, sessionId)
    if (record.status !== 'executing') throw new ActionProposalError(`Cannot complete action in status ${record.status}`, 'INVALID_TRANSITION')
    record.status = 'executed'
    record.executed = true
    record.executedAt = this.clock()
    record.receipt = receipt == null ? null : clone(receipt)
    return clone(record)
  }

  failExecution(id, error, { sessionId } = {}) {
    const record = this.#mutable(id, sessionId)
    if (record.status !== 'executing') throw new ActionProposalError(`Cannot fail action in status ${record.status}`, 'INVALID_TRANSITION')
    record.status = 'failed'
    record.failedAt = this.clock()
    record.error = clean(error?.message || error, 500) || 'Action execution failed'
    return clone(record)
  }

  #mutable(id, sessionId) {
    const actionId = clean(id, 240)
    const record = this.#records.get(actionId)
    if (!record) throw new ActionProposalError(`Unknown action proposal: ${actionId}`, 'NOT_FOUND')
    if (sessionId && record.sessionId !== clean(sessionId, 200)) {
      throw new ActionProposalError('Action proposal belongs to another sales session', 'SESSION_MISMATCH')
    }
    return record
  }
}
