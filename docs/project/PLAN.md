# Build Plan

Status values:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `PASSED`

Only one gate should normally be `IN_PROGRESS`.

## Gate 0 — Repository + CI

**Status:** PASSED

Build:

- TypeScript workspace;
- package manager configuration;
- lint;
- typecheck;
- unit-test runner;
- build;
- GitHub Actions CI.

Acceptance:

- clean checkout installs deterministically;
- `pnpm lint` passes;
- `pnpm typecheck` passes;
- `pnpm test` passes;
- `pnpm build` passes;
- same commands run in GitHub Actions.

Do not add browser complexity yet.

---

## Gate 1 — Steel alone, local

**Status:** PASSED

Build:

- local Steel via supported Docker/Docker Compose;
- one deterministic fixture web page;
- `SteelBrowserProvider` spike;
- raw Playwright/CDP connectivity for verification.

Acceptance:

- create Steel session;
- navigate to local fixture;
- click deterministic button;
- verify changed state;
- capture screenshot;
- close session;
- repeat 10/10 successfully.

---

## Gate 2 — Stagehand → Steel

**Status:** PASSED

Build:

- Stagehand connects to Steel's CDP URL;
- `observe`;
- `act`;
- `extract`;
- structured result schema.

Acceptance:

- local deterministic fixture task completes 10/10;
- output schema validates;
- browser session closes every time;
- no leaked processes/sessions.

---

## Gate 3 — Our browser/agent interfaces

**Status:** PASSED

Build:

- `BrowserRuntime`;
- `BrowserSession`;
- `AgentRuntime`;
- Steel adapter;
- Stagehand adapter;
- fake implementations for unit tests.

Acceptance:

- Gate 2 test passes through our abstractions;
- application code contains no direct Steel-specific calls outside the Steel adapter;
- application code contains no direct Stagehand-specific calls outside the Stagehand adapter.

---

## Gate 4 — First product API

**Status:** PASSED

Build:

- `POST /v1/runs`;
- `GET /v1/runs/:id`;
- URL + goal + optional output schema;
- run IDs;
- structured result.

Acceptance:

- API request runs deterministic browser task;
- result matches schema and expected fixture state;
- failure returns typed error, not generic 500.

---

## Gate 5 — Durable run engine

**Status:** PASSED

Build:

- PostgreSQL;
- `runs`;
- `run_steps`;
- `run_events`;
- states: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.

Acceptance:

- run state survives API process restart;
- steps/events remain queryable;
- final result persists;
- no run is marked complete without final validation.

---

## Gate 6 — Replayable SSE

**Status:** PASSED

Build:

- `GET /v1/runs/:id/events`;
- monotonically increasing sequence IDs;
- reconnect support using last event ID.

Acceptance:

- disconnect client mid-run;
- run continues;
- reconnect receives missing events in order;
- final result exactly matches persisted run.

---

## Gate 7 — Artifacts + debugging

**Status:** PASSED

Build:

- screenshots;
- URLs;
- browser console errors;
- action summaries;
- timing;
- model/agent response metadata;
- local artifact storage first.

Acceptance:

- intentionally failing fixture leaves enough evidence to diagnose why it failed;
- secrets are not present in normal logs/artifacts.

---

## Gate 8 — Evaluation harness + honest baseline

**Status:** NOT_STARTED

Purpose:

- build a trustworthy local evaluation system before improving agent intelligence;
- measure the current engine honestly rather than assuming broad capability.

Build an initial 12–15 deterministic fixture tasks covering:

- single click;
- two-step navigation;
- form input;
- validation;
- dropdown;
- search/results;
- modal;
- new tab;
- iframe;
- table;
- delayed content;
- simple cart;
- cookie/session state.

Each task records:

- stable task ID and category;
- start URL;
- natural-language goal;
- deterministic expected state/result;
- maximum step count;
- timeout.

Build two distinct evaluation lanes:

1. **Contract/infrastructure lane** — scripted/fake agent behavior to prove browser, run engine, persistence, events, artifacts, evaluator, and cleanup.
2. **Capability lane** — real pinned model/configuration against deterministic local sites to measure semantic/action capability.

Record from Gate 8 onward:

- task/fixture version;
- git commit;
- model/configuration;
- first-attempt success;
- failure category;
- steps;
- duration;
- model usage/cost when available;
- action failures;
- loop count;
- artifact completeness.

Acceptance:

- task format and deterministic evaluator are versioned and testable;
- every fixture/evaluator is reproducible locally;
- contract lane runs deterministically in CI;
- the current engine is measured as **Baseline 0** without changing the benchmark to improve its score;
- capability results are stored as benchmark evidence when a real model run is available;
- Gate 8 passes on evaluation-system trustworthiness, not on achieving a target success rate.

---

## Gate 9 — Owned multi-step agent loop

**Status:** NOT_STARTED

Purpose:

Turn Stagehand primitives into an owned multi-step execution loop.

Build:

