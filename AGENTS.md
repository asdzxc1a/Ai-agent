# AGENTS.md — Astra

## Mission

Build Astra into our company's autonomous consultative sales agent and public proof of the service it sells.

Astra should find and research suitable prospects, understand the company and buyer from evidence, sell our AI-native company/workforce transformation service consultatively, qualify real opportunities, propose safe next actions, execute only authorized actions, preserve outcome evidence, and produce sanitized proof that can become public demonstrations.

- **Browser foundation**: Steel + Stagehand are Astra's research and browser-action substrate, not the product identity.
- **Voice foundation**: the Qwen/GPT-Live/HeyGen work in draft PR #2 is a reusable conversation asset, not something to merge wholesale before measured acceptance.
- **Owned moat**: sales ontology, customer/opportunity state, strategy, commercial truth, action contracts, evaluation, and experience memory.
- One visible seller. Internal specialists/validators remain hidden implementation details.
- External outreach, publishing, credentials, billing, destructive work, or other irreversible production actions require explicit authorization until a later gate deliberately grants bounded autonomy.

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
- Repository reads/searches, focused branches/PRs, local fixtures, and non-production validation are authorized.
- Research and drafting are not authorization to send outreach or publish content.
- Do not perform production, credential, billing, destructive, externally irreversible, or reputation-affecting actions without explicit authorization.
- Do not store scratch reasoning as project memory.

## Architecture guardrails

- TypeScript-first initially.
- Provider-specific types stay in adapters; application code uses owned contracts.
- Server-owned structured truth outranks model prose for identity, company facts, service claims, qualification, consent, action state, and execution receipts.
- Models advise; owned policy and tools act.
- Browser, voice, avatar, CRM, email, calendar, and social providers remain replaceable adapters.
- Preserve the proven browser foundation; do not replace it merely because the product mission changed.
- Reuse draft sales/voice work selectively behind owned contracts; do not merge PR #2 wholesale without gate evidence.
- Do not introduce a runtime swarm of agents unless one role has a measured need. Prefer deterministic reducers/validators plus one strong sales reasoner.
- Irreversible or ambiguous actions must ultimately support `none | committed | unknown` effect semantics and durable idempotency.
- Public demo claims must be derived from verified run evidence and sanitized before publication.
- Prefer the smallest architecture that passes the current sales acceptance gate.

## Verify

- Run the smallest meaningful checks that prove the change, plus gate-required acceptance tests.
- Use `pnpm check` when full-repo validation is warranted.
- Run `pnpm check:memory` when project-memory files/invariants change.
- From Gate 8 onward, distinguish deterministic contract evidence from model-backed SalesBench evidence.
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
