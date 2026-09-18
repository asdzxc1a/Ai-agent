import { applyStatePatch } from '../domain/sales-state.mjs'
import { extractDeterministicSalesFacts } from '../domain/fact-extractor.mjs'
import { createSalesVisualArtifact } from '../domain/sales-artifacts.mjs'
import { canonicalizeSalesDecision } from '../domain/sales-decision.mjs'
import { selectSalesOutline } from '../strategy/doga.mjs'

function clean(value) { return String(value || '').trim() }

function cancellationError(taskId) {
  const error = new Error(`Task ${taskId} was cancelled`)
  error.code = 'WORK_CANCELLED'
  return error
}

function productIdsFromVisual(visual) {
  if (!visual || typeof visual !== 'object') return []
  if (visual.type === 'product_card') return visual.props?.id ? [visual.props.id] : []
  if (visual.type === 'pricing') return visual.props?.product?.id ? [visual.props.product.id] : []
  if (visual.type === 'roi') return visual.props?.product?.id ? [visual.props.product.id] : []
  if (visual.type === 'comparison') {
    return (Array.isArray(visual.props?.products) ? visual.props.products : [])
      .map(product => product?.id)
      .filter(Boolean)
  }
  return []
}

function caseStudyIdsFromVisual(visual) {
  if (visual?.type !== 'case_study') return []
  return visual.props?.caseStudy?.id ? [visual.props.caseStudy.id] : []
}

export class SalesBackendAdapter {
  #started = false
  #closed = false
  #active = new Map()
  #subscribers = new Set()

  constructor({
    reasoner,
    sessions,
    catalog,
    caseStudies = null,
    roiCalculator = null,
    actionProposals = null,
    harness = null,
  }) {
    this.reasoner = reasoner
    this.sessions = sessions
    this.catalog = catalog
    this.caseStudies = caseStudies
    this.roiCalculator = roiCalculator
    this.actionProposals = actionProposals
    this.harness = harness
  }

  describe() {
    return {
      configured: true,
      enabled: true,
      protocol: 'sales-backend',
      label: 'Sales Backend',
      capabilities: { cancel: true, authorization: false, interactiveInput: false, taskUpdates: 'activity' },
    }
  }

  async start() {
    if (this.#closed) throw new Error('Sales backend is closed')
    this.#started = true
    return { ok: true, status: 'ready' }
  }

  async health() {
    return { ok: this.#started && !this.#closed, status: this.#started && !this.#closed ? 'ready' : 'stopped' }
  }

  #emit(event) {
    for (const listener of this.#subscribers) {
      try { listener(event) } catch {}
    }
  }

  #attachActionProposal(decision, { sessionId, taskId } = {}) {
    if (decision?.visual?.type !== 'next_step' || !this.actionProposals?.create) return null
    const props = decision.visual.props || {}
    const proposal = this.actionProposals.create({
      sessionId,
      taskId,
      kind: props.kind,
      label: props.label,
      description: props.description,
    })
    this.harness?.recordActionLifecycle?.({
      sessionId,
      type: 'sales.action.proposed',
      proposal,
    })
    const superseded = this.actionProposals.supersedePending?.({
      sessionId,
      kind: proposal.kind,
      supersededByProposalId: proposal.id,
    }) || []
    for (const previous of superseded) {
      this.harness?.recordActionLifecycle?.({
        sessionId,
        type: 'sales.action.superseded',
        proposal: previous,
      })
    }
    decision.visual = {
      type: 'next_step',
      props: {
        kind: proposal.kind,
        label: proposal.label,
        description: proposal.description,
        proposalId: proposal.id,
        status: proposal.status,
        requiresConfirmation: true,
        executed: false,
      },
    }
    return proposal
  }

