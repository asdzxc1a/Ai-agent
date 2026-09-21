# Architecture Decision Ledger

This is append-oriented durable memory. Keep entries concise. Existing entry substance is not rewritten; identifier-only legacy repairs may add a letter suffix so references remain unambiguous. New entries use the next normal numeric ID.

## D-001 — Use three foundations as separate layers

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Use:

- Stagehand for initial semantic browser interaction;
- Steel for browser/session/CDP runtime;
- E2B later for sandbox isolation.

Do not merge their source trees.

**Why**

Each project solves a different layer. Keeping boundaries explicit minimizes maintenance and lets us replace each component independently.

**Consequence**

We own adapters and contracts, not upstream internals.

---

## D-002 — Stagehand→Steel before E2B

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Prove Stagehand driving Steel locally over CDP before adding E2B.

**Why**

This splits one difficult three-system integration into two small integrations:

1. semantic agent ↔ browser runtime;
2. browser runtime ↔ isolation runtime.

**Consequence**

E2B is forbidden in early gates unless this decision is deliberately superseded.

---

## D-003 — TypeScript-first

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Initial owned product code is TypeScript-first.

**Why**

Stagehand and Steel fit naturally, E2B has usable JS/TS APIs, and a single language reduces early integration cost.

**Consequence**

Do not modify E2B's Go internals initially.

---

## D-004 — GitHub is persistent project memory

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Project state lives in versioned repository files and test evidence, not in chat memory.

**Why**

Fresh Astra/agents must be able to recover the project without prior conversation context.

**Consequence**

Every gate-completing PR updates `STATE.md` and relevant memory ledgers.

---

## D-005 — Deterministic fixture sites before live-web dependence

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Most development/evaluation uses local deterministic websites.

**Why**

Live websites change, A/B test, rate-limit, block automation, and create false regressions.

**Consequence**

Live-web tests are secondary trend signals, not the primary merge gate.

---

## D-006 — Do not fork upstreams early

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Consume Stagehand as a package, Steel as a service/image, and E2B through its supported runtime/API surface.

**Why**

A fork makes us responsible for an additional product.

**Revisit when**

Measured limitations cannot be solved through adapters, configuration, or upstream contribution.

---

## D-007 — Tests outrank documentation

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Current passing code/tests are the strongest project truth.

**Why**

Docs can become stale.

**Consequence**

A memory entry that claims a feature works without corresponding test evidence is not sufficient to mark a gate complete.


---

## D-008 — Pin browser runtime images by immutable digest

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The Steel runtime used by automated acceptance tests is pinned by OCI image digest in `infra/steel-image.txt`.

**Why**

A moving image tag makes a green test non-reproducible and can introduce upstream changes without a repository diff.

**Consequence**

Upgrading Steel becomes an explicit, testable change: resolve a new digest, run the complete browser acceptance suite, then commit the new digest.

**Current tested digest**

`ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`


---

## D-008A — Pin external runtime images by immutable digest

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Steel is consumed as an external container runtime pinned by OCI digest. The currently verified image is:

`ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`

**Why**

Steel publishes a moving `:latest` image. A moving tag makes browser behavior change without a repository change and makes CI failures impossible to reproduce confidently.

**Consequence**

Runtime upgrades are explicit engineering changes: resolve a new digest, smoke-test it, run the full browser acceptance suite, then update `infra/steel-image.txt`.


---

## D-009 — Pin Stagehand v3.7.3 for direct Steel CDP compatibility

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Use `@browserbasehq/stagehand@3.7.3` for the Stagehand→Steel compatibility layer in Gate 2.

**Why**

V3 explicitly supports attaching to an already-running browser through `localBrowserLaunchOptions.cdpUrl`. Stagehand v4 moved local browser operation to an extension-resident runtime; its default `localBrowser.connect()` path assumes the Stagehand extension is available to the browser process. Our Stagehand SDK runs on the host while Steel's Chromium runs in Docker, so v4 would require extension injection/mounting before we have evidence that complexity is valuable.

**Consequence**

Stagehand is treated as a replaceable compatibility layer. Gate 2 does not adopt v4 extension plumbing.

**Revisit when**

We intentionally build a browser image/runtime that preloads the Stagehand v4 extension, or our own semantic/runtime layer makes Stagehand replaceable entirely.


---

## D-010 — Supersede D-009 with Stagehand 3.7.0 + scoped peer exception

**Date:** 2026-09-18  
**Status:** Accepted; supersedes D-009

**Decision**

Use `@browserbasehq/stagehand@3.7.0` inside `@astra/agent-stagehand`, with `zod@4.4.3`.

Keep pnpm strict peer validation enabled globally. Allow exactly this optional-peer mismatch:

```yaml
peerDependencyRules:
  allowedVersions:
    "openai@4.104.0>zod": "4.4.3"
```

**Why**

Stagehand 3.7.0 is the latest published v3 release before 3.7.3's supporting-dependency refresh and retains the direct existing-browser `cdpUrl` path we need. Stagehand itself declares Zod 3 or Zod 4 support. Its Ollama adapter requires Zod 4, while OpenAI 4.104.0 declares Zod 3 as an optional peer. OpenAI's package metadata confirms that peer is optional, and our Gate 2 runtime uses a custom `LLMClient`, not OpenAI's Zod helper APIs.

**Consequence**

The exception is intentionally narrow and auditable. Any Stagehand/OpenAI/Zod upgrade must remove or re-justify it; broad peer-check disabling remains forbidden.

**Revisit when**

Stagehand v4 is intentionally integrated through a browser image that contains its extension, or a later compatible Stagehand/provider set removes the peer conflict.


---

## D-011 — Own runtime contracts; providers are adapters

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The application boundary is now:

```text
BrowserRuntime → BrowserSession
AgentRuntime   → AgentSession
```

Steel implements `BrowserRuntime`. Stagehand implements `AgentRuntime`. The agent runtime receives our `BrowserSession`, not a Steel response object or provider-specific session type.

**Why**

Future browser provisioning (including E2B) must be replaceable without changing agent logic or product API code. Likewise, Stagehand must be replaceable without changing browser provisioning.

**Consequences**

- Steel types stay inside `@astra/browser-steel`.
- Stagehand types stay inside `@astra/agent-stagehand`.
- product/application code depends on `@astra/browser-runtime` and `@astra/agent-runtime`.
- provider-neutral test fakes exist for both contracts.
- current Stagehand extraction still requires Zod internally, but that implementation detail is checked inside the adapter rather than exposed as the runtime contract.

**Evidence**

PR #27: CI `35381977883`, Steel `35381977729`, Stagehand semantic integration `35381977879`; all passed. The 10-session semantic test ran entirely through owned runtime interfaces.


---

## D-012 — Gate 4 API is asynchronous and intentionally in-memory

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The first product API exposes:

- `POST /v1/runs` → HTTP 202 + run ID;
- `GET /v1/runs/:id` → current run snapshot.

Execution continues asynchronously in the API process. Gate 4 stores run state in memory only.

**Why**

This proves the external contract and runtime orchestration without mixing HTTP design with database/queue engineering. Durability, recovery, steps, and events are the explicit purpose of Gate 5.

