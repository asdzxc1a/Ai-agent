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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

**Status:** NOT_STARTED

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

## Gate 8 — Deterministic eval suite

**Status:** NOT_STARTED

Build 25–50 fixture tasks covering:

- buttons;
- forms;
- validation;
- search;
- dropdowns;
- modal;
- popup;
- new tab;
- iframe/nested iframe;
- table;
- dynamic table;
- cart;
- calendar;
- upload;
- loading delay;
- infinite scroll;
- virtualized list;
- shadow DOM;
- cookie/session persistence.

Each fixture records:

- goal;
- expected state/result;
- maximum step count;
- timeout.

Acceptance:

- core deterministic suite >= 95% success;
- every regression is reproducible locally;
- benchmark results are stored per CI/nightly run.

**Pause here and benchmark before adding E2B.**

---

## Gate 9 — E2B adapter

**Status:** NOT_STARTED

Build:

- E2B template/environment containing Steel + Chromium;
- `E2BSteelBrowserProvider`;
- sandbox lifecycle;
- port/CDP exposure.

Acceptance:

- unchanged Gate 2/3 contract tests pass through E2B provider;
- Stagehand and API code do not change to support E2B;
- sandbox always terminates after test.

---

## Gate 10 — Isolation

**Status:** NOT_STARTED

Build tests for two simultaneous sandboxes.

Acceptance:

- cookies do not cross;
- localStorage does not cross;
- files do not cross;
- terminating one sandbox does not affect the other;
- browser/session identifiers do not collide.

---

## Gate 11 — Cancellation + budgets

**Status:** NOT_STARTED

Build:

- max steps;
- wall-clock timeout;
- model-cost budget;
- cancellation propagation.

Acceptance:

- cancel propagates run → agent → browser → sandbox;
- resources are released;
- run state is correct;
- no zombie sandbox remains.

---

## Gate 12 — Profiles

**Status:** NOT_STARTED

Build V1 profile state:

- cookies;
- localStorage;
- sessionStorage where practical;
- encryption at rest;
- profile versioning.

Acceptance:

- Run A logs into a fixture;
- profile saved;
- browser destroyed;
- Run B uses a fresh browser;
- profile restored;
- user remains authenticated.

---

## Gate 13 — Production queue

**Status:** NOT_STARTED

Build only when local/durable runs are stable:

- worker queue;
- tenant concurrency;
- leases;
- retry policy;
- worker crash recovery.

Acceptance:

- concurrent load test;
- worker killed mid-run;
- durable state remains correct;
- duplicate irreversible actions are prevented or surfaced as unknown.

---

## Gate 14 — Controlled live-web evaluation

**Status:** NOT_STARTED

Build a small nightly suite using approved external sites.

Acceptance metrics:

- success rate;
- structured answer correctness;
- median/P95 duration;
- median/P95 step count;
- browser startup latency;
- browser crash rate;
- loop rate;
- cost/successful task.

Local fixture tests remain the release gate; live-web tests are trend/regression signals.

---

# Later product layers

Only after the core is reliable:

1. Profiles hardening.
2. Credential/Vault capability broker.
3. Search.
4. Fetch.
5. Research.
6. Monitor.
7. richer proxy/domain intelligence.
8. custom semantic snapshot layer.
9. specialized action model.
10. custom Chromium only when measurements justify it.

# Rule for changing this plan

Do not rewrite the roadmap casually.

A durable change requires:

- reason;
- evidence;
- update to `DECISIONS.md` if architectural;
- updated acceptance criteria;
- `STATE.md` updated to reflect the new next action.
