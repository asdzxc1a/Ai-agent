# 2026-09-19 — Gate 10 completion, effects, cancellation + budgets

## Result

Gate 10 passed in PR #60 at verified product head:

`4844b3e2043641eb50e270ae73797f7b072bb8b3`

Base:

`e9ea8720a691274446be8bf75285250d65dfb569`

Gate 10 makes terminal success an owned verified outcome rather than an inference from browser/action success, and bounds autonomous execution before research scope expands.

## What Gate 10 proves

- durable goal state is explicit: `IN_PROGRESS | COMPLETED | FAILED | BLOCKED`;
- terminal snapshots/events carry typed terminal reasons;
- `COMPLETED` requires an owned completion verifier;
- wrong-but-schema-valid output is rejected;
- browser/action success alone cannot complete a goal;
- action effects are explicit `none | committed | unknown`;
- uncertain or already-committed irreversible failures are never blindly retried;
- action limits, model token/cost budgets, wall-clock timeout, and repeated-action detection fail closed;
- explicit cancellation propagates through owned browser/agent boundaries;
- cancellation and timeout still clean agent/browser resources;
- PostgreSQL persists goal state and terminal reasons;
- real pinned-Steel cancellation reaches session status `released`.

## Review findings fixed before pass

### Durable decision-rejection sanitization preserved

`main` advanced during Gate 10 with PR #58. The Gate 10 branch was rebased and preserved its rule: durable `DECISION_REJECTED` progress uses an owned generic summary while the terminal failure retains diagnostic detail.

### Cancellation telemetry cannot gate abort

The first Gate 10 implementation appended `RUN_CANCELLATION_REQUESTED` before aborting active work. It was tightened so abort runs even if that telemetry write fails, with a deterministic cleanup regression.

### Hung policy must not defeat timeout

Passing an `AbortSignal` was insufficient if an owned policy promise never resolved. Loop/provider calls are now abort-raced, and a deterministic never-resolving policy reaches typed `RUN_TIMEOUT` with cleanup.

### Post-navigation screenshot race

Stagehand run `35458237687` exposed a real evidence race: Steel returned HTTP 500 for the first screenshot immediately after link navigation. Screenshot capture now waits for the next successful observe as a semantic settle condition, with a deterministic regression. No sleeps or screenshot retries were added.

### Clean-checkout test import

An intermediate CI run exposed a test importing a workspace package through unbuilt `dist`. The regression now follows the repository's source-relative test-import convention and was verified from a dist-free tree.

## Authoritative evidence

Final head `4844b3e2043641eb50e270ae73797f7b072bb8b3`:

- CI `35458628400` — PASSED
  - project-memory consistency;
  - lint;
  - strict typecheck;
  - 61/61 tests across 13 files;
  - all workspace builds.
- Steel integration `35458628419` — PASSED
  - pinned Steel startup;
  - ten-session raw Steel lifecycle regression;
  - screenshot artifact upload;
  - cleanup.
- Stagehand Steel integration `35458628399` — PASSED
  - pinned Steel + PostgreSQL startup;
  - three-action owned research loop with per-action screenshots;
  - real Steel cancellation/release acceptance;
  - legacy ten-session Stagehand → Steel regression;
  - HTTP API browser acceptance;
  - PostgreSQL repository/migration acceptance;
  - replayable SSE acceptance;
  - durable API restart acceptance;
  - cleanup.

Local final validation used Node 24.21.0 / pnpm 10.34.5 and passed `pnpm check`; the unit suite was 61/61 across 13 files.

## Boundary preserved

Gate 10 did not add live prospect research, outreach, voice/avatar, CRM/calendar/social actions, E2B, sandbox expansion, or new irreversible external side effects.

Next gate: Gate 11 — Deterministic prospect-research qualification (issue #61).