**Consequences**

- API process restart loses Gate 4 runs by design.
- no claim of production durability is made yet.
- Gate 5 must preserve the Gate 4 route/response behavior while moving authoritative state to PostgreSQL.

---

## D-013 — Public structured output starts as a small explicit schema subset

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Gate 4 supports an object-root output schema with string/number/boolean properties, optional `const`, optional `required`, and optional `additionalProperties: false`.

Unsupported schemas return typed HTTP 400 `UNSUPPORTED_OUTPUT_SCHEMA`.

**Why**

A small truthful contract is safer than claiming full JSON Schema while only partially implementing it. The current Stagehand adapter requires a concrete runtime schema, so the API compiles the supported public subset internally.

**Consequences**

- the public API contract is provider-neutral;
- Zod remains an API/runtime implementation detail;
- future schema expansion is explicit and testable;
- unsupported constructs fail fast instead of being silently ignored.


---

## D-014 — PostgreSQL is authoritative run state behind RunRepository

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Execution and storage are separated:

```text
RunEngine → RunRepository
             ├ InMemoryRunRepository
             └ PostgresRunRepository
```

The HTTP layer depends on `RunService`, not SQL or PostgreSQL. PostgreSQL is the authoritative durable implementation for production-style Gate 5 acceptance.

**Why**

The external API and browser/agent orchestration should not change when storage changes. Repository separation also keeps fast unit tests deterministic.

**Consequences**

- `apps/api` contains no SQL.
- PostgreSQL implementation lives in `@astra/run-postgres`.
- fast tests can use `InMemoryRunRepository`.
- Gate 6 can stream the already-persisted event log without redesigning execution.

---

## D-015 — Use raw parameterized SQL and transactional migrations before adding an ORM

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Gate 5 uses `pg@8.23.0`, raw parameterized SQL, and explicit migrations. PostgreSQL 18.6 is pinned by immutable digest:

`postgres@sha256:6c538e7206ea40ff740ef27883529390a690b6ead6ba96b44c67a9f7c638e8fd`

Migrations run transactionally and use a PostgreSQL advisory transaction lock. Per-run step/event sequence allocation is performed transactionally in the repository.

**Why**

The schema is small and well understood. An ORM would add another abstraction before we have evidence it is useful, while raw SQL makes sequence/concurrency semantics explicit and testable.

**Consequences**

- all data values are parameterized;
- migration behavior is explicit and idempotent;
- ORM adoption, if any, requires a later evidence-backed decision;
- runtime image upgrades are explicit digest changes with acceptance tests.

---

## D-016 — Persist terminal event before terminal run status

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

`RUN_COMPLETED` / `RUN_FAILED` is appended to the durable event log before the corresponding terminal status update on the `runs` row.

**Why**

A client observing terminal run state should never discover that the durable terminal event is missing. This ordering makes Gate 6 event replay consistent with the run snapshot.

**Consequence**

Gate 6 may treat the persisted event sequence as the authoritative replay source for SSE.


---

## D-017 — SSE is a polling projection of the durable event log

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

`GET /v1/runs/:id/events` streams events directly from persisted `run_events`. SSE ids are the durable per-run `sequence_number`; `Last-Event-ID` resumes strictly after that sequence.

Gate 6 uses a small abort-aware polling loop over:

```ts
listEventsAfter(runId, afterSequence, limit)
```

There is no in-memory EventEmitter, Redis pub/sub, Kafka, NATS, or WebSocket layer.

**Why**

Replay correctness matters more than sub-50ms push latency at this stage. Using PostgreSQL as the source of truth guarantees reconnect behavior, works after process restart, and prevents divergence between an ephemeral event channel and stored run history.

**Consequences**

- disconnecting an SSE client does not affect run execution;
- any API instance with database access can replay historical events;
- terminal events are streamed from the same log used for recovery/debugging;
- polling cost/latency can be optimized later without changing the public SSE contract;
- a future notification/pub-sub layer must remain an acceleration mechanism, not the authoritative event store.

**Evidence**

PR #33 integration run `35387634903`: PostgreSQL SSE disconnect/reconnect acceptance passed with event ids `1 → [2,3]`, no duplicates, and a matching terminal run result.

---

## D-018 — Artifacts are best-effort evidence behind owned interfaces

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Run diagnostics through owned, provider-neutral boundaries:

```text
RunEngine
  ├ BrowserSession.captureScreenshot()
  ├ BrowserSession.getDiagnostics()
  ↓
ArtifactStore
  ├ InMemoryArtifactStore
  └ LocalArtifactStore
```

`ArtifactStore` is optional RunEngine configuration. Artifact capture is best-effort evidence, not authoritative run state: screenshot, diagnostic, or artifact-storage failures must not turn an otherwise successful run into `FAILED`.

JSON artifact values and metadata are redacted before persistence. Run summaries include action description/method/selector but never action arguments. Screenshot bytes remain binary and are never embedded in JSON logs.

**Why**

Debugging evidence is valuable only if it does not couple product orchestration to Steel, alter execution semantics, or compete with PostgreSQL/`run_events` as the source of truth.

**Consequences**

- provider-specific screenshot/log APIs stay inside browser adapters;
- PostgreSQL remains authoritative for run state, steps, and events;
- local filesystem storage is sufficient for Gate 7 and survives a new store instance;
- the artifact API is read-only list/download over the owned store;
- future remote storage may implement `ArtifactStore` without changing RunEngine or HTTP contracts;
- S3, video, HAR, DOM archives, retention policy, external encryption, Vault, and E2B remain out of Gate 7 scope.

**Evidence**

PR #35: CI `35391692165`, Steel `35391691999`, and combined Stagehand/PostgreSQL/SSE `35391692005` all passed. The Steel acceptance directly proved JPEG capture plus console diagnostics against the pinned image, and the HTTP acceptance proved persisted downloadable JPEG evidence.


---
 
## D-019 — Keep project memory Git-centered, tiered, and mechanically validated

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

Keep GitHub/repository memory as the canonical project-memory system rather than adding a separate vector database, embedding index, or chat-memory dependency.

Use distinct memory tiers:

- `STATE.md` as the single small mutable hot-memory hub;
- the active GitHub issue as short-lived working memory;
- `PLAN.md` for future gates and acceptance criteria;
- `DECISIONS.md` for durable architecture/product rationale;
- `LESSONS.md` for reusable engineering learning;
- `docs/project/history/` for cold completed evidence;
- tests and CI as the strongest evidence.

Maintain the full reusable protocol in `docs/project/PROJECT_MEMORY_SYSTEM.md`.

Run a deterministic repository check that validates structural invariants such as required files, current-gate consistency, allowed gate status values, and unique decision/lesson identifiers.

**Why**

The existing GitHub-centered memory system already proved that a fresh context can recover the project and continue work without old chat history. The observed failures were hygiene failures—STATE growth, stale examples, and duplicate ledger identifiers—not evidence that a new storage system is required.

**Consequences**

