# Current Project State

**Last updated:** 2026-09-19  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Multi-step sales-agent orchestration → completion/effect/cancellation/budget semantics
**Current gate:** Gate 10 — Completion, effects, cancellation + budgets
**Overall status:** Gates 0–9 are PASSED. Gate 9 adds Astra-owned multi-step observe → decide → act orchestration with explicit `ACTION | COMPLETE | FAIL | BLOCKED` decisions, durable ordered progress, recoverable action failure, and a deterministic three-action Stagehand → Steel research acceptance. Gate 10 is next.

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

### Gate 9 owned multi-step loop

`@astra/agent-loop` now owns the provider-neutral orchestration boundary for repeated observe → decide → act cycles.

The loop:

- runtime-validates explicit `ACTION | COMPLETE | FAIL | BLOCKED` decisions;
- preserves compact ordered trajectory records;
- treats successful browser actions as action evidence rather than goal completion;
- returns failed/thrown action attempts to the decision policy for safe recovery;
- enforces an internal iteration ceiling against endless repetition;
- keeps Stagehand and Steel outside owned loop state.

`RunEngine` can execute the owned loop while retaining browser/session lifecycle ownership. It persists redacted loop observations, decisions, action outcomes, progress events, per-action screenshots, terminal loop results, and cleanup evidence through the existing repository/artifact boundary.

The deterministic Gate 9 research fixture requires three browser actions. The acceptance performs a fourth observation before explicit `COMPLETE`, then extracts and validates the final structured result. A separate regression proves that even an explicit loop `COMPLETE` does not make the run `COMPLETED` when final goal/result verification fails.

No live prospect research or external action was introduced.

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

- explicit completion/effect semantics, cancellation propagation, and execution budgets for broader autonomy;
- deterministic multi-page prospect-research qualification;
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
| 9 — Owned multi-step sales-agent loop | PASSED | PR #54 / CI 35455009337, Stagehand 35455009352, Steel 35455009347 |

Gate 8 regression evidence:

- CI `35452463916` — quality/tests/build green;
- Steel `35452463895` — pinned Steel 10/10 green;
- Stagehand `35452463890` — Stagehand 10/10 + API/Postgres/SSE/restart green.

Gate 9 regression evidence:

- CI `35455009337` — memory/quality/tests/build green;
- Stagehand `35455009352` — Stagehand 10/10, owned three-action research loop, API browser, PostgreSQL, SSE, and restart regressions green;
- Steel `35455009347` — pinned Steel 10/10 green.

Detailed evidence:

- `docs/project/history/2026-09-18-gates-0-7-browser-foundation.md`
- `docs/project/history/2026-09-19-astra-sales-product-pivot.md`
- `docs/project/history/2026-09-19-gate8-sales-domain-salesbench.md`
- `docs/project/history/2026-09-19-gate9-owned-multistep-agent-loop.md`

Tests/current code remain stronger evidence than this summary.

## Project memory

The memory system uses:

- `AGENTS.md` as the bootloader;
- this file as the single hot-memory hub;
- GitHub issue #53 as the completed Gate 9 working-memory/evidence thread;
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

1. **Capability risk:** Gate 9 proves one owned deterministic multi-step loop and research fixture, not broad autonomous research capability. Gates 10–11 must still establish completion/effect/cancellation/budget semantics and a materially broader deterministic research qualification before live prospecting expands.
2. **Sales-policy risk:** Baseline 0 is only 32/40. Known weaknesses include evidence requests without evidence, weak-fit handoff, and re-asking known qualification facts.
3. **External-model evidence risk:** no paid hosted-model benchmark is claimed yet.
4. **Scope risk:** the browser foundation and draft voice branch are large assets; reuse must remain contract-by-contract.
5. **Evaluation risk:** persuasive output can still be wrong or spammy; SalesBench components must remain separate.
6. **Reputation risk:** outreach/publication are external reputation-changing actions and remain gated.
7. **Platform/compliance risk:** email/social/telephony automation needs provider-policy, consent, rate-limit, and anti-spam controls before autonomy.
8. **Voice risk:** PR #2 contains substantial transport code, but no canonical realtime route has been selected for this product.

## Next action

**Gate 10 — Completion, effects, cancellation + budgets:** make verified goal completion explicit and bound execution with effect semantics, step/time/model budgets, cancellation propagation, loop detection, and typed terminal reasons.

Do not start live prospect research, outreach, voice, E2B, or external actions before the later gates that authorize them.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
