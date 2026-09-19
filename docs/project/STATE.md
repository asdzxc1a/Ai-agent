# Current Project State

**Last updated:** 2026-09-19  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Deterministic research qualification → sandbox/network isolation
**Current gate:** Gate 12 — Sandbox + network safety for external research
**Overall status:** Gates 0–11 are PASSED. Gate 11 completed in PR #62: frozen ResearchBench v1 qualifies the owned Stagehand→Steel research loop at 30/30 first-attempt tasks, with 20/20 core, 10/10 hard, zero false completions, zero unsupported claims, evidence/source attribution checks, and released Steel sessions. Gate 12 is active in issue #63.

## North star

Astra should eventually execute this loop:

~~~text
approved target / ICP
      ↓
evidence-backed browser research
      ↓
prospect + buyer + opportunity context
      ↓
consultative next-best-action policy
      ↓
text / voice / optional avatar conversation
      ↓
typed proposal + explicit authorization
      ↓
real business action
      ↓
durable outcome + evaluation
      ↓
experience memory + sanitized public proof
~~~

Astra sells our AI-native company/workforce transformation service **and demonstrates the service by doing the sales job itself**.

## What works now

### Browser / run substrate

The repository has:

- strict TypeScript workspace + deterministic CI;
- owned `BrowserRuntime` / `BrowserSession` contracts;
- Steel browser adapter with session lifecycle, screenshots, and diagnostics;
- owned `AgentRuntime` / `AgentSession` contracts;
- Stagehand adapter over Steel CDP;
- asynchronous HTTP run API;
- provider-neutral `RunEngine` / `RunRepository`;
- in-memory and durable PostgreSQL run repositories;
- persisted runs, steps, and ordered events;
- replayable SSE;
- artifact stores, screenshots, diagnostics, and secret redaction;
- pinned Steel/PostgreSQL runtime images.

These remain Astra's research, evidence, and later browser-action substrate.

### Gate 9 owned multi-step loop

`@astra/agent-loop` now owns repeated observe → decide → act orchestration over the provider-neutral `AgentSession` contract. Decisions are explicit `ACTION | COMPLETE | FAIL | BLOCKED`, and action failure recovery is explicit through `onFailure: CONTINUE | FAIL`.

`RunEngine` still owns durable run lifecycle, persistence, artifacts, cleanup, and terminal run state. Its loop path is optional, so the earlier one-step path remains unchanged when no loop executor is configured.

Durable loop progress uses sanitized action/decision summaries through `AGENT_LOOP_OBSERVE`, `AGENT_LOOP_DECISION`, `AGENT_LOOP_ACTION`, `AGENT_LOOP_RESULT`, and `RUN_PROGRESS`; action arguments and provider failure text are excluded from those progress payloads. Per-action screenshots are captured when artifacts are enabled.

Gate 9 acceptance proves three real Stagehand→Steel browser actions before explicit `COMPLETE`, plus deterministic recovery from one explicitly recoverable failed action.

### Gate 10 verified bounded execution

`RunEngine` now separates durable run status from goal state and persists typed terminal reasons. A run can reach `COMPLETED` only after an owned completion verifier accepts the result; browser/action success and schema validity alone are insufficient.

The owned loop now enforces action/step limits, wall-clock cancellation, model token/cost budgets, repeated-action loop detection, and explicit `none | committed | unknown` action-effect semantics. Irreversible actions with uncertain or already-committed failure effects are blocked rather than blindly retried.

Abort signals propagate through browser/agent contracts into Stagehand/Steel operations. `POST /v1/runs/:id/cancel` produces durable cancellation state and cleanup, and the pinned Steel acceptance proves the underlying session reaches `released`.

### Gate 11 deterministic research qualification

`@astra/research-bench` freezes 30 deterministic prospect-research tasks: 20 core and 10 hard, with two scenarios in each required Gate 11 category. Candidate input excludes fixture pages and expected answers; evaluator ground truth remains separate from the browser candidate.

The evaluator rejects fabricated evidence, unsupported findings, wrong source attribution, unknown→fact promotion, and false completion. The owned Stagehand→Steel candidate stores only evidence actually observed through the browser path, resolves dated conflicts by recency, and preserves missing/ambiguous fields as explicit unknowns.

Final qualification on the frozen suite is 30/30: core 20/20, hard 10/10, zero false completions, zero unsupported claims, and every run's Steel session reaches `released`. Earlier 28/30 and 27/30 measurements are preserved in Gate 11 history as harness-failure evidence rather than hidden or used to rewrite the suite.

### Gate 8 sales-domain foundation

`@astra/sales-domain` now provides runtime-validated contracts for:

- `ServiceOffer`;
- `Evidence`;
- `Prospect`;
- `Buyer`;
- `Opportunity`;
- `QualificationState`;
- `SalesDecision`;
- `NextAction`;
- `Outcome`;
- `PublicProof`.

The truth model distinguishes:

- `observed_fact`;
- `inferred_hypothesis`;
- `approved_claim`;
- `unknown`.

Evidence validators prevent claim-ID text substitution and require observed claims to match referenced observed evidence.

The first conservative service-offer boundary approves workflow assessment, AI-agent/workflow design, implementation support, and evaluation/reliability work while leaving pricing, quantified ROI, named customer proof, guaranteed outcomes, and standard timelines unknown until later operator-approved evidence exists.

### Gate 8 SalesBench

`@astra/sales-bench` now provides:

- 40 frozen deterministic sales scenarios;
- structured hard-failure evaluation;
- separate factuality/evidence/relevance/question/information-gain/qualification/trust/pressure/next-step scores;
- deterministic candidates;
- provider-neutral pinned-model candidates;
- frozen Baseline 0.

