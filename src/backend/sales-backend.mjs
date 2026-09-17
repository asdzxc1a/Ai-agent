import { applyStatePatch } from '../domain/sales-state.mjs'
import { selectSalesOutline } from '../strategy/doga.mjs'

export class SalesBackendAdapter {
  #started = false
  #tasks = new Map()
  #subscribers = new Set()

  constructor({ reasoner, sessions, catalog }) { this.reasoner = reasoner; this.sessions = sessions; this.catalog = catalog }
  describe() { return { id: 'sales-backend', label: 'Sales Backend', capabilities: { cancellation: true, authorization: false, interactiveInput: false } } }
  async start() { this.#started = true; return this.describe() }
  async health() { return { ok: this.#started } }
  #emit(event) { for (const fn of this.#subscribers) queueMicrotask(() => { try { fn(event) } catch {} }) }

  async submit(task) {
    if (!this.#started) await this.start()
    if (!task?.taskId || !task?.instruction) throw new Error('taskId and instruction are required')
    if (this.#tasks.has(task.taskId)) throw new Error(`Duplicate taskId: ${task.taskId}`)
    const record = { status: 'running', cancelled: false }
    this.#tasks.set(task.taskId, record)
    this.#emit({ type: 'backend.activity', taskId: task.taskId, ownerId: task.ownerId, activity: { id: 'sales-decision', kind: 'plan', status: 'running', label: 'Sales decision' } })
    const sessionId = task.sessionId ?? task.ownerId ?? 'default'
    const state = this.sessions.ensure(sessionId)
    const strategy = selectSalesOutline(state, task.instruction)
    const decision = await this.reasoner.decide({ state, turn: task.instruction, strategy, catalog: this.catalog })
    if (record.cancelled) throw new Error(`Task cancelled: ${task.taskId}`)
    const nextState = applyStatePatch(state, decision.statePatch ?? {})
    this.sessions.set(sessionId, nextState)
    record.status = 'completed'
    record.result = { content: decision.content, artifacts: decision.visual ? [{ type: 'sales.visual', data: decision.visual }] : [], meta: { state: nextState, confidence: decision.confidence ?? null } }
    this.#emit({ type: 'backend.activity', taskId: task.taskId, ownerId: task.ownerId, activity: { id: 'sales-decision', kind: 'plan', status: 'completed', label: 'Sales decision' } })
    if (decision.visual) this.#emit({ type: 'backend.artifact', taskId: task.taskId, ownerId: task.ownerId, artifact: decision.visual })
    return record.result
  }

  async status(taskId) { if (!taskId) return { status: this.#started ? 'running' : 'stopped' }; return this.#tasks.get(taskId) ?? { status: 'unknown' } }
  async cancel(taskId) { const task = this.#tasks.get(taskId); if (!task) return { cancelled: false }; task.cancelled = true; task.status = 'cancelled'; return { cancelled: true } }
  async respondAuthorization() { throw new Error('Authorization is not supported by this backend') }
  async respondInput() { throw new Error('Interactive backend input is not supported') }
  subscribe(fn) { this.#subscribers.add(fn); return () => this.#subscribers.delete(fn) }
  async close() { this.#started = false; this.#tasks.clear() }
}
