# Astra / Fresh-Agent Operating Contract

This file is the entry point for Astra and any future coding agent.

## Mission

Build a TinyFish-like web-agent platform incrementally, with the smallest reliable architecture first.

The initial foundation is:

1. **Steel Browser** — browser/session/CDP runtime.
2. **Stagehand** — semantic observe/act/extract layer.
3. **E2B Runtime** — isolated Firecracker sandbox layer, added only after the local Stagehand→Steel path is proven.

Do **not** merge or fork all three projects. Integrate them through small adapters and keep upstream dependencies replaceable.

## Fresh-context startup: read in this order

1. `docs/project/STATE.md` — current truth, current gate, next action.
2. The current gate only in `docs/project/PLAN.md`.
3. `docs/project/TEST_STRATEGY.md` — required evidence for "done".
4. Read `docs/project/DECISIONS.md` only when touching an architectural decision.
5. Read `docs/project/LESSONS.md` only when a problem resembles an earlier mistake.
6. Read `docs/project/CHARTER.md` when purpose/scope is unclear.

Do not begin by reading all history.

## Source-of-truth priority

When documents disagree, trust sources in this order:

1. Passing automated tests and current code.
2. `STATE.md`.
3. Accepted decisions in `DECISIONS.md`.
4. `PLAN.md`.
5. Historical notes.
6. Old chat transcripts.

Chat is context, not project state.

## Working rule

Work on **one gate at a time**. Do not start a later gate until the current gate's acceptance tests pass.

Every meaningful change must end with:

1. implementation;
2. automated tests;
3. test result recorded;
4. `STATE.md` updated;
5. `PLAN.md` gate status updated if the gate changed;
6. `DECISIONS.md` updated only for durable architectural decisions;
7. `LESSONS.md` updated only for reusable mistakes/insights.

## Memory discipline

Keep current context small.

- `STATE.md` is mutable and short. It should answer: "Where are we? What works? What is broken? What next?"
- `PLAN.md` is the roadmap, not a diary.
- `DECISIONS.md` is append-only architecture memory.
- `LESSONS.md` is append-only operational memory.
- Tests are the strongest evidence.
- Do not duplicate the same fact in five places.
- Do not paste long logs into memory files. Link to commits/PRs/artifacts instead.
- Archive milestone detail under `docs/project/history/` only when necessary.

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
