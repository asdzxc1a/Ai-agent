# 2026-09-19 — Gate 9 owned multi-step sales-agent loop

## Purpose

Gate 9 moves Astra from one observe/select/act browser path to an Astra-owned multi-step orchestration loop before any live prospect research is allowed.

The gate proves deterministic orchestration and durable progress. It does not claim broad autonomous research capability, live prospecting, outreach, voice, CRM integration, or production readiness.

## Implemented

### Owned `@astra/agent-loop`

A new provider-neutral package owns repeated:

~~~text
observe → decide → act → observe → ...
~~~

Decision outcomes are explicit:

- `ACTION`;
- `COMPLETE`;
- `FAIL`;
- `BLOCKED`.

The executor runtime-validates decisions, rejects unexpected fields, bounds iteration count, and stores a compact trajectory of observations, decisions, and action outcomes.

Stagehand and Steel types do not enter the owned loop contract. The loop depends only on `AgentSession`.

### Action success is not goal completion

A successful `act()` result is stored as action evidence and returns control to the loop. It does not produce `COMPLETE`.

Completion requires a later explicit `COMPLETE` decision after another observation.

When a run supplies an output schema, `RunEngine` still performs final extraction/validation after loop completion. A failed verifier leaves the run `FAILED` even when:

- a browser action returned `success: true`; and
- the loop later returned `COMPLETE`.

This is covered by a focused regression.

### Recoverable action failure

Both:

- `act()` returning `success: false`; and
- `act()` throwing

become failed action outcomes in trajectory state. The next decision receives that evidence and may choose a recovery action.

A recoverable action failure therefore does not automatically corrupt or terminate the durable run.

### Durable ordered progress

`RunEngine` persists loop progress through the existing `RunRepository` boundary:

- `AGENT_LOOP_OBSERVE`;
- `AGENT_LOOP_DECISION`;
- `AGENT_LOOP_DECISION_REJECTED`;
- `AGENT_LOOP_ACTION`;
- `AGENT_LOOP_RESULT`;
- `RUN_PROGRESS` events.

Loop progress is redacted before persistence using the existing artifact redaction boundary.

When artifacts are enabled, an after-action screenshot is recorded for each executed loop iteration.

PostgreSQL coverage executes a three-action loop through `RunEngine`, creates a fresh repository instance, and verifies that ordered actions, decisions, progress events, and terminal state remain readable.

### Deterministic three-action research fixture

`test-sites/research-flow` exposes a local multi-page flow:

1. `/research` → `Open company profile`;
2. `/research/company` → `Open operations evidence`;
3. `/research/operations` → `Finish research`;
4. `/research/complete` → final `RESEARCH_RESULT`.

A deterministic Stagehand fixture LLM selects real encoded elements from each page and extracts the final structured result.

The Gate 9 integration acceptance uses the real Stagehand adapter over the pinned Steel runtime and requires all three browser actions before an explicit loop `COMPLETE`.

## Adversarial review findings

### Invalid action selection lost diagnostic trajectory

The first loop implementation failed closed when policy selected an out-of-range action index, but the rejected decision was absent from the returned trajectory.

A regression test was added first. The executor now preserves the observation and rejected `ACTION` decision before returning `FAIL`.

### Recoverable failure reason was not durable

The first RunEngine integration stored action success/failure but dropped the failure message from durable progress.

A regression test was added first. The action message is now persisted through existing secret redaction, so operators can diagnose the recovery without exposing secrets.

### New integration test leaked into the legacy Stagehand lane

The first PR CI attempt used the legacy broad Stagehand integration glob, which also selected the new Gate 9 research test. That config did not resolve the new `@astra/agent-loop` workspace package.

CI run `35454672393` failed with `ERR_MODULE_NOT_FOUND` before the Gate 9 acceptance ran.

The Stagehand regression config now explicitly selects the original ten-session test, while `test:run-loop` exclusively owns the new Gate 9 acceptance.

### Clean-checkout integration configs lacked a runtime source alias

On the next PR attempt, the original Stagehand 10-session regression and the new Gate 9 three-action acceptance both passed, but the later HTTP API browser test failed to resolve the new runtime use of `@astra/artifact-store` from `RunEngine`.