- no separate memory service is introduced;
- hot memory is aggressively compressed and old detail moves to cold history;
- active issues become the normal working-memory layer;
- structural memory drift becomes CI-visible;
- chat remains context, not project state;
- future memory infrastructure requires evidence that this simpler system is insufficient.

---

## D-020 — Keep Astra's always-loaded AGENTS.md lean and conditional

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

Use the repository-root `AGENTS.md` as Astra/Codex's compact always-loaded control surface.

It defines only:

- mission and durable architecture guardrails;
- instruction/source priority;
- minimum fresh-context boot order;
- autonomy and irreversible-action boundaries;
- verification expectations;
- project-memory routing;
- definition of done.

Detailed memory mechanics remain in `docs/project/PROJECT_MEMORY_SYSTEM.md` and are loaded only when maintaining or porting the memory system. Decisions, lessons, charter, and cold history are also loaded only when relevant.

**Why**

GPT-6 Astra is more sensitive to instructions in `AGENTS.md` and stronger at inferring routine implementation detail. Overly broad always-loaded guidance can consume context, introduce irrelevant constraints, and make the model pause unnecessarily. A short control file plus conditional references gives Astra authority and completion boundaries without prescribing every step.

**Consequences**

- do not duplicate the full memory protocol in `AGENTS.md`;
- prefer contextual references over mandatory pre-reading;
- safe repository reads, local tests, focused branches, and PR work may proceed without per-step approval;
- production/destructive/credential/external irreversible actions still require explicit authorization;
- periodically re-audit `AGENTS.md` when model behavior or project workflow changes.

---

## D-021 — Measure and build agent capability before adding sandbox infrastructure

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

After Gates 0–7, reorder future work around the largest remaining product risk: broad, multi-step agent capability.

The sequence becomes:

1. trustworthy evaluation harness + honest current baseline;
2. owned multi-step agent loop;
3. completion/effect semantics plus cancellation and budgets;
4. deterministic capability qualification;
5. sandbox abstraction/E2B and isolation;
6. production security/durability/product layers.

Gate 8 no longer requires >=95% success. It validates the benchmark and records Baseline 0. The >=95% first-attempt target moves to the later deterministic qualification gate after the owned agent loop exists.

E2B is introduced through an owned sandbox abstraction rather than as agent logic.

**Why**

The existing evidence proves Steel/Stagehand integration, stored-state durability, replayable events, and artifacts, but the RunEngine still performs one observe/select/act cycle and the 10/10 semantic regression repeats one simple fixture with a deterministic fixture LLM. Infrastructure repetition is not evidence of general autonomous web-task capability.

Adding E2B before measuring/fixing that capability would increase infrastructure complexity without attacking the dominant uncertainty.

**Consequences**

- evaluation metrics begin before agent-loop implementation;
- benchmark tasks/evaluators are versioned and resistant to score-gaming;
- cancellation/budgets/effect semantics move before sandbox expansion;
- profiles move after tenant/security/durable-worker foundations;
- public exposure requires explicit isolation, network, authentication, tenancy, and durable execution gates.

---

## D-022 — Astra is the sales product; browser and voice are replaceable substrates

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

Astra's product mission is to become our company's autonomous consultative sales agent and public proof of the AI-native company/workforce transformation service it sells.

The proven browser/run platform on `main` is retained as Astra's research/evidence/browser-action substrate. Realtime voice/avatar systems are conversation interfaces. Neither browser automation nor avatar rendering defines the product.

The owned product layer centers on sales-domain contracts, business ontology, durable prospect/buyer/opportunity state, evidence-backed strategy, permissioned action execution, evaluation, and experience memory.

**Why**

Gates 0–7 prove valuable infrastructure but not a customer-facing product outcome. The user's explicit priority is now a seller that can find/research prospects, conduct consultative conversations, earn next steps, execute authorized actions, and demonstrate verified outcomes.

D-021 already requires capability/evaluation work before infrastructure expansion. This decision applies that capability-first discipline to the sales product rather than returning to generic browser breadth as the north star.

**Consequences**

- Gates 0–7 remain valid historical foundation.
- Future gates from Gate 8 are sales-product gates.
- Generic browser capability grows only when a sales gate or measured reliability gap requires it.
- One outward seller remains the default; internal components are not separate customer-facing personas.
- Product success is measured by sales quality and real outcomes, not browser benchmark breadth alone.

**Revisit when**

Only if measured product evidence shows the company should return to a general-purpose browser-agent product rather than Astra as the primary sales product.

---

## D-023 — Reuse draft sales/voice work selectively; do not merge PR #2 wholesale

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

Treat draft PR #2 / `codex/sales-avatar-foundation` as a source of reusable contracts, tests, and implementation patterns rather than a branch to merge wholesale into current `main`.

Potentially reusable elements include:

- sales-state/canonical-decision boundaries;
- action proposal/confirmation semantics;
- adversarial action-security tests;
- SalesOS trajectory/reward/experience concepts;
- Qwen/GPT-Live/HeyGen and native GPT-Live voice adapters.

Port/adapt only what satisfies the current main-branch sales contracts and gate acceptance.

**Why**

The draft branch contains useful work but was built against an older repository shape and a generic SaaS sales ontology. Its intended live GPT-Live + HeyGen acceptance is incomplete. A wholesale merge would combine two large architectures before the new product contracts and multi-step capability baseline are stable.

**Consequences**

- Gate 8 defines owned sales-domain contracts first.
- Gates 9–11 establish the owned loop/effect semantics/research qualification before voice work.
- Gate 16 may selectively reuse sales-state/canonicalization concepts.
- Gate 17 benchmarks/selects a voice route using measured latency/reliability.
- Old branch tests are reference evidence, not proof that ported main-branch behavior works.

**Revisit when**

If later comparison shows a rebased merge is lower risk than selective porting while preserving current contracts and all gate evidence.

---

## D-024 — Public demonstration output must be derived from verified evidence

**Date:** 2026-09-19  
**Status:** Accepted

**Decision**

Astra should eventually demonstrate its own sales results publicly, including LinkedIn/X-ready proof, but public claims must be generated from verified run/outcome evidence.

Early versions may create `PublicProof` artifacts and social-post drafts. External publication remains an explicit action requiring authorization until the bounded-autonomy gate establishes capability scope, platform constraints, redaction, idempotency, rate limits, and incident controls.

**Why**

The demonstration is part of the product: an agent that sells itself is stronger evidence than a marketing description. But reputation-changing publication converts model output into an external factual claim and must use the same server-owned-truth discipline as pricing/action execution.

**Consequences**

- no metric/outcome appears in public proof without durable evidence;
- prospect/customer PII and private data are excluded by policy/tests;
- drafting does not imply permission to publish;
- published demonstrations remain traceable to a run/policy version;
- autonomous posting is a later capability, not a prompt instruction.

**Revisit when**

After Gate 22 demonstrates bounded, revocable autonomous external actions and the operator explicitly enables publication capability.

---

## D-025 — RunEngine owns durable lifecycle; agent-loop owns repeated orchestration

**Date:** 2026-09-19
**Status:** Accepted

**Decision**

`RunEngine` owns the durable run lifecycle: run creation/status, persisted steps/events, artifacts, diagnostics, cleanup, and terminal run state.

