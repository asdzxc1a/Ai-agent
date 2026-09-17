import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesBackendWorkRuntime } from '../src/integrations/sales-backend-runtime.mjs'

test('SalesBackendWorkRuntime preserves trusted Gateway sessionId into BackendPort work', async () => {
  let capturedWork
  let capturedContext
  const backend = {
    async submit(work, context) {
      capturedWork = work
      capturedContext = context
      return { content: 'ok', artifacts: [] }
    },
    cancel() {},
    status() {},
    respondInput() {},
  }
  const runtime = new SalesBackendWorkRuntime({ backend })
  const controller = new AbortController()
  const onEvent = () => {}

  const result = await runtime.run({
    objective: 'We have 45 sales reps.',
    inputParts: [{ type: 'text', text: 'We have 45 sales reps.' }],
  }, {
    taskId: 'task-1',
    ownerId: 'user_personal',
    sessionId: 'visitor-session-a',
    signal: controller.signal,
    onEvent,
  })

  assert.equal(result.content, 'ok')
  assert.equal(capturedWork.id, 'task-1')
  assert.equal(capturedWork.ownerId, 'user_personal')
  assert.equal(capturedWork.sessionId, 'visitor-session-a')
  assert.equal(capturedWork.objective, 'We have 45 sales reps.')
  assert.equal(capturedWork.instruction, 'We have 45 sales reps.')
  assert.deepEqual(capturedWork.inputParts, [{ type: 'text', text: 'We have 45 sales reps.' }])
  assert.equal(capturedContext.signal, controller.signal)
  assert.equal(capturedContext.onEvent, onEvent)
})