Baseline 0:

| Metric | Result |
| --- | ---: |
| Scenarios | 40 |
| Passed | 32 |
| Failed | 8 |
| Pass rate | 0.80 |
| Mean structural score | 0.9472 |
| Factuality | 1.00 |
| Evidence use | 1.00 |
| Relevance | 0.875 |
| Question quality | 0.925 |
| Information gain | 0.925 |
| Qualification quality | 0.925 |
| Trust | 1.00 |
| Pressure safety | 1.00 |
| Next-step quality | 0.875 |

The eight failed scenarios are intentionally preserved. They expose proof requests without evidence, weak-fit handoff, and repeated questions for already-known qualification facts.

No paid external-model benchmark is claimed. The pinned-model lane exists and is contract-tested, but no production credential/spend authorization was used.

## Reusable sales/voice asset outside `main`

Draft PR #2 / branch `codex/sales-avatar-foundation` remains a reusable experimental asset containing:

- sales session state/strategy;
- Qwen/GPT-Live realtime integration;
- optional HeyGen rendering;
- commercial-truth canonicalization;
- action proposal/confirmation/execution concepts;
- SalesOS trajectory/reward/experience concepts;
- adversarial action-security coverage.

D-023 requires selective reuse behind current owned contracts rather than a wholesale merge.

## What is not built yet

Astra does not yet have:

- sandbox/network isolation for untrusted live research;
- live prospect research;
- durable ICP/prospect queue;
- outreach drafting/approval workflow;
- persistent consultative conversation;
- selected/live-accepted realtime voice;
- durable real action execution;
- CRM/handoff/scheduling/email/social connectors;
- safe publication capability;
- automated experience retrieval;
- controlled real-market pilot.

## Completed milestones

| Gate | Status | Durable evidence |
| --- | --- | --- |
| 0 — Repository + CI | PASSED | PR #19 / archived evidence |
| 1 — Steel alone, local | PASSED | pinned Steel, 10/10 lifecycle regression |
| 2 — Stagehand → Steel | PASSED | PR #25 |
| 3 — Owned browser/agent interfaces | PASSED | PR #27 |
| 4 — First product API | PASSED | PR #29 |
| 5 — Durable run state | PASSED | PR #31 |
| 6 — Replayable SSE | PASSED | PR #33 |
| 7 — Artifacts + debugging | PASSED | PR #35 |
| 8 — Sales domain + SalesBench baseline | PASSED | PR #51 / CI 35452463916 |
| 9 — Owned multi-step sales-agent loop | PASSED | PR #55 / CI 35454706979 |
| 10 — Completion, effects, cancellation + budgets | PASSED | PR #60 / CI 35458628400 |
| 11 — Deterministic prospect-research qualification | PASSED | PR #62 / Stagehand 35461483407 |

Gate 8 regression evidence:

- CI `35452463916` — quality/tests/build green;
- Steel `35452463895` — pinned Steel 10/10 green;
- Stagehand `35452463890` — Stagehand 10/10 + API/Postgres/SSE/restart green.

Detailed evidence:

- `docs/project/history/2026-09-18-gates-0-7-browser-foundation.md`
- `docs/project/history/2026-09-19-astra-sales-product-pivot.md`
- `docs/project/history/2026-09-19-gate8-sales-domain-salesbench.md`
- `docs/project/history/2026-09-19-gate9-owned-multistep-loop.md`
- `docs/project/history/2026-09-19-gate10-completion-effects-cancellation-budgets.md`
- `docs/project/history/2026-09-19-gate11-deterministic-research-qualification.md`

Tests/current code remain stronger evidence than this summary.

## Project memory

The memory system uses:

- `AGENTS.md` as the bootloader;
- this file as the single hot-memory hub;
- active GitHub issue #63 as short-lived working memory for Gate 12;
- `PLAN.md` for future gates;
- `DECISIONS.md` for durable rationale;
- `LESSONS.md` for reusable learning;
- `history/` for cold evidence;
- tests/CI as the strongest source of truth.

Structural invariants:

~~~bash
pnpm check:memory
~~~

## Known risks

1. **Isolation risk:** Gate 11 proves deterministic local research reliability, but untrusted external websites are not yet isolated from sensitive networks/runtime state. Gate 12 must establish the sandbox/network boundary before live-web research expands.
2. **Sales-policy risk:** Baseline 0 is only 32/40. Known weaknesses include evidence requests without evidence, weak-fit handoff, and re-asking known qualification facts.
3. **External-model evidence risk:** no paid hosted-model benchmark is claimed yet.
4. **Scope risk:** the browser foundation and draft voice branch are large assets; reuse must remain contract-by-contract.
5. **Evaluation risk:** persuasive output can still be wrong or spammy; SalesBench components must remain separate.
6. **Reputation risk:** outreach/publication are external reputation-changing actions and remain gated.
7. **Platform/compliance risk:** email/social/telephony automation needs provider-policy, consent, rate-limit, and anti-spam controls before autonomy.
8. **Voice risk:** PR #2 contains substantial transport code, but no canonical realtime route has been selected for this product.

## Next action

**Gate 12 — Sandbox + network safety for external research (issue #63):** define a provider-neutral sandbox/network-policy boundary, prove local isolation and private-network blocking first, then place E2B or another provider behind that owned contract only if it passes the same tests.

Do not start live prospect research at scale, outreach/email/LinkedIn/X, voice/avatar, CRM/calendar/social actions, or new irreversible external side effects in Gate 12.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
