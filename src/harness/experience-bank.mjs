import { randomUUID } from 'node:crypto'

function clean(value) { return String(value || '').trim() }

export class InMemoryExperienceBank {
  #records = new Map()

  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.clock = clock
  }

  add({ sessionId, strategy, state = {}, outcome = {}, reward = null, tags = [], evidenceEventIds = [], metadata = {} } = {}) {
    const sid = clean(sessionId)
    const selectedStrategy = clean(strategy)
    if (!sid) throw new TypeError('experience requires sessionId')
    if (!selectedStrategy) throw new TypeError('experience requires strategy')
    const record = {
      id: randomUUID(),
      schemaVersion: 'salesos.experience.v1',
      sessionId: sid,
      strategy: selectedStrategy,
      state: structuredClone(state || {}),
      outcome: structuredClone(outcome || {}),
      reward: reward == null ? null : structuredClone(reward),
      tags: [...new Set((tags || []).map(clean).filter(Boolean))],
      evidenceEventIds: [...new Set((evidenceEventIds || []).map(clean).filter(Boolean))],
      metadata: structuredClone(metadata || {}),
      createdAt: this.clock(),
    }
    this.#records.set(record.id, record)
    return structuredClone(record)
  }

  list({ sessionId = null, strategy = null, tag = null } = {}) {
    const sid = clean(sessionId)
    const selectedStrategy = clean(strategy)
    const selectedTag = clean(tag)
    return [...this.#records.values()]
      .filter(record => !sid || record.sessionId === sid)
      .filter(record => !selectedStrategy || record.strategy === selectedStrategy)
      .filter(record => !selectedTag || record.tags.includes(selectedTag))
      .map(record => structuredClone(record))
  }
}
