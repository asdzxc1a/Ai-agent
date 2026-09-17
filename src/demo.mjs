import { InMemorySalesSessionStore, MockSalesReasoner, ProductCatalog, SalesBackendAdapter } from './index.mjs'
const backend = new SalesBackendAdapter({ reasoner: new MockSalesReasoner(), sessions: new InMemorySalesSessionStore(), catalog: new ProductCatalog() })
backend.subscribe(event => console.log('event', event))
await backend.start()
for (const [i, instruction] of ['We have 45 sales reps and need Salesforce plus SSO.','Which plan would you recommend?','Enterprise sounds expensive. Why should we pay more?'].entries()) {
  const result = await backend.submit({ taskId: `demo-${i}`, ownerId: 'demo-session', instruction })
  console.log('\ncustomer:', instruction)
  console.log('backend:', result)
}
