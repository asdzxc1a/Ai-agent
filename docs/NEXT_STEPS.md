# Build gates

## Gate A — Qwen runtime ✅

Completed:
- Qwen Audio Agent pinned to commit `f40d0053c6a0a74c8e7cc40a334f31c9c36c1fae`.
- `SalesBackendAdapter` wrapped with `createBackendAgentHost()`.
- Qwen's public `verifyBackendAdapterConformance()` suite passes.
- The sales backend executes through the real `GatewayApplication` path.
- A custom `SalesBackendWorkRuntime` is injected through Qwen's public `backendRuntime` extension point so trusted Gateway `sessionId` reaches BackendPort and visitor/deal state stays session-isolated.
- A real Qwen Gateway WebSocket `task.create` regression test proves prompt → BackendPort → completed Task → sales artifact across the actual Gateway wire.
- Owner isolation, visitor-session isolation, duplicate-task rejection, cancellation, subscription cleanup, and result boundaries are covered by CI.

Free focused gate:

```bash
npm run smoke:offline
```

## Gate B — realtime GPT-Live ⏳ credentials required

Implemented in code:
- Qwen GPT-Live provider selected by env.
- sales-specific `spawn_thinking` description forces commercial decisions/facts to the sales backend.
- consultative salesperson profile.
- server-side headless Gateway client.
- text + PCM input path.
- transcript/tool/audio observability.

Live acceptance:
1. Run `npm run preflight:live`.
2. Run one guarded smoke test with `LIVE_SMOKE_CONFIRM=YES npm run smoke:live`.
3. Require final assistant transcript, `spawn_thinking` delegation, and 24 kHz output audio.
4. Then run human microphone tests and measure response latency / interruption behavior.

## Gate C — HeyGen renderer 🟡 transport implemented, live acceptance pending

Implemented:
- LiveAvatar LITE token/start/stop flow.
- public-avatar fallback for first tests.
- media-server `agent.speak`, `agent.interrupt`, keep-alive, readiness gating, and reconnect behavior.
- no replay of stale audio after reconnect.
- Qwen `audio.delta` → HeyGen server-side PCM path.
- playback receipts back into Qwen.
- local browser LiveKit viewer.

Live acceptance:
- 20 conversations with no visible audio drift.
- repeated barge-in tests must clear buffered avatar audio immediately.
- reconnect test must recover without replaying abandoned speech.

## Gate D — sales visuals 🟡 first artifact complete

Completed:
- standard Gateway artifact MIME contract: `application/vnd.sales-avatar.visual+json`.
- `product_card` is re-hydrated from structured catalog truth before display.
- the artifact survives the real Qwen backend runtime.
- the headless bridge extracts/deduplicates visual artifacts.
- browser test console renders `product_card` next to the avatar.
- renderer escapes untrusted display strings.

Next visual types:
- `comparison`
- `pricing`
- `case_study`
- `roi`
- `next_step`

Each new type must have its own structured hydrator/data source before it becomes frontend-authoritative. Unknown model-authored visual types are currently dropped by the backend.

## Gate E — real hidden supervisor 🟡 adapter and security boundary complete

Completed before live model use:
- OpenAI-compatible supervisor adapter.
- model selection is environment/config only.
- canonical decision layer strips model authority over lead/account IDs, consent, session identity, and transaction state.
- deterministic buyer facts override conflicting reasoner proposals.
- `product_card` pricing/features/name are rebuilt from structured catalog truth, so a model cannot invent them.

Live-model acceptance:
1. Start with a low-cost hosted supervisor after Gate B/C transport passes.
2. Initial candidate: DeepSeek V4.1 Flash; GLM/Qwen remain drop-in challengers.
3. Measure factuality, latency, tool discipline, and sales outcome against the same scenarios.

## Gate F — real product truth

Replace demo catalog with database/API tools.

Structured sources must own:
- pricing
- plan limits
- availability
- integrations/capabilities that change over time
- discount authorization

RAG is for documentation, case studies, FAQs, implementation material, and sales playbooks—not transactional truth.

## Gate G — CRM sandbox

Read first:
- contact
- account
- opportunity
- previous interactions

Then add writes behind explicit user confirmation:
- create/update lead
- update opportunity
- set next step
- book meeting
- send follow-up

Use sandbox/test CRM before production credentials.

## Gate H — evaluation loop

Once live calls work:
- add SalesLLM / CustomerLM simulation harness.
- every production failure becomes a permanent regression case.
- score state extraction, tool correctness, factuality, sales-stage progression, objection handling, next-step quality, latency, and conversion outcomes.
- only fine-tune a Qwen-sized sales model after enough successful/failed trajectories exist to justify it.
