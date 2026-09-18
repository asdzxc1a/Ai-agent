import test from 'node:test'
import assert from 'node:assert/strict'
import { actionProposalMarkup, escapeHtml } from '../web/action-ui.js'

function action(overrides = {}) {
  return {
    id: 'action-1',
    kind: 'book_demo',
    label: 'Book a demo',
    description: 'Choose whether the server may book a sandbox demo.',
    status: 'pending',
    executed: false,
    ...overrides,
  }
}

test('action proposal renderer escapes labels, descriptions and IDs', () => {
  const markup = actionProposalMarkup(action({
    id: 'action-"quoted"',
    label: '<img src=x onerror=alert(1)>',
    description: '<script>steal()</script>',
  }))

  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;')
  assert.equal(markup.includes('<img'), false)
  assert.equal(markup.includes('<script'), false)
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(markup, /&lt;script&gt;steal\(\)&lt;\/script&gt;/)
  assert.match(markup, /data-proposal-id="action-&quot;quoted&quot;"/)
})

test('pending action shows explicit Confirm and Cancel controls', () => {
  const markup = actionProposalMarkup(action())
  assert.match(markup, /action-pending/)
  assert.match(markup, />Confirm<\//)
  assert.match(markup, />Cancel<\//)
  assert.match(markup, /nothing will happen until you confirm/i)
  assert.equal(markup.includes('Execute sandbox'), false)
})

test('confirmed action is clearly not executed and only exposes sandbox execution when advertised', () => {
  const confirmed = actionProposalMarkup(action({ status: 'confirmed' }))
  assert.match(confirmed, /action-confirmed/)
  assert.match(confirmed, /Confirmed — not executed yet\./)
  assert.equal(confirmed.includes('Execute sandbox'), false)
  assert.equal(confirmed.includes('action-executed'), false)

  const sandbox = actionProposalMarkup(action({ status: 'confirmed' }), {
    executionMode: 'sandbox',
  })
  assert.match(sandbox, />Execute sandbox<\//)
  assert.match(sandbox, />Cancel<\//)
})

test('executed appearance comes from backend status, not the executed boolean', () => {
  const forged = actionProposalMarkup(action({
    status: 'confirmed',
    executed: true,
  }), { executionMode: 'sandbox' })
  assert.match(forged, /action-confirmed/)
  assert.equal(forged.includes('action-executed'), false)

  const executed = actionProposalMarkup(action({
    status: 'executed',
    executed: false,
    receipt: { summary: 'Server-confirmed sandbox completion.' },
  }))
  assert.match(executed, /action-executed/)
  assert.match(executed, /Server-confirmed sandbox completion\./)
  assert.equal(executed.includes('data-action-command='), false)
})

test('failed and other lifecycle states render distinct server-owned status classes', () => {
  for (const status of ['pending', 'confirmed', 'cancelled', 'executing', 'executed', 'failed']) {
    const markup = actionProposalMarkup(action({
      status,
      error: status === 'failed' ? 'provider unavailable' : null,
    }))
    assert.match(markup, new RegExp(`action-${status}`))
  }
  const failed = actionProposalMarkup(action({
    status: 'failed',
    error: '<b>provider unavailable</b>',
  }))
  assert.match(failed, /Failed — the server reports this action did not complete\./)
  assert.match(failed, /&lt;b&gt;provider unavailable&lt;\/b&gt;/)
  assert.equal(failed.includes('<b>'), false)
})

test('action proposal markup never creates model-provided links or navigation', () => {
  const markup = actionProposalMarkup(action({
    label: 'Open this',
    description: '<a href="javascript:location=\'https://evil.example\'">continue</a>',
  }))
  assert.equal(markup.includes('<a '), false)
  assert.equal(markup.includes('</a>'), false)
  assert.equal(markup.includes('target='), false)
  assert.equal(markup.includes('onclick='), false)
})
