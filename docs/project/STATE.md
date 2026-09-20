# Current Project State

**Last updated:** 2026-09-20  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Sandbox/network isolation → controlled live prospect research
**Current gate:** Gate 13 — Evidence-backed live prospect research
**Overall status:** Gates 0–12 are PASSED. Gate 13 is active in issue #65. PRs #68–#78 now provide the approved-research foundation, September audit hardening, a serial read-only operator research composition, and a durable pre-registered measured-sample protocol. The measured run requires stored approval plus frozen-sample membership, preserves failed live attempts in the denominator, and cannot report a pass before every frozen target has exactly one reviewed outcome. Gate 13 remains IN_PROGRESS because no operator-approved real-company/domain cohort has been supplied or researched, no material live claim has been human-audited, and no preparation-time/cost result exists yet.

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

### Gate 12 sandbox + network safety

`@astra/sandbox-runtime` owns `SandboxRuntime` / `SandboxSession`, `SandboxedBrowserRuntime`, isolation identity, and browser egress policy. `RunEngine` persists the optional `isolationId` without learning any sandbox-provider API, while Stagehand consumes only the generic browser network policy.

Untrusted egress is fail-closed: allowed hosts must be explicit, navigation is limited to HTTP/HTTPS, credentials and non-approved ports are rejected, DNS is rechecked, and loopback/private/link-local/metadata/reserved targets fail closed. Stagehand's context-wide domain policy covers redirects, popups, and subresources; direct navigation additionally receives Astra-owned DNS/IP preflight.

Provider isolation is measured rather than inferred. The first pinned Steel provider run showed separate session IDs on one self-hosted endpoint shared cookie/localStorage. Astra therefore rejects concurrent browser sessions on one self-hosted Steel endpoint. Final acceptance proves simultaneous browser-state separation across independent pinned Steel endpoints, filesystem/process/loopback-port separation between provider containers, clean sequential endpoint reuse, independent release, and 30/30 ResearchBench through the sandbox composition.

### Gate 13 approved live-research foundation + audit hardening

`@astra/prospect-research` owns operator-approved target records, approval provenance, evidence/claim/unknown contracts, target-scoped network policy derivation, semantic completion validation, durable research attempts, and `RESEARCH_EVIDENCE` artifacts. `@astra/prospect-postgres` provides independent migrations and durable restart persistence for approved targets, attempts, and Prospects.

Authorization comes from stored server state rather than model/result prose. The model-facing research result excludes approval state, run/prospect identity, fit/disqualifiers, capture timestamps, artifact IDs, and capture receipts. Durable identities are derived from the stored target and run; Gate 13 Prospect fit remains `unknown` with no disqualifiers so Gate 14 qualification/scoring does not leak backward into research.

September audit hardening is now merged:

- PR #70 drains completed SSE replay through terminal events even when the persisted backlog exceeds one 100-event batch and aligns Gate 13 to measured internal value;
- PR #71 makes Astra's full scheme/credential/domain/port/DNS/IP policy own Stagehand's CDP request decision, including redirects/subresources, with a real Steel forbidden-port sentinel regression;
- PR #72 makes terminal event + terminal run snapshot one owned repository operation, transactional in PostgreSQL, supervises background execution rejection, blocks stale non-terminal resurrection, and reconciles orphaned `PENDING/RUNNING` records before the API serves requests;
- PR #73 binds material research screenshots to semantically settled page captures with final page URL, server capture time, page-content SHA-256, screenshot SHA-256, and artifact identity; raw page text is not persisted; uncertainty/provenance survive into sales evidence;
- PR #74 hard-fails prohibited buyer-visible commercial prose even when structured `claims` is empty while preserving the frozen SalesBench v1 Baseline 0 at exactly 32/40;
- PR #75 gives optional diagnostics and each cleanup operation independent bounded deadlines, preserving best-effort diagnostics and typed `CLEANUP_FAILED` semantics while still attempting browser/provider release;
- PR #77 composes the smallest complete Gate 13 operator workflow: stored approval only, target-scoped sandbox policy/verifier, serial read-only execution that never calls `act()`, settled final evidence capture, rejection of unobserved page citations, and operator-reviewed evidence mapping before persistence;
- PR #78 makes the measured experiment durable and pre-registered: frozen approved-target snapshots, non-weakenable quality/time thresholds, operator-supplied cost ceiling, per-target human-review outcomes, failed-attempt denominator preservation, deterministic sample evaluation, and PostgreSQL restart persistence.

