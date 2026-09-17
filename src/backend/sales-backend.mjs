import { applyStatePatch } from '../domain/sales-state.mjs'
import { selectSalesOutline } from '../strategy/doga.mjs'

function clean(value) {
  return String(value || '').trim()
}

function cancellationError(taskId) {
  const error = new Error(`Task ${taskId} was cancelled`)
  error.code = 'WORK_CANCELLED'
  return error
}

/**
 * Protocol-neutral sales backend that implements Qwen Audio Agent's BackendPort.
 * Sales truth remains server-owned; the reasoner only proposes decisions.
 */
export class SalesBackendAdapter {
  #started = false
  #closed = false
  #active = new Map()
  #subscribers = new Set()

  constructor({ reasoner, sessions, catalog }) {
    this.reasoner = reasoner
    this.sessions = sessions
    this.catalog = catalog
  }

  describe() {
    return {
      configured: true,
      enabled: true,
      protocol: 'sales-backend',
      label: 'Sales Backend',
      capabilities: {
        cancel: true,
        authorization: false,
        interactiveInput: false,
        taskUpdates: 'activity',
      },
    }
  }

  async start() {
    if (this.#closed) throw new Error('Sales backend is closed')
    this.#started = true
    return { ok: true, status: 'ready' }
  }

  async health() {
    return {
      ok: this.#started && !this.#closed,
      status: this.#started && !this.#closed ? 'ready' : 'stopped',
    }
  }

  #emit(event) {
    for (const listener of this.#subscribers) {
      try {
        listener(event)
      } catch {
        // Observers must never interrupt sales execution.
      }
    }
  }

  async submit(work, { signal } = {}) {
    // Accept `taskId` only as a temporary backwards-compatible alias for the
    // original foundation tests. Qwen's actual contract uses `id`.
    const taskId = clean(work?.id ?? work?.taskId)
    const ownerId = clean(work?.ownerId)
    const input = clean(
      work?.instruction
      || work?.objective
      || work?.originalRequest
      || work?.message,
    )
    if (!taskId || !ownerId || !input) {
      throw new Error('BackendPort submit requires task id, owner and input')
    }
    if (this.#active.has(taskId)) {
      throw new Error(`Task ${taskId} is already active`)
    }

    await this.start()

    const controller = new AbortController()
    const record = {
      taskId,
      ownerId,
      controller,
    }
    this.#active.set(taskId, record)

    let detachExternalAbort = null
    if (signal) {
      const abortFromCaller = () => {
        if (!controller.signal.aborted) {
          controller.abort(signal.reason || cancellationError(taskId))
        }
      }
      if (signal.aborted) abortFromCaller()
      else {
        signal.addEventListener('abort', abortFromCaller, { once: true })
        detachExternalAbort = () => signal.removeEventListener('abort', abortFromCaller)
      }
    }

    this.#emit({
      type: 'backend.activity',
      taskId,
      ownerId,
      activity: {
        id: 'sales-decision',
        kind: 'plan',
        status: 'running',
        label: 'Sales decision',
      },
    })

    const cancelled = new Promise((_, reject) => {
      const rejectCancellation = () => {
        reject(controller.signal.reason || cancellationError(taskId))
      }
      if (controller.signal.aborted) rejectCancellation()
      else controller.signal.addEventListener('abort', rejectCancellation, { once: true })
    })

    try {
      const sessionId = clean(work?.sessionId) || ownerId
      const state = this.sessions.ensure(sessionId)
      const strategy = selectSalesOutline(state, input)

      const decision = await Promise.race([
        this.reasoner.decide({
          state,
          turn: input,
          strategy,
          catalog: this.catalog,
          signal: controller.signal,
        }),
        cancelled,
      ])

      if (controller.signal.aborted) {
        throw controller.signal.reason || cancellationError(taskId)
      }

      const nextState = applyStatePatch(state, decision.statePatch ?? {})
      this.sessions.set(sessionId, nextState)

      this.#emit({
        type: 'backend.activity',
        taskId,
        ownerId,
        activity: {
          id: 'sales-decision',
          kind: 'plan',
          status: 'completed',
          label: 'Sales decision',
        },
      })

      const artifacts = decision.visual
        ? [{ type: 'sales.visual', data: decision.visual }]
        : []

      if (decision.visual) {
        this.#emit({
          type: 'backend.artifact',
          taskId,
          ownerId,
          artifact: decision.visual,
        })
      }

      // BackendPort final outcomes intentionally contain only frontend-safe
      // factual content and artifacts. Internal sales state stays server-side.
      return {
        content: clean(decision.content),
        artifacts,
      }
    } finally {
      detachExternalAbort?.()
      if (this.#active.get(taskId) === record) this.#active.delete(taskId)
    }
  }

  status(taskId, { ownerId } = {}) {
    const id = clean(taskId)
    if (!id) {
      return {
        ok: this.#started && !this.#closed,
        status: this.#started && !this.#closed ? 'ready' : 'stopped',
      }
    }

    const record = this.#active.get(id)
    if (!record || (ownerId && clean(ownerId) !== record.ownerId)) {
      return { taskId: id, state: 'not_found' }
    }

    return {
      taskId: id,
      state: 'working',
      activity: [{ kind: 'plan', status: 'running', label: 'Sales decision' }],
    }
  }

  async cancel(taskId, { ownerId } = {}) {
    const id = clean(taskId)
    const record = this.#active.get(id)
    if (!record) return { taskId: id, state: 'not_found' }
    if (ownerId && clean(ownerId) !== record.ownerId) {
      throw new Error('Cannot cancel work owned by another user')
    }
    if (!record.controller.signal.aborted) {
      record.controller.abort(cancellationError(id))
    }
    return { taskId: id, state: 'cancelled' }
  }

  async respondAuthorization() {
    throw new Error('Sales backend does not support authorization requests')
  }

  async respondInput() {
    throw new Error('Sales backend does not support input requests')
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Backend event listener must be a function')
    }
    this.#subscribers.add(listener)
    return () => this.#subscribers.delete(listener)
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    this.#started = false
    for (const record of this.#active.values()) {
      if (!record.controller.signal.aborted) {
        record.controller.abort(cancellationError(record.taskId))
      }
    }
    this.#subscribers.clear()
  }
}
