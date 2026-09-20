# Current Project State

**Last updated:** 2026-09-19  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Proven browser foundation → Astra autonomous sales product  
**Current gate:** Gate 8 — Sales domain contract + SalesBench baseline  
**Overall status:** Gates 0–7 remain PASSED and are preserved as Astra's browser/research/run foundation. The autonomous-sales product pivot is merged in PR #47 at `68c568c09920c223d690884dd6007a8e180cb190`. Gate 8 acceptance is PASSED on PR #52 code head `7c8e4f2ea5c9b3f412c25b0fe2ae0a8951299e29`; the remaining Gate 8 action is squash-merge. Gate 9 has not started. The Git-centered memory system remains the canonical handoff mechanism.

## North star

Astra should eventually execute this loop:

~~~text
approved target / ICP
      ↓
evidence-backed browser research
      ↓
prospect + buyer + opportunity context
      ↓
consultative next-best-action policy
      ↓
text / voice / optional avatar conversation
      ↓
typed proposal + explicit authorization
      ↓
real business action
      ↓
durable outcome + evaluation
      ↓
experience memory + sanitized public proof
~~~

Astra sells our AI-native company/workforce transformation service **and demonstrates the service by doing the sales job itself**.

## What works now on `main`

The repository already has:

- strict TypeScript workspace + deterministic CI;
- owned `BrowserRuntime` / `BrowserSession` contracts;
- Steel browser adapter with session lifecycle, screenshots, and diagnostics;
- owned `AgentRuntime` / `AgentSession` contracts;
- Stagehand adapter over Steel CDP;
- asynchronous HTTP run API;
- provider-neutral `RunEngine` / `RunRepository`;
- fast in-memory repository and durable PostgreSQL repository;
- persisted runs, steps, and ordered events;
- replayable SSE using persisted event sequence IDs;
- artifact abstraction with in-memory/local filesystem stores;
- downloadable screenshots/diagnostics/run summaries;
- artifact redaction tests;
- pinned Steel and PostgreSQL runtime images;
- clean GitHub-centered project memory/handoff discipline.

These capabilities become the **research, evidence, and later browser-action substrate** for the sales product.

## Reusable sales/voice asset outside `main`

Draft PR #2 / branch `codex/sales-avatar-foundation` contains an experimental sales/voice foundation:

- deterministic sales session state and sales strategy;
- Qwen/GPT-Live realtime integration;
- optional HeyGen LiveAvatar transport;
- server-owned commercial-truth canonicalization;
- action proposal/confirmation/execution boundaries;
- SalesOS trajectory/reward/experience structures;
- focused adversarial action-security coverage.

The branch is **not merged into main**, the real GPT-Live + HeyGen live acceptance remains incomplete, and its demo product ontology is generic SaaS rather than our AI-native transformation service. It is an asset for selective reuse, not current product truth.

## What is not built yet

Astra does not yet have:

- an owned multi-step agent loop; the current RunEngine foundation still reflects the earlier one-observe/select/act capability limit;
- explicit completion/effect semantics, cancellation propagation, and execution budgets for broader autonomy;
- a canonical definition of the service it is allowed to sell;
- an AI-native company/workforce transformation ontology;
- owned `Prospect`, `Buyer`, `Opportunity`, `QualificationState`, `SalesDecision`, `Outcome`, or `PublicProof` contracts on `main`;
- a deterministic SalesBench for consultative selling quality;
- a prospect-research vertical slice that separates observation from hypothesis;
- ICP scoring or a persistent prospect queue;
- outreach drafting/approval workflow;
- a persistent consultative sales conversation on `main`;
- a selected and live-accepted realtime voice path;
- durable production-grade action execution;
- real CRM, handoff, scheduling, email, LinkedIn, or X connectors;
- a safe public-proof publishing pipeline;
- an automated evaluator/experience-retrieval loop;
- a controlled real-market pilot.

## Completed milestones

