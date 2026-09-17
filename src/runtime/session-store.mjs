import { createSalesState } from '../domain/sales-state.mjs'

export class InMemorySalesSessionStore {
  #sessions = new Map()
  get(sessionId) { return this.#sessions.get(sessionId) ?? null }
  ensure(sessionId) {
    if (!this.#sessions.has(sessionId)) this.#sessions.set(sessionId, createSalesState({ sessionId }))
    return this.#sessions.get(sessionId)
  }
  set(sessionId, state) { this.#sessions.set(sessionId, state); return state }
  delete(sessionId) { return this.#sessions.delete(sessionId) }
}
