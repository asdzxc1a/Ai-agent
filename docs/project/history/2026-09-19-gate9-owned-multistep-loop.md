# 2026-09-19 — Gate 9 owned multi-step sales-agent loop

## Result

Gate 9 passed in PR #55. Cold review found no product-code defect requiring a change to the verified implementation.

The gate establishes the ownership split recorded in D-025: `RunEngine` owns durable run lifecycle, `@astra/agent-loop` owns repeated observe/decide/act orchestration, and Stagehand remains a replaceable semantic `AgentSession` provider.

## What Gate 9 proves

- explicit `ACTION | COMPLETE | FAIL | BLOCKED` decisions with strict fail-closed validation;
- explicit `onFailure: CONTINUE | FAIL` recovery semantics;
- repeated observe → decide → act → observe cycles;
- browser action success alone cannot complete a goal;
- optional RunEngine loop execution preserves the previous one-step path when not configured;
- sanitized durable loop progress plus per-action screenshots;
- deterministic recovery after one explicitly recoverable failed action;
- a deterministic multi-page research fixture requiring three browser actions;
- real Stagehand → Steel acceptance through the owned loop.

## Verified product-code head

`ca2e27dbf991f3a6b6b3a5773b7de9d3f4b4694d`

Verified base at that time:

`4334dbad83f036f955cee5cfabee756ebf2f3a18`

## Authoritative evidence

- CI run `35454706979` — PASSED
  - memory consistency;
  - lint;
  - strict typecheck;
  - 43/43 tests across 12 files;
  - all workspace builds.
- Steel integration `35454706978` — PASSED
  - raw pinned-Steel regression: 2/2 tests, 21.950s.
- Stagehand Steel integration `35454706974` — PASSED
  - three-action research loop: 2.754s;
  - legacy 10-session Stagehand→Steel regression: 18.175s;
  - HTTP API browser acceptance: 2.124s;
  - PostgreSQL repository acceptance: passed;
  - replayable SSE: 642ms;
  - durable API restart: 2.132s;
  - cleanup: passed.

The deterministic RunEngine test separately proves an explicitly recoverable failed action can return control to the loop and still complete with coherent durable state.

## Boundary preserved

Gate 9 did not add live prospect research, outreach, voice/avatar, CRM/calendar/social actions, E2B, or new irreversible external side effects.

Next gate: Gate 10 — Completion, effects, cancellation + budgets (issue #56).
