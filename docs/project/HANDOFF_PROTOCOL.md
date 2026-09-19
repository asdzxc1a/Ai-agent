# Fresh-Context / Astra Handoff Protocol

The handoff system is intentionally optimized for a fresh agent with no chat history.

The reusable specification is `docs/project/PROJECT_MEMORY_SYSTEM.md`. This file is the Astra-specific operating summary.

## Fast path

A new Astra should be able to answer these questions after reading only `AGENTS.md` + `STATE.md`:

- Why does the project exist?
- What are we building now?
- What already works?
- What is not built?
- What is the next action?
- What must be tested before moving on?

If not, improve `STATE.md` rather than adding another competing status document.

## Before starting work

1. Read `AGENTS.md`.
2. Read `STATE.md`.
3. Read only the active gate in `PLAN.md`.
4. Read `TEST_STRATEGY.md`.
5. Read the active GitHub issue for the gate/subtask, if one exists.
6. Inspect the code/tests relevant to that gate.
7. Read related decisions only if architecture/product intent matters.
8. Search lessons only if the task resembles a previous failure or reusable pattern.
9. Read cold history only when current evidence points there.

## During work

Keep scratch reasoning out of project memory.

Do not update `STATE.md` after every small edit.

Use the active GitHub issue for short-lived implementation discoveries and blockers.

Record durable information only:

- verified implementation status;
- test evidence;
- blockers that matter to the next contributor;
- next action;
- lasting architecture/product decisions;
- reusable lessons.

## Before finishing a PR

Update memory in this order:

### 1. Tests

Run the gate's required tests.

### 2. Memory consistency

Run:

~~~bash
pnpm check:memory
~~~

### 3. PLAN.md

If the gate changes status, update it.

### 4. STATE.md

Replace stale status with:

- current gate;
- what now works;
- concise recent evidence;
- known failures/risks;
- one concrete next action.

Do not turn STATE into a historical CI ledger.

### 5. DECISIONS.md

Append only if a durable architecture/product decision was made.

Identifiers must remain unique and stable.

### 6. LESSONS.md

Append only if a reusable lesson was discovered.

Identifiers must remain unique and stable.

### 7. History note

Create `docs/project/history/YYYY-MM-DD-<milestone>.md` when completed evidence or incident detail would make STATE materially larger.

## End-of-session handoff template

Use this in the PR description or active issue when useful:

~~~md
## Outcome
What changed.

## Tests
Exact commands / CI jobs and results.

## Important discoveries
Only durable facts.

## Mistakes / dead ends
Only reusable information.

## Current blocker
None / specific blocker.

## Next action
One concrete task.

## Files to read next
Only the minimum useful set.
~~~

## Compression rule

Prefer:

> Gate 2 passed: Stagehand connected to Steel over CDP; 10/10 fixture runs. Evidence: CI run X / test Y.

over a chronological description of every attempt.

Completed detail that remains useful belongs under `history/`, not in hot memory.

## Handling disagreement with memory

If code/tests contradict memory:

1. trust reproducible evidence;
2. fix the stale memory in the same PR when practical;
3. if the difference changes architecture/product intent, append a decision explaining why.

## User priority override

The user's explicit current instruction can change the next action.

When that happens, update `STATE.md` and the active GitHub issue so the following fresh agent does not continue the old priority.
