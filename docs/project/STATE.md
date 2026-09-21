# Current Project State

**Last updated:** 2026-09-21  
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

Capture receipts prove which semantically settled page/screenshot bytes were recorded; they do **not** independently prove that a natural-language observation is semantically supported by the page. Gate 13 therefore still requires a human source-page/screenshot audit for every durable observed evidence item in the measured sample. Completed outcome persistence derives the required `materialClaimsReviewed` count from the durable attempt evidence set and rejects any mismatch, so audit coverage cannot be entered as a free lower count.

The complete 43-member U.S. transportation acceptance universe also has a separately versioned **approval-candidate enrichment manifest** at `docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json`. It maps every frozen ticker/target ID to a proposed canonical domain, official public start URL, approved-domain candidate, and verification source. This is metadata preparation only: every row remains `PENDING_OPERATOR_APPROVAL`, the manifest is top-level `NOT_APPROVED`, and it contains no approval IDs/timestamps or `approvedBy` fields.

A narrow internal Gate 13 operator surface exists at `apps/gate13-operator`. Its approval preview is mutation-free and computes the exact SHA-256 of the checked-in manifest bytes. Its approval path derives all 43 target records from those same bytes, requires explicit manifest-ID/SHA confirmation plus `--authorize-all-43`, and persists through the atomic PostgreSQL batch boundary. After approval, the same app derives the acceptance sample from the canonical manifest, universe, and stored batch; freezes only the exact 43-member `COMPLETE_UNIVERSE`; records server-timestamped `MEASURED_HUMAN` baselines; starts one frozen target at a time through the existing read-only workflow; surfaces artifacts for human source/screenshot audit; requires explicit `--human-audit-complete` before completed-attempt persistence; records typed failures; snapshots server-owned run duration plus owned `ACT`/`AGENT_LOOP_ACTION` count into each service-generated attempt; derives outcome provenance/disposition/duration/action count from durable sample + baseline + attempt truth; and reports status/evaluation without silently changing state. Stagehand prompt/completion/reasoning/cached-token counts and inference time are now mapped into an owned model-usage snapshot before agent cleanup, persisted as an `AGENT_MODEL_USAGE` run step and in `run-summary.json`, and exposed through the operator `run-usage` command. This is measured usage evidence, not a dollar-cost estimate. Acceptance now freezes both a versioned source-attributed delivery-cost plan and an exact execution profile before results. The profile pins the checked-in Stagehand dependency version, model name/base URL, Steel base URL, and the checkout's expected immutable Steel image pin; the image field is explicitly `EXPECTED_IMAGE_PIN_ONLY`, not a claim that endpoint health attested the running container digest. `run-target` resolves the current profile from env + repository pins, refuses to start when it differs, and records the matched profile durably. Outcome component costs/total are derived from durable usage plus the frozen cost plan; reviewer input no longer owns the dollar scalar. Acceptance also freezes the exact four requested business fields and derives covered field IDs/counts from durable report values or explicit unknowns; silent omission is uncovered and failed attempts cover zero. Acceptance review likewise no longer owns end-to-end duration or unauthorized-action count: those values are derived from durable run timestamps/steps and must match the persisted attempt exactly. Self-hosted Steel uses an explicit documented infrastructure allocation rather than managed Steel Cloud pricing. Read-only database inspection paths do not auto-run migrations. Live `run-target` additionally holds one database-scoped PostgreSQL advisory ownership lock for its full lifetime, preventing two operator processes from accidentally violating Gate 13's serial/single-owner assumption. This is deliberately narrower than the durable lease/fencing system required for future multi-worker execution. This tooling does **not** itself authorize the real cohort; no approval batch exists until the operator deliberately executes that mutation.

