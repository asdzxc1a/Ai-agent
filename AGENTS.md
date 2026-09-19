# AGENTS.md — Astra

## Mission

Build the smallest reliable TinyFish-like browser-agent platform, one evidence-backed gate at a time.

- **Steel**: browser/session/CDP runtime.
- **Stagehand**: initial semantic browser layer.
- **E2B**: later isolation layer, only after local agent behavior is measured and reliable.
- We own product contracts/orchestration; upstream systems remain replaceable adapters.

Full memory protocol: `docs/project/PROJECT_MEMORY_SYSTEM.md`. Read it only when maintaining or porting project memory.

## Authority

When guidance conflicts:

1. user's explicit current instruction;
2. passing tests and current code;
3. `docs/project/STATE.md`;
4. accepted `docs/project/DECISIONS.md`;
5. current gate in `docs/project/PLAN.md`;
6. active GitHub issue;
7. history / old conversations.

Resolve conflicts using the strongest source; do not blend incompatible instructions. Update stale memory when appropriate.

## Boot with minimum context

After this file, read:

1. `STATE.md`;
2. **current gate only** in `PLAN.md`;
3. `TEST_STRATEGY.md`;
4. active gate/subtask issue, if any;
5. relevant code/tests.

Only as needed: relevant `DECISIONS.md`, related `LESSONS.md`, `CHARTER.md`, then `history/`.

Do not preload all docs or history.

## Work

- Infer the intended outcome and carry actionable requests to completion.
- Small/reversible task: act directly. Multi-step/risky task: give a short plan, then continue.
- Ask only when a missing choice is genuinely blocking, unsafe to assume, or irreversible.
- Work on one gate or bounded subtask at a time; the user may reprioritize.
- Keep diffs focused; avoid unrelated cleanup.
- Repository reads/searches, focused branches/PRs, and local non-production validation are authorized.
- Do not perform production, credential, billing, destructive, or externally irreversible actions without explicit authorization.
- Do not store scratch reasoning as project memory.

## Architecture guardrails

- TypeScript-first initially.
- Provider-specific types stay in adapters; application code uses owned contracts.
- Do not fork upstreams without a measured blocker and accepted decision.
- Do not jump ahead of the evidence-backed roadmap; especially do not add E2B/later layers early.
- Authorization/capabilities live outside model prompts.
- Irreversible/ambiguous browser actions must ultimately support `none | committed | unknown` effect semantics.
- Prefer the smallest architecture that passes current acceptance.

## Verify

- Run the smallest meaningful checks that prove the change, plus gate-required acceptance tests.
- Use `pnpm check` when full-repo validation is warranted.
- Run `pnpm check:memory` when project-memory files/invariants change.
- Fix failures caused by the change; do not hide deterministic failures with retries.
- Do not repeat expensive green checks without new reason.
- Do not claim completion while required evidence is red.

Tests/current code outrank prose.

## Write memory once

- current truth / blocker / next action → `STATE.md`
- future gate scope / acceptance → `PLAN.md`
- current implementation work → active issue
- durable rationale → `DECISIONS.md`
- reusable learning → `LESSONS.md`
- detailed completed evidence → `history/`
- transient reasoning → discard

Chat is context, not project state.

## Done

A meaningful task is done when the requested change is complete, relevant evidence is green, durable memory reflects changed truth, and the PR/handoff records the next concrete action.

Update decisions/lessons only when genuinely durable; archive verbose evidence instead of bloating `STATE.md`.

If unsure what to do next, read `docs/project/STATE.md`.