`@astra/agent-loop` owns repeated observe → decide → act orchestration through the provider-neutral `AgentSession` contract. Stagehand remains a replaceable semantic `AgentSession` provider behind that owned boundary.

**Why**

Gate 9 needs autonomous multi-step behavior without moving Astra's lifecycle into Stagehand or another provider. Separating orchestration from durable lifecycle preserves provider replaceability, keeps the previous one-step RunEngine path available, and gives tests a deterministic policy boundary for completion and recovery.

**Consequences**

- loop policy decisions are explicit `ACTION | COMPLETE | FAIL | BLOCKED`;
- action recovery is explicit through `onFailure: CONTINUE | FAIL`;
- successful browser actions do not imply goal completion;
- RunEngine persists sanitized loop summaries and owns screenshots/terminal state;
- Stagehand can be replaced without changing the durable lifecycle contract.

**Revisit when**

Only if measured requirements show the lifecycle/orchestration split prevents correct cancellation, budgeting, effect tracking, or verified completion semantics.


---

## D-026 — Completion is verified separately from execution; uncertain irreversible effects stop retry

**Date:** 2026-09-19
**Status:** Accepted

**Decision**

Astra may persist a run as `COMPLETED` only after an owned completion verifier accepts the requested goal result. Browser/action success, an explicit loop `COMPLETE` decision, and output-schema validity are inputs to verification, not sufficient completion proof by themselves.

Run transport status and goal state remain distinct durable concepts. Terminal outcomes carry typed reasons.

Every action path also carries owned effect semantics `none | committed | unknown`. If an irreversible action reports an `unknown` effect, or reports failure after a committed effect, Astra blocks automatic retry rather than guessing whether the side effect happened.

**Why**

False completion and duplicate irreversible effects are higher-severity failures than explicit failure. Provider success flags cannot prove the requested business/research goal, and provider timeouts cannot safely establish whether a side effect committed.

**Consequences**

- `RunEngine` owns completion verification, cancellation, wall-clock bounds, terminal persistence, and cleanup;
- `@astra/agent-loop` owns action-count/model budgets, repeated-action detection, and effect-aware retry blocking;
- cancellation propagates through owned `AbortSignal` boundaries rather than provider-specific control paths;
- `CANCELLED` remains a run lifecycle status while the bounded goal state stays `IN_PROGRESS | COMPLETED | FAILED | BLOCKED`;
- future irreversible action providers must return defensible effect state before retry policy can act.

**Revisit when**

Only if later durable action receipts/idempotency contracts provide stronger provider-independent proof that changes how `unknown` effects or completion verification should be represented.


---

## D-027 — Qualification ground truth is frozen outside candidate inputs

**Date:** 2026-09-19
**Status:** Accepted

**Decision**

ResearchBench qualification tasks and evaluator expectations are frozen before measuring a candidate. Candidate inputs contain only the public research task: scenario ID/tier/category, company, goal, requested fields, and start page. Fixture page internals and expected answers remain evaluator-only ground truth.

Core and hard tasks are reported separately. The release criterion applies to the frozen core suite (>=95% first-attempt success) together with zero false completions and zero unsupported claims; hard-task success remains challenge evidence and is not retroactively converted into a release threshold after results are known.

**Why**

A benchmark that exposes expected answers to the candidate, edits failing tasks after measurement, or silently changes the release population cannot distinguish capability from score-gaming. Research qualification also needs stronger failure semantics than pass rate alone because a plausible but unsupported completed report is worse than an explicit failure.

**Consequences**

- `@astra/research-bench` owns versioned tasks, evaluator ground truth, scoring, and core/hard reporting;
- browser/model candidates receive no expected-answer oracle;
- every material finding must reference evidence actually observed from the fixture source;
- unknown information must remain unknown rather than being promoted to a fact;
- first-attempt failures and harness defects are preserved as evidence even when later corrected;
- Gate 11 qualification does not claim paid hosted-model generalization; it qualifies the owned deterministic research path.

**Revisit when**

When a new benchmark version is intentionally created with a documented task-distribution change, or when a hosted-model qualification lane is added without changing ResearchBench v1 history.


---

## D-028 — Sandbox isolation is owned; self-hosted Steel endpoints are single-tenant until proven otherwise

**Date:** 2026-09-19
**Status:** Accepted

**Decision**

`@astra/sandbox-runtime` owns sandbox lifecycle, isolation identity, and network-policy semantics. Browser and agent providers consume those owned contracts; they do not define whether a run is isolated.

Untrusted browser research is fail-closed: destinations require explicit hostname egress allowance, explicit navigation receives Astra-owned scheme/credential/port/DNS/IP checks, and Stagehand applies the generic context-wide domain policy to redirects, popups, and subresources.

The pinned self-hosted Steel provider is treated as single-tenant per endpoint. Astra rejects a second concurrent browser session on the same Steel endpoint. Concurrent isolated runs require distinct verified Steel endpoints or a future provider that passes the same owned isolation tests.

**Why**

Gate 12's first provider acceptance showed that two separate Steel session IDs on one pinned self-hosted endpoint shared cookie/localStorage because the service reused one Chrome profile. Provider session identity is therefore not evidence of storage, process, filesystem, or network isolation.

**Consequences**

- `RunEngine` persists an owned `isolationId` without learning Steel/E2B/provider APIs;
- Stagehand remains sandbox-provider-neutral and consumes only `BrowserNetworkPolicy`;
- self-hosted Steel enforces one active Astra browser session per endpoint;
- simultaneous acceptance uses independent pinned Steel endpoints and proves browser-state plus OS/container isolation;
- sequential endpoint reuse is allowed only after fail-closed browser-state cleanup succeeds;
- sandboxed agent code receives no filesystem/process/environment/raw-port capability;
- E2B or another provider may be added later only behind the same contract and acceptance tests.

**Revisit when**

A self-hosted Steel release or another provider demonstrates concurrent storage/process/filesystem/network isolation on one endpoint under the owned Gate 12 tests.

---

## D-029 — Pull trustworthy internal value validation ahead of feature breadth

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

Use the September 2026 technical/commercial audit to tighten the post-Gate-12 order without discarding the existing architecture.

Gate 13 now owns three things before it can pass:

1. close the demonstrated trust gaps that would invalidate a live research measurement;
2. wire one complete human-supervised internal workflow from approved target through reviewed brief;
3. measure that workflow against the existing human process on a frozen operator-approved sample.

Keep execution serial/single-owner for this phase. Multi-worker operation remains blocked until durable cancellation intent, leased/fenced ownership, atomic guarded transitions, reconciliation, and centrally owned browser-endpoint allocation exist.

After the text seller is qualified, prove one durable real human handoff before realtime voice/avatar. Voice is retained only if measured outcome/reliability/cost evidence justifies its complexity.

Before Astra accepts data for an external agency/client organization, require an explicit operating boundary for identity/authorization, tenant/client ownership, per-client offers/ICP/claims, approval roles, budgets, retention/export/deletion, audit, and recovery.

**Why**

