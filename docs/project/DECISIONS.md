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