No real-company/domain research has been executed under Gate 13 because no operator-approved fixed sample exists yet. The code path and smallest internal operator command surface are ready to execute the frozen protocol once the operator supplies explicit all-43 authorization, a normal-tools human-baseline description, and a per-brief cost ceiling/rationale, frozen source-attributed delivery-cost plan, and frozen execution profile matching the intended model endpoint and Steel endpoint. Gate 13 stays serial/single-owner while multi-worker leases/fencing, durable cancellation intent, and centralized Steel endpoint ownership remain later scale work.

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

1. **Product/value risk — current Gate 13 blocker:** the complete 43-member U.S. transportation acceptance universe is frozen and every member now has verified official public domain/start-page **candidate** metadata. The manifest-bound approval command is available, but candidate enrichment/tooling is not authorization and no real approval batch has been persisted. Gate 13 still needs explicit operator authorization for one atomic durable approval batch, one durable pre-run measured-human baseline per accepted target, the serial live run, and a complete reviewed outcome set under the frozen v7 total-labor/usability protocol before any value claim.
2. **Semantic-support risk — measured-sample control:** capture receipts prove source-page/screenshot identity and hashes, not whether a natural-language claim is actually supported. Every durable observed evidence item still requires human source-page/screenshot review in Gate 13; audit-count completeness is now derived and enforced, but the semantic support judgment remains human.
3. **Scale ownership risk:** Gate 13 live operator commands now enforce one database-scoped cross-process owner, but cancellation intent and worker ownership are not durable leased/fenced state. Gate 13 therefore stays serial/single-owner; multiple workers still require durable ownership/fencing and centralized endpoint allocation.
4. **Future renderer/state-update risk:** PR #74 closes the current `SalesDecision` buyer-visible prose loophole, but any future shipped final-response renderer and durable conversation state update need their own independent output evaluation before release claims.
5. **Agency boundary risk:** authentication, tenant/client ownership, per-client offer/claim configuration, budgets, retention/export/deletion, audit, and recovery must exist before accepting another organization's data.

## Next action

**Gate 13 — calibrate, then run the complete U.S. transportation acceptance universe (issue #65):** treat the existing six-company U.S./China set as `CALIBRATION` only. It may validate workflow mechanics, reviewer instructions, source-page fit, China/U.S. source differences, and cost accounting, but it cannot produce a Gate 13 verdict.

For acceptance, use the complete 43-equity IYT holdings snapshot dated 2026-09-17 as the independent U.S. transportation candidate universe. The 43/43 public-metadata enrichment manifest is prepared, but remains explicitly unapproved. Use `pnpm gate13:operator -- preview` to review the exact canonical manifest ID/SHA and all 43 proposed domains/start URLs without mutation. The next operator transition is explicit authorization followed by the guarded `approve` command, which derives one atomic manifest-hash-bound durable approval batch for all 43 members from those exact bytes; if confirmation, validation, or storage fails, none of the batch is authorized. After that batch succeeds, freeze exactly those 43 target IDs with no discretionary exclusions or sampling. The human comparator uses its normal research tools. A member that blocks or lacks usable public access remains in the denominator as explicit failure evidence rather than being removed after results are known. Persist a server-timestamped human baseline record for the frozen sample/target before Astra is allowed to start, then record blind/unblinded review under the frozen `gate13-brief-review-v1` correction-severity rubric. Run serially through: stored approval → frozen-sample membership → durable human baseline → bounded read-only model-backed public research → semantically settled capture receipts → evidence/uncertainty review → human source audit → accepted/corrected brief or explicit live failure. Keep failed attempts in the denominator, count all Astra-side human labor (target setup, evidence mapping/source audit, corrections/finalization, failure triage, and other measured operator work), and freeze the cost ceiling/rationale before results. China receives a separate acceptance cohort only after its local multi-source source policy is implemented and qualified.

Do not start authenticated contact discovery, outreach/email/LinkedIn/X, CRM writes, calendar/social actions, voice/avatar, agency-client data ingestion, or new irreversible external side effects in Gate 13.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
