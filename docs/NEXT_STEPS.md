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

## Gate D — sales visuals 🟡 canonical product/pricing/comparison path implemented

Completed:
- standard Gateway artifact MIME contract: `application/vnd.sales-avatar.visual+json`.
- product, pricing, and comparison visuals are re-hydrated from structured catalog truth before display.
- canonical sales artifacts survive the real Qwen backend runtime.
- the headless bridge extracts/deduplicates visual artifacts.
- browser test console renders canonical visuals next to the avatar.
- renderer escapes untrusted display strings.
- products shown are tracked in server-owned sales state across canonical visual types.

Next visual types:
- `case_study`
- `roi`
- `next_step`

Each new type must have its own structured hydrator/data source before it becomes frontend-authoritative. Unknown model-authored visual types are dropped by the backend.

## Gate E — real hidden supervisor 🟡 adapter and security boundary complete

Completed before live model use:
- OpenAI-compatible supervisor adapter.
- model selection is environment/config only.
- canonical decision layer strips model authority over lead/account IDs, consent, session identity, and transaction state.
- deterministic buyer facts override conflicting reasoner proposals.
- product/pricing/comparison facts are rebuilt from structured catalog truth, so a model cannot invent them.

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

## Gate G — permissioned action execution ✅ sandbox complete, production connectors pending

Implemented:
- server-owned `ActionProposal` IDs and lifecycle: pending, confirmed, cancelled, executing, executed, failed.
- explicit human confirmation before execution; model messages never count as confirmation.
- `SALES_ACTION_EXECUTION_MODE=disabled|sandbox`, with `disabled` as the fail-closed default.
- modular allowlisted sandbox providers behind `ActionToolRegistry`.
- no network, email, CRM, calendar, payment or filesystem side effects in sandbox mode.
- at-most-once provider execution under Promise-level races.
- idempotent replay after successful execution.
- cross-session confirmation/execution isolation.
- sanitized execution receipts and independently sanitized SalesOS action audit.
- browser proposal UI with distinct pending/confirmed/cancelled/executing/executed/failed states.
- sandbox execution control rendered only when the server advertises sandbox mode.
- adversarial security coverage for retries, races, malformed IDs, fake model success/URLs, malicious receipts, concurrent buyers and 20+ simultaneous proposals.

Next production connector work:
1. Add read-only CRM/account/opportunity adapters first.
2. Implement production providers behind the existing registry interface rather than changing the executor.
3. Add provider credentials only on the server and never expose them to browser/model context.
4. Keep the same explicit confirmation, session-isolation, at-most-once and receipt-sanitization invariants.
5. Start with sandbox/test tenants before any production CRM/calendar/email credentials.
6. Add recovery/idempotency keys appropriate to each external provider before enabling writes.

Production actions may eventually include:
- create/update lead
- update opportunity
- set next step
- book meeting
- send follow-up
- create trial / human handoff

No production connector mode is enabled in this wave.

## Gate H — SalesOS learning/evaluation loop 🟡 harness complete, evaluator next

Implemented:
- shared `SalesOSHarness` observes both backend policy decisions and selected realtime events without becoming another user-facing agent.
- append-only `salesos.event.v1` trajectory records capture buyer turn, deterministic facts, observed state, DOGA strategy, canonical decision, resulting state, transcripts, tool calls, and interruptions.
- raw PCM is excluded from the learning stream.
- no hidden chain-of-thought is persisted.
- `salesos.reward.v1` preserves separate reward components instead of collapsing everything to conversion.
- factuality and compliance are hard gates: a failed trajectory is ineligible for training even if commercial outcome is good.
- `salesos.experience.v1` supports explicit promotion of reusable state → strategy → outcome experiences.
- `salesos.learning-bundle.v1` exports trajectory + rewards + promoted experiences per session.
- learning bundles remain available after the LiveAvatar renderer is stopped.
- local control endpoints can inspect a bundle and attach reward/experience annotations.

Next evaluation work:
1. Persist trajectories/rewards/experiences in Postgres/object storage instead of process memory.
2. Add deterministic factuality/tool validators before model judges.
3. Add SalesLLM / CustomerLM simulation environments and Dubai-concierge-specific SalesBench scenarios.
4. Add evaluator calibration against human labels; do not trust an LLM judge until agreement is measured.
5. Every production failure becomes a permanent regression case.
6. Score state extraction, tool correctness, factuality, sales-stage progression, objection handling, information gain, next-step quality, latency, interruption handling, and eventual business outcome.

## Gate I — fast experience-learning loop

After Gate H scoring is calibrated:
- branch difficult real states into multiple candidate strategies offline.
- roll each branch forward against CustomerLM / simulator ensembles.
- compare strategies within the same state instead of rewarding raw eloquence.
- promote only gated high-value experiences into the Experience Bank.
- retrieve relevant prior experiences into DOGA at runtime.
- keep this loop weight-free first; it is the analogue of Youtu-style training-free experience learning.

Acceptance:
- experience retrieval measurably improves frozen SalesBench without increasing factuality/compliance failures.
- experience growth is bounded, deduplicated, and auditable.

## Gate J — counterfactual/replay training data

Build training workers outside the realtime process:
- counterfactual branch generator
- RLSTA-style latent-capability miner: long-dialogue failure + compressed-state success → premium training example
- SPEAR-style replay sampler for high-value successful sub-trajectories
- hard-negative sampler for unsupported claims, excessive pressure, repetition, and bad next-step choices

The output remains framework-neutral training data derived from `salesos.learning-bundle.v1`.

## Gate K — model training

Only after enough gated trajectories exist:
1. Train a small clean SFT/LoRA baseline.
2. Run direct-RL and SFT→RL as separate controlled experiments.
3. Use the same frozen SalesBench and customer simulator ensemble for every checkpoint.
4. Reject any checkpoint that gains conversion while losing factuality/compliance or increasing excessive pressure.
5. Integrate AReaL / GRPO / another trainer behind an exporter/adapter; never make the realtime app depend directly on a training framework.
6. Consider distilling the learned sales policy into a smaller model before attempting expensive adaptation of a very large foundation model.