The audit found that Astra has substantial reusable infrastructure but no complete shipped operator workflow or measured customer value. It also reproduced request-policy, terminal-persistence, SSE replay, evidence-provenance, and evaluator gaps that can make a live result look stronger than the underlying guarantees. Building more connectors, voice, or presentation layers before resolving those gaps would delay the decisive product experiment.

**Consequences**

- Gates 0–12 remain passed historical evidence; their benchmarks are not weakened or rerun to manufacture a better story.
- Gate 13 is broader than public-site browsing: it is the trust-hardening and internal-value checkpoint.
- deterministic ResearchBench/SalesBench numbers are reported as benchmark evidence, not sales competence or conversion likelihood;
- `IMPLEMENTED`, `WIRED`, `REAL_MODEL_TESTED`, `LIVE_TESTED`, and `COMMERCIALLY_VALIDATED` remain distinct evidence states;
- one durable human handoff precedes Gate 18 voice selection;
- an external agency/design-partner pilot cannot silently bypass tenancy/client-operation requirements;
- the modular TypeScript/PostgreSQL/provider-adapter architecture remains; no microservice rewrite or runtime agent swarm is justified by this audit.

---

## D-030 — Separate calibration from Gate 13 acceptance evidence

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

Gate 13 distinguishes small **calibration** samples from the **acceptance** cohort that can support a gate verdict.

Calibration samples may contain up to 10 approved targets and are diagnostic only. They may exercise cross-region/source diversity, workflow mechanics, cost accounting, and reviewer instructions, but they always return no pass/fail verdict.

A Gate 13 acceptance sample must contain 30–50 frozen approved targets from the chosen commercial niche, consistent with the September audit. Acceptance outcomes require a measured human baseline rather than a fixed-cap estimate, and the baseline measurement timestamp must predate the Astra attempt. Review mode is recorded so blind versus unblinded evidence remains visible.

**Why**

The initial six-company U.S./China set is useful for calibration but is too small and too heterogeneous to support a commercial conclusion. With six targets, a 90% usability threshold effectively requires 6/6 and remains highly sensitive to one observation. More importantly, the audit explicitly called for roughly 30–50 approved companies across the chosen niche, comparison with the existing human workflow, and blind review where practical.

A fixed 15-minute human baseline entered after seeing Astra output would also create hindsight bias. The acceptance experiment must measure the actual baseline before the corresponding Astra run.

**Consequences**

- the six-company U.S./China set is calibration/stress evidence, not Gate 13 acceptance evidence;
- calibration metrics may guide source-policy and workflow improvements but cannot close Gate 13;
- the acceptance cohort is 30–50 targets in one explicit niche/cohort definition;
- acceptance outcomes require `MEASURED_HUMAN` baseline provenance recorded before the Astra attempt;
- review mode is durable evidence and blind review is preferred where practical;
- the frozen cost ceiling remains pre-registered and must include rationale;
- failed attempts remain in the denominator.

**Revisit when**

Only if a later experiment is deliberately redesigned with a documented statistical/commercial rationale and a new protocol version. Existing calibration and acceptance results are never relabeled retroactively.

---

## D-031 — First Gate 13 acceptance is single-market and uses the human's normal tools

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

The first Gate 13 acceptance cohort must represent one commercial market and compare Astra against the existing human workflow using that workflow's normal research tools.

Cross-market U.S./China work remains valuable calibration evidence because the source ecosystems differ materially, but it cannot support one pooled Gate 13 commercial verdict. Scope-matched human baselines are also calibration-only; acceptance uses the real human process even when that gives the human access to more sources than Astra's current one-page workflow.

Every frozen sample records its selection method, market scope/description, and human-baseline mode. Gate 13 acceptance rejects `CROSS_MARKET` and `SCOPE_MATCHED` sample settings.

**Why**

The product question is whether Astra saves meaningful human preparation effort without increasing factual risk, not whether Astra can beat an artificially restricted human on the same page. The September audit asked for comparison with a human researcher using normal tools.

The China source stack is not interchangeable with the U.S. stack. Mainland LinkedIn local recruiting/talent-insight support was discontinued, while local official registries, Weixin/WeChat, Chinese recruitment platforms, and local media/video ecosystems carry materially different signals. Pooling markets before Astra has a region-specific source policy could hide a strong result in one market behind a weak result in another.

**Consequences**

- the six-company U.S./China set remains cross-market calibration only;
- first commercial acceptance uses one market plus one explicit niche/cohort definition;
- acceptance sample selection method is frozen before results to reduce hand-picking bias;
- the human acceptance baseline uses normal tools and is measured before Astra starts each corresponding target;
- China should receive a separate acceptance cohort when its local multi-source research policy is implemented and qualified;
- calibration may still use scope-matched baselines to debug workflow mechanics.

**Revisit when**

A region-specific multi-source research capability has deterministic and live evidence strong enough to justify a new cross-market protocol version or separately accepted regional cohorts.

---

## D-032 — Acceptance human baselines are durable pre-run state

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

Gate 13 acceptance no longer treats human-baseline timing as a field supplied later with the reviewed outcome.

For every acceptance target, the human baseline must be persisted as its own durable record after the sample is frozen and before Astra starts that target. The record owns sample/target identity, baseline source, researcher identity, preparation minutes, tooling description, notes, and a server-owned `recordedAt` timestamp.

The acceptance workflow fails closed when that baseline is missing. The later measured outcome references the baseline by ID and must exactly reproduce its source, server timestamp, and preparation minutes. Repository validation rejects mismatches.

**Why**

An operator-supplied timestamp stored only with the post-run outcome can be backdated accidentally or intentionally. That proves little about whether the human baseline was genuinely measured before Astra. The commercial experiment needs a stronger temporal boundary because the primary value metric is preparation-time reduction.

**Consequences**

- protocol advances to `gate13-measured-research-v4`;
- acceptance state order is: approval → sample freeze → durable human baseline → Astra run → review outcome;
- PostgreSQL owns the baseline record timestamp and enforces one baseline per sample/target;
- in-memory tests use an injected server clock for deterministic evidence;
- outcome persistence locks/rechecks sample, attempt, and durable baseline;
- calibration may still use fixed-cap baselines, but acceptance baseline records must be `MEASURED_HUMAN`;
- direct outcome entry cannot substitute different baseline minutes or timing.

**Revisit when**

Only if a later experiment replaces the human baseline with another independently persisted comparator protocol. Existing v4 acceptance evidence is never reconstructed from post-hoc timestamps.

---

## D-033 — First acceptance uses a complete public U.S. transportation universe

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

The first Gate 13 commercial acceptance cohort is the complete equity universe in the iShares U.S. Transportation ETF (IYT) holdings snapshot dated 2026-09-17.

The source snapshot contains 43 equity holdings and additional non-company cash/derivative rows. Gate 13 includes all 43 equity holdings and excludes only rows whose asset class is not equity. The benchmark/methodology reference is the S&P Transportation Select Industry FMC Capped Index.

The experiment niche is therefore **U.S. transportation operations**, not the broader and more subjective "industrial/logistics" label.

