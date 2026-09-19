# AGENTS.md — Astra Operating Contract

## Mission

Build the smallest reliable TinyFish-like browser-agent platform, one evidence-backed gate at a time.

Core direction:

- **Steel** provides browser/session/CDP runtime.
- **Stagehand** provides the initial semantic browser layer.
- **E2B** is a later isolation layer, added only after local agent behavior is measured and reliable.
- We own the product contracts and orchestration; upstream systems remain replaceable adapters.

The complete project-memory protocol is in `docs/project/PROJECT_MEMORY_SYSTEM.md`. Do not load it for ordinary work unless maintaining the memory system.

## Instruction priority

When guidance conflicts, use this order:

1. the user's explicit current instruction;
2. passing tests and current code;
3. `docs/project/STATE.md`;
4. accepted entries in `docs/project/DECISIONS.md`;
5. the current gate in `docs/project/PLAN.md`;
6. the active GitHub issue for the current gate/subtask;
7. cold history and old conversations.

Do not blend contradictory sources. Resolve the conflict using the strongest evidence and correct stale project memory when appropriate.

## Start with minimum context

After reading this file:

1. Read `docs/project/STATE.md`.
2. Read **only the current gate** in `docs/project/PLAN.md`.
3. Read `docs/project/TEST_STRATEGY.md`.
4. Read the active GitHub issue for the current gate/subtask, if one exists.
5. Inspect the code and tests relevant to the requested work.

Load other context only when needed:

- `DECISIONS.md` for relevant architecture/product intent;
- `LESSONS.md` when the task resembles a previous problem or reusable pattern;
- `CHARTER.md` when purpose/scope is unclear;
- `history/` only when current evidence points there.

Do not preload the whole repository history or every project document.

## Execution behavior

- Infer the user's intended outcome and bias toward completing it.
- For small, reversible tasks, act directly.
- For multi-step, risky, or ambiguous work, give a short plan, then continue.
- Do not stop after proposing a plan when the requested work can be completed now.
- Do not ask non-blocking clarification questions. Ask only when a missing decision is genuinely blocking, unsafe to assume, or would make an irreversible choice for the user.
- Work on one gate or one well-bounded subtask at a time. The user may explicitly reprioritize.
- Keep changes focused. Do not mix unrelated cleanup into the task.
- Use repository/tool evidence instead of guessing current state.
- Do not preserve scratch reasoning as project memory.

## Safe autonomy

You are authorized to perform ordinary repository work needed to complete the task, including:

- reading/searching repository files and Git history;
- creating focused branches and pull requests;
- running local lint, typecheck, unit tests, deterministic fixtures, and other non-production validation;
- fixing failures caused by your change and rerunning the affected checks.

Do not repeatedly run already-green expensive checks without a new reason.

Do not perform production, credential, billing, destructive, externally irreversible, or user-account actions unless the user explicitly authorized that action and the available tool permissions allow it.

## Architecture guardrails

- TypeScript-first for the initial product.
- Keep provider-specific types inside provider adapters.
- Application code depends on owned browser/agent/run/artifact contracts.
- Do not fork Stagehand, Steel, E2B, or other upstreams without a measured blocker and an accepted decision.
- Do not add E2B or later product layers ahead of the current evidence-backed roadmap.
- Authorization and capabilities live outside model prompts.
- Irreversible or ambiguous browser actions must ultimately support explicit effect semantics: `none | committed | unknown`.
- Prefer the smallest architecture that can pass the current acceptance criteria.

## Verification

Calibrate verification to the change.

- Run the smallest meaningful checks that prove the requested behavior.
- Run gate-required integration/acceptance tests when the change touches that gate.
- Use `pnpm check` when a full repository validation is warranted.
- `pnpm check:memory` must pass when project-memory files or their invariants change.
- Do not hide deterministic failures with retries.
- Do not claim completion while required acceptance evidence is red.
- Broaden or repeat testing only when failures, new changes, or unresolved risk justify it.

Tests and current code are stronger evidence than prose.

## Definition of done

A meaningful task is done when all applicable items are true:

1. the requested implementation/change is complete;
2. relevant automated checks pass;
3. gate-specific acceptance criteria pass when applicable;
4. the active issue records important implementation discoveries/evidence;
5. `STATE.md` reflects changed current truth;
6. `PLAN.md` changes only if gate status/scope changed;
7. `DECISIONS.md` gets a new entry only for a durable architecture/product decision;
8. `LESSONS.md` gets a new entry only for reusable learning;
9. verbose completed evidence is archived under `docs/project/history/` instead of bloating hot state;
10. the PR/handoff states the next concrete action.

## Memory routing

Route information once:

- **current truth / blocker / next action** → `STATE.md`
- **future gate scope / acceptance** → `PLAN.md`
- **current implementation work** → active GitHub issue
- **durable why** → `DECISIONS.md`
- **reusable learning** → `LESSONS.md`
- **detailed completed evidence** → `history/`
- **transient reasoning** → discard

GitHub/repository memory is canonical. Chat is context, not project state.

## Default handoff

End substantial work with a compact report:

- what changed;
- what was verified;
- what remains uncertain or blocked;
- current gate/status;
- one next action;
- PR/CI/evidence references.

If unsure what to do next, read `docs/project/STATE.md`.
