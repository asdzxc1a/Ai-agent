import { randomUUID } from 'node:crypto'

function clean(value) { return String(value || '').trim() }
function clone(value) { return value == null ? value : structuredClone(value) }

export class InMemoryTrajectoryStore {
  #events = []
  #sequence = new Map()

  constructor({ maxEvents = 50_000, clock = () => new Date().toISOString() } = {}) {
    this.maxEvents = Math.max(100, Number(maxEvents) || 50_000)
    this.clock = clock
  }

  append({ sessionId, type, source = 'salesos', turnId = null, taskId = null, data = {} } = {}) {
    const id = clean(sessionId)
    const eventType = clean(type)
    if (!id) throw new TypeError('trajectory event requires sessionId')
    if (!eventType) throw new TypeError('trajectory event requires type')
    const sequence = (this.#sequence.get(id) || 0) + 1
    this.#sequence.set(id, sequence)
    const event = {
      id: randomUUID(),
      schemaVersion: 'salesos.event.v1',
      sessionId: id,
      sequence,
      type: eventType,
      source: clean(source) || 'salesos',
      turnId: clean(turnId) || null,
      taskId: clean(taskId) || null,
      at: this.clock(),
      data: clone(data) ?? {},
    }
    this.#events.push(event)
    if (this.#events.length > this.maxEvents) this.#events.splice(0, this.#events.length - this.maxEvents)
    return clone(event)
  }

  list({ sessionId = null, type = null, limit = null } = {}) {
    const sid = clean(sessionId)
    const eventType = clean(type)
    let rows = this.#events
    if (sid) rows = rows.filter(event => event.sessionId === sid)
    if (eventType) rows = rows.filter(event => event.type === eventType)
    if (limit != null) rows = rows.slice(-Math.max(0, Number(limit) || 0))
    return clone(rows)
  }

  exportSession(sessionId) {
    const id = clean(sessionId)
    return {
      schemaVersion: 'salesos.trajectory.v1',
      sessionId: id,
      events: this.list({ sessionId: id }),
    }
  }
}