Protocol v5 freezes candidate-universe provenance with source name/URL/date, methodology URL, declared count, exact candidate target IDs, and selection strategy. The first acceptance uses `COMPLETE_UNIVERSE`: every frozen universe member must appear exactly once in the sample. No sampling seed or discretionary company exclusions are allowed.

The project snapshot is stored at:

`docs/project/data/gate13-us-transportation-universe-2026-09-17.json`

**Why**

A free-text selection method still permits subtle cherry-picking. A complete public universe is stronger evidence because the eligible companies are defined independently of Astra's expected performance.

IYT is designed around U.S. transportation equities and tracked 43 holdings on 2026-09-17. Its benchmark covers transportation sub-industries including air freight/logistics, cargo ground transportation, rail, marine, passenger airlines, and passenger ground transportation. This is operationally coherent enough for the first commercial experiment while remaining broad enough to expose company-size and operating-model variation.

**Consequences**

- all 43 equity members are candidate targets; cash, collateral, futures, and other non-company rows are not targets;
- target IDs are frozen from the public universe before target approval/start-page enrichment;
- later domain/start-URL approval may enrich a member but may not silently remove it from the complete universe;
- a blocked/inaccessible company becomes explicit failure evidence rather than an exclusion after results are known;
- first Gate 13 acceptance uses `COMPLETE_UNIVERSE`, not `DETERMINISTIC_SUBSET`;
- the sample cannot freeze unless its target IDs exactly equal the frozen 43-member universe;
- China remains a separate calibration track until a qualified local multi-source policy exists.

**Revisit when**

After Gate 13, a later protocol may use another independently defined universe or a deterministic subset with a frozen seed. Existing v5 acceptance evidence is never reinterpreted under a different universe.

---

## D-034 — Gate 13 time savings uses total Astra-side human labor

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

Gate 13 acceptance no longer measures Astra value with a single `astraHumanReviewMinutes` field.

Protocol v6 records the complete human-preparation workload attributable to the Astra path for each target:

- target setup / domain-start-page enrichment;
- evidence mapping and material source audit;
- corrections and brief finalization;
- failure triage;
- other measured operator work with an explicit description.

Each outcome also records whether the human time was measured by stopwatch or system timing. The acceptance evaluator sums all components and compares that total against the measured human baseline.

**Why**

The September audit's proposed threshold is a reduction in **median total human preparation time including review**. Counting only final review time can materially overstate product value by hiding operator setup, source verification, corrections, and failure handling.

The research workflow deliberately requires human evidence review, so that labor must be part of the value equation rather than treated as free.

**Consequences**

- protocol advances to `gate13-measured-research-v6`;
- `astraHumanReviewMinutes` is removed from v6 outcomes;
- the evaluator exposes median total Astra human preparation minutes;
- the 50% reduction threshold is calculated from total Astra human labor;
- failed attempts may still consume human triage time and therefore remain part of labor/cost evidence;
- calibration and acceptance results from earlier protocol versions are not silently reinterpreted.

**Revisit when**

If later UI/system instrumentation can capture operator labor directly, it may replace stopwatch input with system-timed components while preserving the same total-labor definition.

---

## D-035 — Gate 13 brief usability follows a frozen deterministic review rubric

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

Gate 13 acceptance no longer treats `accepted | minor_edit | major_edit | rejected` as a free reviewer label.

Protocol v7 freezes `gate13-brief-review-v1` in the sample and outcome. The only valid disposition is derived from the recorded correction severities and unsupported material claims:

- **accepted** — completed brief with zero minor, major, or critical corrections and zero unsupported material claims;
- **minor_edit** — completed brief with one or more minor corrections, zero major/critical corrections, and zero unsupported material claims;
- **major_edit** — completed brief with one or more major corrections, zero critical corrections, and zero unsupported material claims;
- **rejected** — completed brief with any critical correction or any unsupported material claim;
- **not_produced** — failed research attempt.

Correction severity definitions are frozen for this rubric:

- **minor** — wording, formatting, clarity, or presentation change that does not alter the material factual meaning, opportunity thesis, buying signal, or requested decision;
- **major** — substantive rework to a material claim, opportunity framing, buying signal, or requested field while the brief remains salvageable without restarting the research task;
- **critical** — wrong company, materially false/misleading content, unsupported material claim, unsafe/unauthorized action, or a brief that cannot be made usable without re-research.

**Why**

The Gate 13 threshold requires at least 90% of briefs to be usable with only a minor edit. Without a frozen rubric, reviewers can unconsciously move the boundary after seeing results, which makes the usability metric vulnerable to hindsight bias.

**Consequences**

- protocol advances to `gate13-measured-research-v7`;
- sample and outcome both carry the frozen review-rubric version;
- schema validation rejects a disposition inconsistent with correction counts or unsupported claims;
- an unsupported material claim cannot be counted as a usable minor-edit brief;
- the usability metric remains `accepted + minor_edit`, but those labels now have deterministic semantics;
- existing results from prior protocol versions are not reclassified retroactively.

**Revisit when**

Only through a new versioned rubric and protocol with explicit migration/benchmark rationale. Historical v7 outcomes retain their original rubric.

---

## D-036 — Acceptance-target authorization is one atomic manifest-bound batch

**Date:** 2026-09-20
**Status:** Accepted

**Decision**

When the operator authorizes the first Gate 13 acceptance universe, Astra records the authorization as one atomic approval batch rather than 43 unrelated target writes.

The batch owns:

- one batch ID;
- the exact approval-candidate manifest ID;
- the SHA-256 of the exact manifest bytes reviewed by the operator;
- one operator identity and approval timestamp;
- the full set of approved target records.

Every target's approval provenance must match the batch operator/timestamp, target IDs and approval IDs must be unique, and the repository either persists the batch plus every target or persists nothing.

**Why**

The acceptance cohort is a complete frozen universe. Partial success during approval could leave an ambiguous state where some companies are authorized and others are not because of a typo, duplicate, or transient storage failure. Separate target writes also make it harder to prove which version of the candidate manifest the operator actually reviewed.

**Consequences**

- metadata enrichment remains non-authoritative until the batch transition occurs;
- PostgreSQL stores an approval-batch audit row and links batch-approved targets through `approval_batch_id`;
- duplicate/existing target failure rolls the entire batch back;
- single-target approval remains available for calibration/other controlled use, but the 43-member acceptance transition uses the batch path;
- the batch stores manifest hash provenance but does not itself browse or contact any company.

**Revisit when**

If a future operator UI introduces signed approvals, the signature may extend this batch record; the atomic all-or-none authorization boundary remains.



---

## D-037 — Gate 13 live execution has one database-scoped operator owner

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

The Gate 13 `run-target` operator command must hold one PostgreSQL session-level advisory lock for the entire live research execution.

The command uses a fail-fast `pg_try_advisory_lock` boundary before creating the live workflow. A second process connected to the same Gate 13 database cannot start another live target while the first owner holds the lock. The owning session releases the advisory lock in cleanup, and PostgreSQL session termination remains the final lock-release backstop.

This guard applies to live `run-target` execution only. Approval, sample freeze, baseline entry, artifact review, attempt/outcome persistence, status, and evaluation remain separate operator transitions.

