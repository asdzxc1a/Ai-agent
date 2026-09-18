# Agent 05 integration note

The UI now imports `./action-ui.js` from `web/app.js`.

The Integration Captain should add this static file mapping in `src/runtime/avatar-control-server.mjs` alongside the existing `/app.js`, `/sales-visual.js`, and `/sales-intelligence.js` mappings:

```js
['/action-ui.js', {
  path: resolve(ROOT, 'web/action-ui.js'),
  type: 'text/javascript; charset=utf-8',
}],
```

No new API endpoint is required. The UI uses the existing:

- `GET /sessions/:sessionId/actions`
- `POST /sessions/:sessionId/actions/:proposalId/confirm`
- `POST /sessions/:sessionId/actions/:proposalId/cancel`
- `POST /sessions/:sessionId/actions/:proposalId/execute`

The Execute Sandbox button is rendered only when `/health` advertises `configuration.actionExecutionMode === 'sandbox'`.
