# Build gates

## Gate A — Qwen runtime ✅

Completed:
- Qwen Audio Agent pinned to commit `f40d0053c6a0a74c8e7cc40a334f31c9c36c1fae`.
- `SalesBackendAdapter` wrapped with `createBackendAgentHost()`.
- Qwen's public `verifyBackendAdapterConformance()` suite passes.
- The sales backend also executes through the real `GatewayApplication` / `BackendWorkRuntime` path.
- Owner isolation, duplicate-task rejection, cancellation, subscription cleanup, and result boundaries are covered by CI.

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

## Gate D — sales visuals

Next engineering milestone after live transport passes.

Implement first six artifact types:
- `product_card`
- `comparison`
- `pricing`
- `case_study`
- `roi`
- `next_step`

Browser owns layout; backend owns data. Artifacts must be deterministic and source their commercial facts from structured tools/state.

## Gate E — real hidden supervisor

After transport is stable, replace `MockSalesReasoner` with an OpenAI-compatible endpoint.

Initial candidate: DeepSeek V4.1 Flash.

Rules:
- model selection remains environment/config only.
- no model may own product price, inventory, permission, or persisted deal truth.
- deterministic buyer facts override conflicting reasoner proposals.
- GLM/Qwen remain drop-in challengers, not architecture forks.

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
