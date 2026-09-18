# Fresh-Context / Astra Handoff Protocol

The handoff system is intentionally optimized for a fresh agent with no chat history.

## Fast path

A new Astra should be able to answer these questions after reading only `AGENTS.md` + `STATE.md`:

- Why does the project exist?
- What are we building now?
- What already works?
- What is not built?
- What is the next action?
- What must be tested before moving on?

If not, improve `STATE.md`.

## Before starting work

1. Read `AGENTS.md`.
2. Read `STATE.md`.
3. Read only the active gate in `PLAN.md`.
4. Inspect the code/tests relevant to that gate.
5. Read related decisions only if an architectural question arises.
6. Search lessons only if the task resembles a previous failure.

## During work

Keep scratch reasoning out of project memory.

Do not update `STATE.md` after every small edit.

Record durable information only:

- verified implementation status;
- test evidence;
- blockers;
- next action;
- lasting architecture decisions;
- reusable mistakes.

## Before finishing a PR

Update memory in this order:

### 1. Tests

Run the gate's required tests.

### 2. PLAN.md

If the gate changes status, update it.

### 3. STATE.md

Replace stale status with:

- current gate;
- what was built;
- exact test evidence;
- known failures/risks;
- next action.

### 4. DECISIONS.md

Append only if a durable architecture/product decision was made.

### 5. LESSONS.md

Append only if a failure taught something worth preserving.

### 6. History note

Create `docs/project/history/YYYY-MM-DD-<milestone>.md` only for a substantial milestone or incident that would make the main ledgers too large.

## End-of-session handoff template

Use this in the PR description or milestone note when useful:

```md
## Outcome
What changed.

## Tests
Exact commands / CI jobs and results.

## Important discoveries
Only durable facts.

## Mistakes / dead ends
What failed and why.

## Current blocker
None / specific blocker.

## Next action
One concrete task.

## Files to read next
Only the minimum useful set.
```

## Compression rule

Prefer:

> Gate 2 passed: Stagehand connected to Steel over CDP; 10/10 fixture runs. Evidence: CI run X / test Y.

over:

> A 2,000-word chronological description of every attempt.

## Handling disagreement with memory

If code/tests contradict memory:

1. trust reproducible evidence;
2. fix the docs in the same PR;
3. if the difference changes architecture, append a decision explaining why.

## User priority override

The user's explicit current instruction can change the next action.

When that happens, update `STATE.md` so the following fresh agent does not continue the old priority.