CI run `35454827082` exposed the clean-checkout resolution gap.

The API browser, API restart, SSE, and PostgreSQL Vitest configs now resolve the existing artifact-store source explicitly. Test discovery was verified for every affected lane before the next push.

These deterministic failures were fixed rather than retried away.

## Product-level trace

The accepted deterministic research run records:

1. navigation to the approved local research fixture;
2. observation of the company-profile action;
3. an `ACTION` decision with rationale;
4. successful company-profile action and screenshot;
5. observation of the operations-evidence action;
6. an `ACTION` decision with rationale;
7. successful operations-evidence action and screenshot;
8. observation of the finish-research action;
9. an `ACTION` decision with rationale;
10. successful finish-research action and screenshot;
11. a new observation with no remaining action;
12. explicit `COMPLETE`;
13. final structured extraction and validation;
14. cleanup evidence;
15. `RUN_COMPLETED`.

This keeps action execution, goal completion, and validated output as separate facts.

## Verification

Product-code head before memory promotion:

`0c9c4ee7da890405e0a1d0a6a864398e68011cd8`

### Local deterministic evidence

Focused loop and RunEngine tests:

- 11/11 passed.

`pnpm check` passed:

- project-memory validation;
- lint;
- strict typecheck;
- unit tests: 47/47;
- build.

SalesBench Baseline 0 remained unchanged at 32/40.

The local deterministic research HTTP fixture was also checked across all three action pages and the terminal result.

Local environment limitation:

- local Node was `24.13.1` while the repository requires `>=24.21.0 <25`;
- Docker was not installed locally.

Therefore no local Steel/PostgreSQL integration claim is made.

### Authoritative GitHub Actions evidence

Final CI on code head `0c9c4ee7da890405e0a1d0a6a864398e68011cd8`:

- CI `35455009337` — PASSED
  - frozen install;
  - project-memory consistency;
  - lint;
  - typecheck;
  - unit tests;
  - build.

- Steel integration `35455009347` — PASSED
  - pinned Steel startup;
  - ten-session raw Steel acceptance;
  - screenshot artifact upload;
  - cleanup.

- Stagehand Steel integration `35455009352` — PASSED
  - deterministic simple fixture;
  - deterministic three-action research fixture;
  - pinned Steel;
  - pinned PostgreSQL;
  - ten-session Stagehand → Steel acceptance;
  - owned Gate 9 multi-step research acceptance;
  - HTTP API browser regression;
  - PostgreSQL repository + durable loop progress regression;
  - replayable SSE regression;
  - durable API restart regression;
  - cleanup.

## Acceptance mapping

| Gate 9 requirement | Evidence |
| --- | --- |
| Owned loop/executor boundary | `@astra/agent-loop`, injected into `RunEngine` |
| `ACTION | COMPLETE | FAIL | BLOCKED` | runtime-validated decision union + focused tests |
| repeated observe → decide → act | three-action Stagehand→Steel acceptance |
| ordered durable progress | RunRepository records + PostgreSQL fresh-instance test |
| recoverable action failure | returned/thrown failure unit tests + RunEngine recovery test |
| at least three browser actions | deterministic research fixture and CI `35455009352` |
| per-step diagnostics | rationales, redacted messages, ordered progress, screenshots |
| action success ≠ goal completion | loop regression + failed final verifier regression |
| clean lifecycle | cleanup assertions + Steel/Stagehand workflow cleanup |
| provider-neutral core | no Stagehand/Steel types in owned loop state |
| prior regressions | CI/Steel/Stagehand/PostgreSQL/SSE/restart all green |

## Limitations

Gate 9 proves one deterministic multi-page research flow, not research breadth.

It does not yet provide:

- full goal-state/completion-verifier semantics for every run shape;
- irreversible-action effect semantics;
- cancellation propagation;
- step/time/model-cost budgets;
- general loop-detection policy beyond the internal iteration ceiling;
- deterministic prospect-research qualification breadth;
- live prospect research or external sales actions.

Those remain later gates.

## Next gate

Gate 10 — Completion, effects, cancellation + budgets.
