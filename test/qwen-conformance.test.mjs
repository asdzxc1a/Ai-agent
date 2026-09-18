import test from 'node:test'
import {
  verifyBackendAdapterConformance,
} from 'qwen-audio-agent/backend-adapter-sdk'
import {
  InMemorySalesSessionStore,
  MockSalesReasoner,
  ProductCatalog,
  SalesBackendAdapter,
} from '../src/index.mjs'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function work(index) {
  return {
    id: `sales-task-${index}`,
    ownerId: 'sales-conformance-owner',
    sessionId: 'sales-conformance-session',
    objective: index === 1
      ? 'We have 45 sales reps and need Salesforce plus SSO. Which plan fits?'
      : 'Enterprise sounds expensive. Explain why it is worth it.',
  }
}

function createFixture({ hold }) {
  const started = deferred()
  const sessions = new InMemorySalesSessionStore()
  const catalog = new ProductCatalog()

  const reasoner = hold
    ? {
        async decide() {
          started.resolve()
          // Qwen's conformance suite will cancel this work. The backend itself
          // must make cancellation terminate submit even if a model call does
          // not cooperate with AbortSignal.
          return new Promise(() => {})
        },
      }
    : new MockSalesReasoner()

  const backend = new SalesBackendAdapter({ reasoner, sessions, catalog })

  return {
    name: 'Sales backend',
    backend,
    work: work(1),
    nextWork: work(2),
    started: started.promise,
  }
}

test('SalesBackendAdapter passes Qwen Audio Agent BackendPort conformance', async () => {
  await verifyBackendAdapterConformance({ createFixture })
})
