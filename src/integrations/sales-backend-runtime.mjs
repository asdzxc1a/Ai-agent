function clean(value) {
  return String(value || '').trim()
}

/**
 * Qwen Gateway backend-runtime adapter for the sales product.
 *
 * Qwen's pinned stock BackendWorkRuntime intentionally omits `sessionId` from
 * the BackendPort work object. That is fine for owner-scoped personal agents,
 * but a website salesperson needs one independent deal state per live visitor
 * session. Qwen exposes `backendRuntime` as a GatewayApplication injection
 * point, so preserve the trusted Gateway session here without forking Qwen.
 */
export class SalesBackendWorkRuntime {
  constructor({ backend } = {}) {
    if (!backend || typeof backend.submit !== 'function') {
      throw new TypeError('backend with submit() is required')
    }
    this.backend = backend
  }

  run(input, options = {}) {
    const work = {
      id: clean(options.taskId),
      ownerId: clean(options.ownerId),
      sessionId: clean(options.sessionId),
      instruction: clean(input?.instruction || input?.objective),
      objective: clean(input?.objective),
      inputParts: Array.isArray(input?.inputParts) ? input.inputParts : [],
      ...(options.continuity === 'isolated' ? { continuity: 'isolated' } : {}),
    }
    return this.backend.submit(work, {
      signal: options.signal,
      onEvent: options.onEvent,
    })
  }

  runIsolated(input, options = {}) {
    return this.run(input, { ...options, continuity: 'isolated' })
  }

  cancel(taskId, options = {}) {
    return this.backend.cancel(taskId, options)
  }

  status(taskId, options = {}) {
    return this.backend.status(taskId, options)
  }

  respondInput(taskId, inputRequestId, response, options = {}) {
    return this.backend.respondInput(taskId, inputRequestId, response, options)
  }
}
