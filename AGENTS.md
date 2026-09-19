# Astra / Fresh-Agent Operating Contract

This file is the entry point for Astra and any future coding agent.

The complete, portable memory-system specification lives in `docs/project/PROJECT_MEMORY_SYSTEM.md`. Read that specification when maintaining or porting the memory system; ordinary implementation work should follow the shorter startup path below.

## Mission

Build a TinyFish-like web-agent platform incrementally, with the smallest reliable architecture first.

The initial foundation is:

1. **Steel Browser** — browser/session/CDP runtime.
2. **Stagehand** — semantic observe/act/extract layer.
3. **E2B Runtime** — isolated Firecracker sandbox layer, added only after the local Stagehand→Steel path is proven.

Do **not** merge or fork all three projects. Integrate them through small adapters and keep upstream dependencies replaceable.

## Fresh-context startup: read in this order

After reading this file:

1. `docs/project/STATE.md` — current truth, current gate, next action.
2. The current gate only in `docs/project/PLAN.md`.
3. `docs/project/TEST_STRATEGY.md` — required evidence for "done".
4. The active GitHub issue for the current gate/subtask, if one exists.
5. The code/tests relevant to that gate.
6. Relevant entries in `docs/project/DECISIONS.md` only when architecture/product intent matters.
7. Search `docs/project/LESSONS.md` only when the task resembles a previous problem or reusable pattern.
8. `docs/project/CHARTER.md` when purpose/scope is unclear.
9. `docs/project/history/` only when current evidence explicitly points there.

Do not begin by reading all history.

## Source-of-truth priority

When documents disagree, trust sources in this order:

1. Passing automated tests and current code.
2. `STATE.md`.
3. Accepted decisions in `DECISIONS.md`.
4. `PLAN.md`.
5. Historical notes.
6. Old chat transcripts.

The active GitHub issue is working memory for current scope. It must not silently override stronger sources; update the canonical memory if the task legitimately changes them.

Chat is context, not project state.

## Working rule

Work on **one gate or one well-bounded subtask at a time**. Do not start a later gate until the current gate's acceptance tests pass unless the user explicitly changes priorities.

Every meaningful change must end with:

1. implementation;
2. automated tests;
3. test result recorded;
4. `pnpm check:memory`;
5. `STATE.md` updated;
6. `PLAN.md` gate status updated if the gate changed;
7. `DECISIONS.md` updated only for durable architectural/product decisions;
8. `LESSONS.md` updated only for reusable lessons;
9. detailed completed evidence archived under `docs/project/history/` when it would bloat hot memory.

## Memory discipline

Keep current context small.

- `STATE.md` is the single mutable hot-memory hub. It should answer: "Where are we? What works? What is broken or uncertain? What next?"
- `PLAN.md` is the roadmap, not a diary.
- The active GitHub issue is current working memory, not permanent project truth.
- `DECISIONS.md` is durable architecture/product rationale.
- `LESSONS.md` is reusable engineering learning.
- `history/` is cold memory and should not be loaded by default.
- Tests/CI are the strongest evidence.
- Do not duplicate the same fact in several files.
- Do not paste long logs or scratch reasoning into memory.
- Most transient information should be discarded rather than preserved.

## Engineering constraints

- TypeScript-first for the initial product.
- Use adapters around upstream systems.
- Do not fork Stagehand, Steel, or E2B unless measurements prove a fork is necessary.
- Do not add E2B before local Stagehand→Steel passes reliably.
- Do not add Search, Fetch, Research, Monitor, Vault integrations, billing, custom Chromium, or a custom action model before the core browser-agent vertical slice is reliable.
- Authorization/capabilities must live outside model prompts.
- Every browser run has step/time/cost limits.
- Every irreversible or ambiguous browser action must eventually support explicit effect semantics: `none | committed | unknown`.
- Never call a gate complete without automated evidence.

## Preferred branch/PR behavior

- Work on a focused branch.
- Small PRs.
- One gate or one well-bounded subtask per PR.
- PR description must list tests run and memory files updated.
- Prefer squash merge after CI is green.

## If you are unsure what to do next

Read `STATE.md`. The `Next action` field is authoritative unless the user explicitly changes priorities.
