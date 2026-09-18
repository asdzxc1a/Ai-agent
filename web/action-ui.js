const ACTION_STATUSES = new Set([
  'pending',
  'confirmed',
  'cancelled',
  'executing',
  'executed',
  'failed',
  'superseded',
])

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function normalizedStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  return ACTION_STATUSES.has(status) ? status : 'unknown'
}

function statusCopy(status) {
  if (status === 'pending') return 'Pending — nothing will happen until you confirm.'
  if (status === 'confirmed') return 'Confirmed — not executed yet.'
  if (status === 'cancelled') return 'Cancelled — this action will not execute.'
  if (status === 'executing') return 'Executing — waiting for the server result.'
  if (status === 'executed') return 'Executed — the server reports this action completed.'
  if (status === 'failed') return 'Failed — the server reports this action did not complete.'
  if (status === 'superseded') return 'Superseded — a newer server proposal replaced this pending action.'
  return 'Unknown action status — no action can be taken.'
}

export function actionProposalMarkup(action = {}, {
  executionMode = 'disabled',
} = {}) {
  const status = normalizedStatus(action.status)
  const id = escapeHtml(action.id)
  const label = escapeHtml(action.label || action.kind || 'Proposed action')
  const description = escapeHtml(action.description || 'No additional details provided.')
  const controls = []

  if (status === 'pending') {
    controls.push('<button type="button" class="btn btn-primary action-command" data-action-command="confirm">Confirm</button>')
    controls.push('<button type="button" class="btn btn-ghost action-command" data-action-command="cancel">Cancel</button>')
  } else if (status === 'confirmed') {
    if (String(executionMode).trim().toLowerCase() === 'sandbox') {
      controls.push('<button type="button" class="btn btn-primary action-command" data-action-command="execute">Execute sandbox</button>')
    }
    controls.push('<button type="button" class="btn btn-ghost action-command" data-action-command="cancel">Cancel</button>')
  }

  let result = ''
  if (status === 'executed') {
    result = `<div class="action-result">${escapeHtml(action.receipt?.summary || 'Action executed by the server.')}</div>`
  } else if (status === 'failed') {
    result = `<div class="action-result action-result-error">${escapeHtml(action.error || 'Action execution failed.')}</div>`
  }

  return `<article class="action-proposal action-${status}" data-action-status="${status}" data-proposal-id="${id}">
    <div class="action-proposal-head">
      <div>
        <div class="action-label">${label}</div>
        <div class="action-description">${description}</div>
      </div>
      <span class="action-status">${escapeHtml(status)}</span>
    </div>
    <div class="action-status-copy">${statusCopy(status)}</div>
    ${result}
    ${controls.length ? `<div class="action-controls">${controls.join('')}</div>` : ''}
  </article>`
}