**Why**

Gate 13 is deliberately serial/single-owner under D-029, but the existing workflow and Steel endpoint guards were process-local. Two shell processes could therefore bypass those in-memory guards and contend for the same live research executor/provider. That would invalidate the measured experiment's ownership assumptions.

A database-scoped advisory lock closes that accidental cross-process concurrency gap with the smallest mechanism already available in Gate 13's required PostgreSQL control plane.

**Consequences**

- one Gate 13 database permits at most one active `run-target` operator process;
- contention fails closed immediately rather than waiting or starting a second browser session;
- tests prove exclusivity across two real PostgreSQL sessions and availability after release;
- `apps/gate13-operator/**` changes trigger the Stagehand/Steel/PostgreSQL provider workflow;
- this is not a durable worker lease, fencing token, cancellation-intent record, or multi-worker scheduler;
- multi-worker execution remains blocked until the stronger ownership/fencing requirements in D-029 are implemented and accepted.

**Revisit when**

Replace or subsume this advisory lock only when Astra has durable leased/fenced run ownership, durable cancellation intent, reconciliation, and centrally owned browser-endpoint allocation that can safely support more than one worker.


---

## D-038 — Gate 13 human-audit completeness is derived from durable observed evidence

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

For a completed Gate 13 research attempt, the required human source/screenshot audit count is the number of durable observed evidence records in the persisted attempt report.

A reviewed completed outcome is valid only when `materialClaimsReviewed` exactly equals `attempt.report.evidence.length`. A failed/not-produced attempt requires zero reviewed material claims.

The Gate 13 operator review payload does not accept `materialClaimsReviewed` as free operator input. The operator surface derives the value from the durable attempt, and repository context validation independently rechecks it before outcome persistence.

Each durable evidence observation is one audit unit. This is intentionally evidence-based rather than claim-object-based: one observed source statement can ground multiple claims, while `Prospect.evidenceIds` already equals the complete durable observed-evidence set and observed claims must exactly match referenced observations.

**Why**

Before the first live acceptance run, the v7 outcome schema allowed a completed brief to report zero reviewed material claims while still receiving an `accepted` disposition if corrections and unsupported-claim counts were zero. That made the requirement to human-audit every material observed fact procedural rather than fail-closed.

Counting durable observed evidence closes that gap without inventing model-based semantic verification or double-counting the same observation when it supports multiple claim objects.

**Consequences**

- completed outcomes cannot persist unless every durable observed evidence item is represented in the human-audit count;
- direct PostgreSQL repository callers are subject to the same context check as the operator surface;
- failed/not-produced outcomes retain a zero audit count;
- unsupported material claims still force `rejected` under the unchanged `gate13-brief-review-v1` disposition rubric;
- capture receipts still prove provenance/bytes, not semantic truth; a human still performs the source/screenshot support judgment;
- the v7 usability labels and frozen acceptance thresholds are unchanged; this is a pre-result completeness hardening, not a rubric relaxation or post-hoc threshold change.

**Revisit when**

A later protocol may replace the aggregate audit count with durable per-claim/per-evidence human-review receipts. Any replacement must preserve full coverage of the durable observed-evidence set and must not weaken historical acceptance requirements.


---

## D-039 — Gate 13 delivery cost is derived from a frozen source-attributed rate plan

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

Before the first Gate 13 acceptance sample is frozen, the sample must also freeze a versioned delivery-cost accounting plan.

Each rate records:

- a stable rate ID and cost category;
- the measured meter it prices (model token class, run duration, or fixed per run);
- units per billing unit, USD per billing unit, and rounding rule;
- a human-readable resource/rate description;
- the rate source description, optional source URL, and source-as-of date.

Acceptance requires at least explicit `MODEL` and `BROWSER_PROVIDER` cost categories. Rate-source dates may not be later than the sample freeze.

The operator review payload no longer supplies `deliveryCostUsd`. At outcome persistence, Astra reads the durable local `run-summary.json`, binds it to the attempt's durable run ID, uses measured Stagehand token counts and total run duration where the frozen meters require them, deterministically calculates each rate component, and persists both the component calculation snapshot and its total. The scalar `deliveryCostUsd` is derived from that evidence.

**Why**

The Gate 13 acceptance threshold already requires complete delivery cost and freezes a per-brief ceiling before results. A free post-hoc dollar scalar cannot prove whether model, browser/provider, proxy, or other costs were actually included, nor which rate card or allocation was used.

PR #92 supplies measured model token evidence. Binding that usage and run duration to a pre-frozen source-attributed plan makes the cost threshold reproducible without pretending that self-hosted infrastructure has the same price as a managed cloud product.

**Consequences**

- acceptance sample freeze requires a delivery-cost plan in addition to the existing positive ceiling and rationale;
- acceptance outcomes require source-attributed cost evidence bound to the durable attempt run;
- the repository rechecks the frozen rate snapshot, run identity, rounding, component arithmetic, and total;
- missing required run-summary/model-usage evidence fails closed when the frozen plan needs it;
- failed attempts remain in the cost denominator when a durable run exists;
- managed-provider rates may use the applicable official rate card, while self-hosted Steel must use an explicit documented infrastructure allocation rather than silently copying Steel Cloud pricing;
- the frozen v7 usability/time/cost thresholds, review rubric, cohort, and denominator do not change.

**Revisit when**

A later provider/billing integration may replace operator-frozen rate inputs with signed or API-fetched billing receipts. The evidence must still remain bound to the measured attempt and preserve historical pricing provenance.


---

## D-040 — Gate 13 duration and unauthorized-action counts are server-derived from durable runs

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

For service-generated Gate 13 research attempts, Astra snapshots two run measurements from durable owned state:

- `runDurationMs` — the terminal run `updatedAt - createdAt` timestamp delta;
- `unauthorizedActions` — the count of durable `ACT` and `AGENT_LOOP_ACTION` run steps.

The Gate 13 research policy is intentionally read-only and returns `COMPLETE` without calling `act()`. Therefore any durable owned action step in this workflow is unauthorized for the measured experiment.

Acceptance reviewer input no longer supplies `endToEndDurationMs` or `unauthorizedActions`. The outcome builder derives both from the durable attempt, and repository context validation requires exact equality. Acceptance attempts without these server-derived measurements are rejected.

Legacy/calibration attempt records may omit the new snapshots for compatibility, but they cannot satisfy Gate 13 acceptance context without them.

**Why**

A reviewer-entered duration/action count is weaker evidence than the run system already owns. The run repository has server timestamps and an ordered durable step audit. Using those sources removes two post-hoc degrees of freedom before the first live acceptance result exists.

**Consequences**

- end-to-end run duration is reproducible from durable run timestamps;
- the no-unauthorized-action acceptance metric is tied to the owned action audit rather than reviewer assertion;
- source-attributed browser-duration cost uses the same durable attempt duration;
- an unexpected `ACT` / `AGENT_LOOP_ACTION` step is preserved as non-zero unauthorized-action evidence rather than silently normalized to zero;
- this measurement proves the owned Astra action path only; network/sandbox/provider controls remain separate protections against behavior outside that action-step audit;
- the v7 cohort, review rubric, thresholds, and denominator remain unchanged.