Capture receipts prove which semantically settled page/screenshot bytes were recorded; they do **not** independently prove that a natural-language observation is semantically supported by the page. Gate 13 therefore still requires a human source-page/screenshot audit for every material observed fact in the measured sample.

No real-company/domain research has been executed under Gate 13 because no operator-approved fixed sample exists yet. The code path is now ready to freeze and run that sample once the operator supplies the targets, human-baseline description, and per-brief cost ceiling. Gate 13 stays serial/single-owner while multi-worker leases/fencing, durable cancellation intent, and centralized Steel endpoint ownership remain later scale work.

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

## Capability evidence ledger

| Capability | Highest verified state | Current meaning |
| --- | --- | --- |
| Browser/run substrate | `WIRED` | Generic run API + deterministic/pinned integration path works; not yet a complete sales operator app |
| ResearchBench v1 | `WIRED` | 30/30 deterministic fixture qualification; not a real-model arbitrary-web result |
| Gate 13 operator research workflow | `WIRED` | Stored approval → frozen sample → serial read-only research → settled evidence capture → operator review → durable attempt/outcome evaluation is composed on `main`; no real-company sample has been live-tested |
| Consultative seller | `IMPLEMENTED` | Sales-domain schemas/policy exist; no deployed persistent seller |
| Human handoff/action plane | none | Planned; no merged real handoff |
| Agency/client operation | none | Auth/tenancy/per-client controls not built |
| Commercial customer value | none | No measured time savings, accepted opportunity, willingness-to-pay, or unit economics |

Evidence states are cumulative labels, not synonyms: `IMPLEMENTED` < `WIRED` < `REAL_MODEL_TESTED` < `LIVE_TESTED` < `COMMERCIALLY_VALIDATED`.

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
| 12 — Sandbox + network safety for external research | PASSED | PR #64 / Stagehand 35464578747 |

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
- `docs/project/history/2026-09-19-gate12-sandbox-network-safety.md`

Tests/current code remain stronger evidence than this summary.

## Project memory

The memory system uses:

- `AGENTS.md` as the bootloader;
- this file as the single hot-memory hub;
- active GitHub issue #65 as short-lived working memory for Gate 13;
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

1. **Product/value risk — current Gate 13 blocker:** the six-company U.S./China set is calibration/stress evidence only. The first acceptance experiment is now defined as 30–50 U.S. industrial/logistics companies selected by a frozen method, compared against a human researcher using normal tools with the human baseline measured before each Astra run. Astra still has no human-audited live acceptance cohort, measured preparation-time reduction, or measured live delivery cost.
2. **Semantic-support risk — measured-sample control:** capture receipts prove source-page/screenshot identity and hashes, not whether a natural-language claim is actually supported. Every material observed fact still requires human source-page/screenshot review in Gate 13.
3. **Scale ownership risk:** cancellation intent and Steel endpoint exclusivity are not yet durable cross-process leases/fences. Gate 13 therefore stays serial/single-owner; multiple workers require durable ownership/fencing and centralized endpoint allocation.
4. **Future renderer/state-update risk:** PR #74 closes the current `SalesDecision` buyer-visible prose loophole, but any future shipped final-response renderer and durable conversation state update need their own independent output evaluation before release claims.
5. **Agency boundary risk:** authentication, tenant/client ownership, per-client offer/claim configuration, budgets, retention/export/deletion, audit, and recovery must exist before accepting another organization's data.

## Next action

**Gate 13 — calibrate, then run the U.S. industrial/logistics acceptance cohort (issue #65):** treat the existing six-company U.S./China set as `CALIBRATION` only. It may validate workflow mechanics, reviewer instructions, source-page fit, China/U.S. source differences, and cost accounting, but it cannot produce a Gate 13 verdict.

For acceptance, freeze 30–50 explicitly approved **U.S. industrial/logistics** companies using a selection method written before results. The human comparator uses its normal research tools. Persist a server-timestamped human baseline record for the frozen sample/target before Astra is allowed to start, then record blind/unblinded review. Run serially through: stored approval → frozen-sample membership → durable human baseline → bounded read-only model-backed public research → semantically settled capture receipts → evidence/uncertainty review → human source audit → accepted/corrected brief or explicit live failure. Keep failed attempts in the denominator and freeze the cost ceiling/rationale before results. China receives a separate acceptance cohort only after its local multi-source source policy is implemented and qualified.

Do not start authenticated contact discovery, outreach/email/LinkedIn/X, CRM writes, calendar/social actions, voice/avatar, agency-client data ingestion, or new irreversible external side effects in Gate 13.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