- an owned loop/executor boundary separate from durable run lifecycle when evidence requires the seam;
- explicit decision outcomes such as `ACTION | COMPLETE | FAIL | BLOCKED`;
- repeated observe → decide → act → observe cycles;
- compact persisted trajectory/progress records;
- safe recovery path for recoverable action failures.

Keep Stagehand as a semantic capability provider inside owned orchestration.

Acceptance:

- a deterministic task requiring at least three browser actions completes through the owned loop;
- multiple action steps are persisted in order;
- progress evidence is sufficient to diagnose each step;
- a recoverable action failure can return control to the loop without corrupting run state;
- Gates 1–8 regressions remain green.

---

## Gate 10 — Completion, effects, cancellation + budgets

**Status:** NOT_STARTED

Purpose:

Make `COMPLETED` mean the requested goal was verified, and bound autonomous execution.

Build:

- goal state: `IN_PROGRESS | COMPLETED | FAILED | BLOCKED`;
- completion/verifier policy separate from action success;
- action effect semantics: `none | committed | unknown`;
- maximum steps;
- wall-clock timeout;
- model usage/cost budget;
- explicit cancellation propagation;
- loop detection;
- typed terminal reasons.

Acceptance:

- `act.success === true` cannot by itself mark a goal complete;
- step-limit, timeout, cost-budget, and explicit cancellation each terminate with correct durable state;
- resources are released on every termination path;
- no zombie Steel session remains;
- simulated `effect=unknown` after an irreversible action is never blindly retried;
- completion verifier rejects an intentionally wrong-but-schema-valid result.

---

## Gate 11 — Deterministic capability qualification

**Status:** NOT_STARTED

Purpose:

Measure whether the owned agent is reliable enough to justify sandbox/product infrastructure.

Expand to 25–50 deterministic tasks covering:

- forms and validation;
- search/results;
- dropdowns;
- modal/popup;
- new tab;
- iframe/nested iframe;
- table/dynamic table;
- cart;
- calendar;
- upload;
- loading delay;
- infinite scroll;
- virtualized list;
- shadow DOM;
- cookie/session persistence;
- multi-step navigation;
- recoverable and non-recoverable failures;
- irrelevant/distractor elements;
- prompt-injection-like page text.

Split tasks into:

- **core** — release-blocking tasks the product claims to support;
- **hard** — research/challenge tasks measured without blocking every merge.

Acceptance for the core suite:

- >= 95% **first-attempt** success over the agreed repeated qualification sample;
- 0 false-completed runs in the qualification sample;
- every failure is locally reproducible or explicitly classified as infrastructure/model variance;
- benchmark artifacts include per-task results, aggregate metrics, model/configuration, commit, and fixture version;
- Gate 1/2 lifecycle regressions remain 10/10;
- no known browser session leaks.

**Pause here and benchmark before adding E2B.**

---

## Gate 12 — Owned sandbox abstraction + E2B

**Status:** NOT_STARTED

Purpose:

Add isolation without coupling agent/product logic to one sandbox provider.

Build:

- owned `SandboxRuntime` / `SandboxSession` boundary;
- E2B implementation behind that boundary;
- environment/template containing Steel + Chromium;
- sandbox lifecycle;
- port/CDP exposure;
- composed sandboxed browser runtime.

Acceptance:

- unchanged product API and agent-loop contracts run through the sandboxed provider;
- Stagehand/agent-loop code does not gain E2B-specific types or calls;
- sandbox always terminates after success, failure, cancellation, and test teardown;
- local non-sandbox provider remains usable for deterministic development.

---

## Gate 13 — Isolation + network egress security

**Status:** NOT_STARTED

Build simultaneous-sandbox isolation tests for:

- cookies;
- localStorage/sessionStorage;
- filesystem;
- processes;
- ports;
- browser/session identifiers.

Add explicit browser/network egress policy.

Acceptance:

- state does not cross between two simultaneous sandboxes;
- terminating one sandbox does not affect the other;
- localhost, loopback, private RFC1918, link-local, and cloud-metadata targets are blocked by default for untrusted runs;
- redirect and hostname-resolution paths cannot trivially bypass the private-network policy;
- allowed public fixture navigation still works;
- isolation failures produce diagnosable evidence.

No public exposure before this gate passes.

---

## Gate 14 — Deployable service + authentication + tenancy

**Status:** NOT_STARTED

Build the production composition root:

- configuration;
- database pool + migrations;
- repositories;
- browser/sandbox runtime;
- agent runtime;
- artifact store;
- run engine;
- HTTP server;
- graceful shutdown;
- `/health` and `/ready`;
- request IDs and structured operational logging.

Add:

- API authentication;
- tenant/user identity;
- tenant ownership for runs, events, artifacts, cancellation, and later profiles.

Acceptance:

- the complete service runs outside integration-test composition;
- readiness fails when required dependencies are unavailable;
- graceful shutdown does not accept new work and releases owned resources;
- Tenant B cannot read, stream, download, cancel, or mutate Tenant A resources;
- unauthenticated access is rejected;
- existing single-tenant contract behavior remains covered.

---

## Gate 15 — Shared artifacts + durable-data sanitization

**Status:** NOT_STARTED

Build:

- shared/object artifact-store implementation behind `ArtifactStore`;
- local S3-compatible deterministic integration test;
- retention/lifecycle metadata;
- centralized durable-data sanitization policy for run steps/events/artifacts;
- explicit handling/classification for sensitive screenshots.

Acceptance:

- one process/worker writes an artifact and a fresh process can list/read it;
- fake secrets injected through URL, diagnostics, action arguments, step payloads, and metadata do not appear in sanitized durable JSON;
- artifact authorization remains tenant-scoped;
- local store remains supported for development/tests;
- artifact failures remain best-effort and do not corrupt authoritative run state.

---

## Gate 16 — Durable worker queue + crash recovery

**Status:** NOT_STARTED

Purpose:

Make execution durable, not only stored run state.

Build initially with PostgreSQL unless measurements justify another system:

- durable work claim;
- lease owner/expiry;
- heartbeat;
- attempt tracking;
- tenant concurrency limits;
- retry/recovery policy driven by action effect semantics;
- stale-run reconciliation.

Acceptance:

- API process can die after accepting a run without losing the work;
- worker killed before an action can be safely recovered by another worker;
- worker killed after `effect=none` may safely retry;
- worker killed after `effect=unknown` does not blindly repeat the irreversible action;
- terminal state/events remain consistent;
- concurrent-load test respects tenant/global limits.

---

## Gate 17 — Profiles / browser state

**Status:** NOT_STARTED

Build V1 profile state:

- cookies;
- localStorage;
- sessionStorage where practical;
- encryption at rest;
- tenant ownership;
- versioning.

Acceptance:

- Run A logs into a deterministic fixture;
- profile is saved;
- browser/sandbox is destroyed;
- Run B uses a fresh browser/sandbox;
- profile is restored and remains authenticated;
- Tenant B cannot enumerate/read/use Tenant A's profile;
- corrupted/incompatible profile data fails safely.

---

## Gate 18 — Credential / capability broker

**Status:** NOT_STARTED

Purpose:

Allow authenticated workflows without giving webpage content or the model unrestricted secret/action authority.

Build:

- capability policy outside model prompts;
- credential references instead of raw credentials in goals/prompts;
- controlled secret injection at the narrowest required boundary;
- explicit permissions for sensitive/irreversible action classes;
- prompt-injection security fixtures.

Acceptance:

- raw credential values are absent from model prompts and normal durable logs;
- a malicious fixture page cannot grant itself new capabilities;
- attempts to reveal credentials, visit forbidden targets, or execute blocked action classes are denied;
- allowed login workflow succeeds using brokered credentials;
- denials and capability use leave auditable sanitized events.

---

## Gate 19 — Controlled live-web evaluation

**Status:** NOT_STARTED

Build a small nightly/manual suite using approved external sites.

Track:

- completion rate;
- false-completion rate;
- structured-answer correctness;
- median/P95 duration;
- median/P95 steps;
- browser startup latency;
- browser crash rate;
- agent loop rate;
- policy blocks;
- anti-bot/external-site failures;
- cost/successful task.

Acceptance:

- live-web failures are classified separately from deterministic release regressions;
- local deterministic core suite remains the release gate;
- live-web results are stored as trend/regression evidence, never the sole proof a feature works.

---

## Gate 20 — Public-beta readiness

**Status:** NOT_STARTED

Build/verify:

- rate limits and quotas;
- artifact/data retention;
- backup + restore procedure;
- deployment rollback;
- graceful worker draining;
- metrics/traces/alerts;
- cost accounting;
- API documentation/versioning;
- first supported JS/TS SDK surface;
- data deletion workflow;
- production security review.

Acceptance:

- load test passes at approximately 2× the intended initial supported concurrency without correctness loss;
- backup/restore drill recovers authoritative run data;
- deployment rollback and worker draining are exercised;
- tenant/security tests remain green under load;
- operational dashboards/alerts cover the measured bottlenecks;
- documented public API matches tested behavior.

---

# Later product layers

Only after the core is reliable and measured:

1. Search.
2. Fetch.
3. Research.
4. Monitor.
5. richer proxy/domain intelligence.
6. custom semantic snapshot layer.
7. specialized action model.
8. custom Chromium only when measurements justify it.
9. Python SDK when real customer demand justifies it.
10. multi-region orchestration when single-region limits are measured.

# Rule for changing this plan

Do not rewrite the roadmap casually.

A durable change requires:

- reason;
- evidence;
- update to `DECISIONS.md` if architectural/product ordering changes;
- updated acceptance criteria;
- `TEST_STRATEGY.md` update when evidence requirements change;
- `STATE.md` updated to reflect the new next action.