**Revisit when**

If a future research workflow intentionally permits approved browser actions, replace the simple action-step count with a durable action-authorization ledger that distinguishes authorized from unauthorized effects.


---

## D-041 — Gate 13 freezes and verifies the live execution profile before browsing

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

The first Gate 13 acceptance sample must freeze an execution profile alongside its cohort, thresholds, human-baseline policy, and delivery-cost plan.

The profile records:

- execution-profile version;
- owned agent runtime (`STAGEHAND`) and the pinned Stagehand package version;
- exact model name;
- exact credential-free model base URL, or `null` when Stagehand/provider defaults are intentionally used;
- owned browser runtime (`STEEL`);
- exact credential-free Steel base URL;
- the immutable Steel image pin expected by the current checkout;
- browser identity evidence mode `EXPECTED_IMAGE_PIN_ONLY`, which explicitly does **not** claim the already-running endpoint's container digest was attested.

The Gate 13 operator constructs the actual runtime profile from `GATE13_MODEL_NAME`, optional `GATE13_MODEL_BASE_URL`, `GATE13_STEEL_BASE_URL`, the checked-in Stagehand dependency version, and `infra/steel-image.txt`. Before `workflow.start()`, it requires exact equality with the frozen sample profile. A mismatch creates no research run and opens no browser session. API keys are excluded from the profile.

After the profile passes, the operator persists the matched profile as a `GATE13_EXECUTION_PROFILE` run step. If that audit write fails, the owned run is cancelled; cancellation failure is surfaced together with the audit failure.

**Why**

D-039 makes delivery cost reproducible from frozen rates plus measured usage, but pricing provenance is only meaningful if the model and browser endpoint being priced are the same runtime configuration actually used by the experiment. Environment-driven model/endpoint drift after sample freeze would otherwise make the cost and quality evidence non-comparable.

**Consequences**

- acceptance sample preview/freeze requires an operator-supplied execution-profile file;
- Stagehand remains pinned at the repository's exact dependency version and the live profile resolves that value from the checkout rather than a duplicated constant;
- model name/base URL, Steel base URL, Stagehand dependency version, and expected Steel image pin cannot change between freeze and live execution without an explicit new frozen sample/profile;
- Steel health proves endpoint availability, not container-digest identity; stronger runtime attestation remains future work;
- API keys are never placed in the execution profile;
- endpoint URLs must be credential-free HTTP(S) base URLs without query strings or fragments;
- the execution profile does not authorize the target cohort and does not weaken any Gate 13 v7 threshold;
- changing model/provider/runtime for a later experiment requires a newly frozen execution profile and separately applicable cost-rate provenance.

**Revisit when**

A future runtime exposes signed provider/model deployment identities or immutable deployment IDs. Prefer those stronger identifiers over URL/name matching while retaining historical profile provenance.


---

## D-042 — Gate 13 requested-field coverage is frozen and derived from durable research truth

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

Gate 13 acceptance freezes one exact requested-field ledger before results:

- `companyName`;
- `companySummary`;
- `transformationOpportunities`;
- `buyingSignals`.

The acceptance reviewer does not supply `requestedFieldsTotal` or `requestedFieldsCovered`.

For a completed durable research attempt, a requested field is covered when the canonical report either contains a value/list for that field or contains an explicit `unknowns[].field` entry with the exact requested-field ID. For a failed/not-produced attempt, covered requested fields are zero.

The persisted outcome carries the exact covered field IDs plus the derived total/count. Acceptance context validation requires that ledger to match the frozen sample and durable attempt. Final cohort evaluation independently rejects denominator/covered-ID drift from the frozen ledger.

**Why**

The measured protocol already reports requested-field coverage, but a reviewer-entered denominator can change the metric after seeing results. Repository tests also exposed inconsistent fixture totals of three versus four. Freezing the four business-facing output fields removes that post-hoc degree of freedom while preserving Astra's rule that unavailable information should be explicit unknown rather than fabricated.

**Consequences**

- every Gate 13 acceptance sample freezes exactly the same four requested fields;
- explicit unknowns count as addressed coverage, while silent omission does not;
- failed attempts remain in the denominator with zero covered fields;
- reviewer JSON cannot choose the denominator, covered count, or covered IDs;
- calibration may retain historical/manual coverage records for compatibility;
- the v7 usability threshold, correction-severity rubric, cohort, and denominator are unchanged.

**Revisit when**

A future protocol intentionally changes the sales-research brief schema or requested business fields. That requires a newly versioned protocol/rubric and must not rewrite historical v7 coverage.


---

## D-043 — Gate 13 preparation/readiness preflight is read-only and non-authoritative

**Date:** 2026-09-21
**Status:** Accepted

**Decision**

Gate 13 exposes two preflight modes before and during acceptance execution:

1. **offline acceptance preparation preflight** — no database, browser, approval, sample, baseline, run, or outcome mutation. It validates the exact canonical 43-target manifest/universe membership, requires the candidate manifest to remain `NOT_APPROVED`, verifies the proposed frozen execution profile against the current credential-free live configuration + repository pins, validates the versioned cost plan including required model/browser categories and non-future source dates, and requires a positive cost ceiling plus nonblank rationale and normal-tools human-baseline description. Success is labeled `PREPARED_NOT_AUTHORIZED`.
2. **durable acceptance readiness** — read-only database inspection that reports the next valid transition among atomic approval, sample freeze, measured-human baselines, remaining run/review work, and complete-cohort evaluation.

Before a sample is frozen, durable readiness requires an explicit approval-batch ID so it never reports “approval missing” merely because the operator omitted which batch to inspect. A supplied approval batch is independently reconstructed from the exact canonical manifest bytes and must match its provenance/targets; when a sample is frozen, its target snapshots must also match that supplied canonical batch.

**Why**

By Gate 13 the protocol has several intentionally frozen inputs. Without a single preparation check, operators can discover mismatched runtime identity, pricing provenance, business ceiling, baseline description, or cohort membership only after starting an irreversible durable transition. Conversely, a “green preflight” must never be confused with authorization.

Separating preparation from authorization makes the operator boundary explicit: inputs can be validated thoroughly before any real-company state is approved, while durable readiness can explain what transition is next without executing it.

**Consequences**

- `acceptance-preflight` is offline/no-DB and returns `PREPARED_NOT_AUTHORIZED` on success;
- `acceptance-readiness` is DB-read-only and reports the next durable transition;
- neither command can approve targets, freeze a sample, record a baseline/outcome, start a browser, or contact a company;
- canonical manifest status remains `NOT_APPROVED` until the guarded `approve` command is deliberately executed with explicit all-43 authorization;
- readiness cannot use an unrelated/stale approval batch to claim the cohort is ready;
- the v7 cohort, rubric, thresholds, denominator, and human-judgment boundaries remain unchanged.

**Revisit when**

A future operator UI can present the same preflight/readiness contracts interactively. The separation between preparation, authorization, and durable execution must remain explicit.