| Gate | Status | Durable evidence |
| --- | --- | --- |
| 0 — Repository + CI | PASSED | PR #19 / archived evidence |
| 1 — Steel alone, local | PASSED | pinned Steel, 10/10 lifecycle regression |
| 2 — Stagehand → Steel | PASSED | PR #25 |
| 3 — Owned browser/agent interfaces | PASSED | PR #27 |
| 4 — First product API | PASSED | PR #29 |
| 5 — Durable run state | PASSED | PR #31 |
| 6 — Replayable SSE | PASSED | PR #33 |
| 7 — Artifacts + debugging | PASSED | PR #35 |

Detailed Gates 0–7 evidence remains in:

`docs/project/history/2026-09-18-gates-0-7-browser-foundation.md`

The product pivot and branch-reuse rationale are recorded in:

`docs/project/history/2026-09-19-astra-sales-product-pivot.md`

Tests and current code remain stronger evidence than this summary.

## Project memory

The memory system uses:

- `AGENTS.md` as the bootloader;
- this file as the single hot-memory hub;
- active GitHub issue #48 as short-lived working memory for Gate 8;
- `PLAN.md` for future gates;
- `DECISIONS.md` for durable rationale;
- `LESSONS.md` for reusable learning;
- `history/` for cold completed evidence;
- tests/CI as the strongest source of truth.

The complete reusable specification is:

`docs/project/PROJECT_MEMORY_SYSTEM.md`

Structural invariants are checked with:

~~~bash
pnpm check:memory
~~~

## Gate 8 acceptance evidence

Code head: `7c8e4f2ea5c9b3f412c25b0fe2ae0a8951299e29`.

- CI `35452660433`: memory validation, lint, typecheck, **34/34 tests across 9 files**, and all builds passed.
- Steel `35452660148`: 10-session browser regression + screenshot/diagnostic coverage passed. Artifact `10587865497`, digest `sha256:a9cf1f0afa4efebee124e784390320396bd5d75f6c2e4f49fad6bf037e3a3f13`.
- Stagehand/Steel/PostgreSQL `35452660180`: semantic 10-session regression, HTTP browser, PostgreSQL, SSE replay, durable restart, and cleanup passed.
- SalesBench V1 fingerprint: `58a809b67eb92e396b3feab365bcabbe528a410b52b028384f4849345e89a163`.
- Baseline 0: **36 scenarios, 36/36 hard gates, 31/36 policy matches (86.11%)**, mean score `0.9675925925925927`.
- Detailed evidence: `benchmarks/salesbench/baseline-0.json` and `docs/project/history/2026-09-19-gate-8-salesbench-baseline.md`.

## Known risks

1. **Capability risk:** browser/runtime reliability is proven more strongly than broad multi-step agent capability; Gates 8–11 must measure and close that gap before live prospecting expands.
2. **Product-definition risk:** the service offer must be explicit before Astra is allowed to invent value propositions, pricing, proof, or guarantees.
3. **Scope risk:** the existing browser foundation and draft voice branch are large assets; combining them wholesale would create integration debt. Reuse must be contract-by-contract.
4. **Evaluation risk:** a persuasive agent can still be wrong or spammy. SalesBench must score factuality, evidence, relevance, information gain, pressure, qualification, and next-step quality separately.
5. **Reputation risk:** outreach and social publishing change external reputation. Drafting is not authorization to send/post.
6. **Platform/compliance risk:** LinkedIn/X/email/telephony automation has provider rules, consent, rate-limit, anti-spam, and account-risk constraints that must be encoded before autonomous use.
7. **Voice risk:** PR #2 contains substantial transport code, but neither the intended GPT-Live + HeyGen route nor a canonical alternative is accepted for this product yet.
8. **Memory risk:** this pivot will fail if future agents read old browser-product intent as current mission. Current STATE/AGENTS/PLAN now outrank that history.

## Next action

**Gate 8 / PR #52:** squash-merge the accepted Gate 8 change, then advance hot state to Gate 9 — Owned multi-step sales-agent loop. Do not begin Gate 9 implementation before the Gate 8 merge.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