  async submit(work, { signal } = {}) {
    const taskId = clean(work?.id ?? work?.taskId)
    const ownerId = clean(work?.ownerId)
    const instruction = clean(work?.instruction || work?.objective || work?.originalRequest || work?.message)
    const buyerTurn = clean(work?.objective || work?.originalRequest || work?.message || instruction)
    if (!taskId || !ownerId || !instruction) throw new Error('BackendPort submit requires task id, owner and input')
    if (this.#active.has(taskId)) throw new Error(`Task ${taskId} is already active`)
    const sessionId = clean(work?.sessionId) || ownerId

    await this.start()
    const controller = new AbortController()
    const record = { taskId, ownerId, controller }
    this.#active.set(taskId, record)

    let detachExternalAbort = null
    if (signal) {
      const abortFromCaller = () => {
        if (!controller.signal.aborted) controller.abort(signal.reason || cancellationError(taskId))
      }
      if (signal.aborted) abortFromCaller()
      else {
        signal.addEventListener('abort', abortFromCaller, { once: true })
        detachExternalAbort = () => signal.removeEventListener('abort', abortFromCaller)
      }
    }

    this.#emit({ type: 'backend.activity', taskId, ownerId, activity: { id: 'sales-decision', kind: 'plan', status: 'running', label: 'Sales decision' } })

    const cancelled = new Promise((_, reject) => {
      const rejectCancellation = () => reject(controller.signal.reason || cancellationError(taskId))
      if (controller.signal.aborted) rejectCancellation()
      else controller.signal.addEventListener('abort', rejectCancellation, { once: true })
    })

    try {
      const state = this.sessions.ensure(sessionId)
      const stateBefore = structuredClone(state)
      const deterministicPatch = extractDeterministicSalesFacts(buyerTurn)
      const observedState = applyStatePatch(state, deterministicPatch, { incrementTurn: false })
      const strategy = selectSalesOutline(observedState, buyerTurn)

      const rawDecision = await Promise.race([
        this.reasoner.decide({
          state: observedState,
          turn: buyerTurn,
          backendInstruction: instruction,
          strategy,
          catalog: this.catalog,
          caseStudies: this.caseStudies,
          roiAvailable: Boolean(this.roiCalculator),
          signal: controller.signal,
        }),
        cancelled,
      ])
      const decision = canonicalizeSalesDecision(rawDecision, {
        catalog: this.catalog,
        caseStudies: this.caseStudies,
        roiCalculator: this.roiCalculator,
        state: observedState,
      })
      const actionProposal = this.#attachActionProposal(decision, { sessionId, taskId })

      if (controller.signal.aborted) throw controller.signal.reason || cancellationError(taskId)

      const reasonedState = applyStatePatch(state, decision.statePatch ?? {})
      const nextState = applyStatePatch(reasonedState, deterministicPatch, { incrementTurn: false })
      const shownProductIds = productIdsFromVisual(decision.visual)
      if (shownProductIds.length) nextState.productsShown = [...new Set([...(nextState.productsShown || []), ...shownProductIds])]
      const shownCaseStudyIds = caseStudyIdsFromVisual(decision.visual)
      if (shownCaseStudyIds.length) nextState.caseStudiesShown = [...new Set([...(nextState.caseStudiesShown || []), ...shownCaseStudyIds])]
      if (actionProposal) nextState.nextStep = actionProposal.kind
      this.sessions.set(sessionId, nextState)

      this.#emit({ type: 'backend.activity', taskId, ownerId, activity: { id: 'sales-decision', kind: 'plan', status: 'completed', label: 'Sales decision' } })

      const artifacts = decision.visual ? [createSalesVisualArtifact({ taskId, visual: decision.visual })] : []
      for (const artifact of artifacts) this.#emit({ type: 'backend.artifact', taskId, ownerId, artifact })

      this.harness?.recordBackendDecision?.({
        sessionId, taskId, ownerId, buyerTurn, stateBefore, observedState,
        deterministicPatch, strategy, decision, stateAfter: nextState, artifacts,
      })

      return { content: clean(decision.content), artifacts }
    } catch (error) {
      this.harness?.recordBackendFailure?.({ sessionId, taskId, ownerId, buyerTurn, error })
      throw error
    } finally {
      detachExternalAbort?.()
      if (this.#active.get(taskId) === record) this.#active.delete(taskId)
    }
  }

  status(taskId, { ownerId } = {}) {
    const id = clean(taskId)
    if (!id) return { ok: this.#started && !this.#closed, status: this.#started && !this.#closed ? 'ready' : 'stopped' }
    const record = this.#active.get(id)
    if (!record || (ownerId && clean(ownerId) !== record.ownerId)) return { taskId: id, state: 'not_found' }
    return { taskId: id, state: 'working', activity: [{ kind: 'plan', status: 'running', label: 'Sales decision' }] }
  }

  async cancel(taskId, { ownerId } = {}) {
    const id = clean(taskId)
    const record = this.#active.get(id)
    if (!record) return { taskId: id, state: 'not_found' }
    if (ownerId && clean(ownerId) !== record.ownerId) throw new Error('Cannot cancel work owned by another user')
    if (!record.controller.signal.aborted) record.controller.abort(cancellationError(id))
    return { taskId: id, state: 'cancelled' }
  }

  async respondAuthorization() { throw new Error('Sales backend does not support authorization requests') }
  async respondInput() { throw new Error('Sales backend does not support input requests') }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Backend event listener must be a function')
    this.#subscribers.add(listener)
    return () => this.#subscribers.delete(listener)
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    this.#started = false
    for (const record of this.#active.values()) {
      if (!record.controller.signal.aborted) record.controller.abort(cancellationError(record.taskId))
    }
    this.#subscribers.clear()
  }
}
