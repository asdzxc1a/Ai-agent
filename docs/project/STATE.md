# Current Project State

**Last updated:** 2026-09-20  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Sandbox/network isolation → controlled live prospect research
**Current gate:** Gate 13 — Evidence-backed live prospect research
**Overall status:** Gates 0–12 are PASSED. Gate 13 is active in issue #65. PR #68 merged the approved live-research foundation and PR #69 hardened server-owned research state: stored approval provenance, approved-domain sandbox policy, evidence/prospect persistence, classified live-research failures, protected run/prospect identity, canonical Gate 13 qualification state, and server-owned capture clocks now exist. Gate 13 remains IN_PROGRESS because the audit-confirmed trust gaps must be closed before a measured live sample counts as product evidence, and no operator-approved real-company/domain sample has been supplied or researched.

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

### Gate 13 approved live-research foundation

`@astra/prospect-research` now owns operator-approved target records, approval provenance, evidence/claim/unknown contracts, target-scoped network policy derivation, semantic completion validation, durable research attempts, and `RESEARCH_EVIDENCE` artifacts. `@astra/prospect-postgres` provides independent migrations and durable restart persistence for approved targets, attempts, and Prospects.

Authorization comes from stored server state rather than model/result prose. The model-facing research result excludes approval state, run/prospect identity, fit/disqualifiers, capture timestamps, and artifact IDs. Durable identities are derived from the stored target and run; Gate 13 Prospect fit remains `unknown` with no disqualifiers so Gate 14 qualification/scoring does not leak backward into research.

Material evidence must reference a real `SCREENSHOT` artifact from the same run. The post-run server/manual audit supplies the evidence→artifact mapping, and durable evidence capture times are taken from the referenced screenshot artifact records. Observed facts must exactly match referenced observed evidence; hypotheses remain explicitly inferred; unknowns remain explicit. Both in-memory and PostgreSQL repositories independently revalidate the stored approval and canonical protected research state before accepting attempts.

Screenshot artifacts are run-scoped and server-timestamped but do not currently record the page URL they depict. Gate 13 therefore still requires the planned manual spot-check of every material observed fact against its claimed public source and screenshot; the implementation does not pretend that source↔screenshot correspondence is automatically proven.

No real-company/domain research has been executed under Gate 13 because no operator-approved fixed sample exists yet.

The September 20 audit reproduced trust gaps that block a live sample from counting as Gate 13 acceptance evidence: redirect navigation can bypass the full network policy; terminal event/status persistence and background execution are not one supervised atomic boundary; completed SSE replay truncated after one 100-event batch; screenshot presence still does not prove source-page/content support; uncertainty/provenance are not preserved strongly enough into the sales domain; and SalesBench can miss fabricated buyer-visible prose outside structured claims. This audit-alignment change adds a focused >100-event SSE replay regression/fix; the other trust gaps remain Gate 13 work.

Gate 13 stays serial/single-owner while multi-worker cancellation/leases/fencing, reconciliation, and centralized Steel endpoint ownership remain future scale work.

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
| Gate 13 approved research foundation | `IMPLEMENTED` | Contracts/storage/server-owned research truth exist; live operator workflow is not yet wired/accepted |
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

1. **Request-policy risk — Gate 13 blocker:** the audited redirect probe reached a forbidden port after an allowed initial URL. Full scheme/credential/port/hostname/resolved-address enforcement must cover redirects and actual request paths before measured live research.
2. **Durable truth/supervision risk — Gate 13 blocker:** terminal event and terminal run state are separate writes and background execution can reject without supervision. Interrupted work needs an atomic terminal boundary plus reconciliation.
3. **Evidence/provenance risk — Gate 13 blocker:** PR #69 strengthens server-owned capture identity and manual screenshot mapping, but same-run screenshot presence is still not proof that a claimed source/page supports the observation. Add server-owned source/page/content capture receipts and preserve uncertainty/provenance through the sales-domain handoff; keep manual material-claim audits.
4. **Evaluation risk — before seller/release claims:** SalesBench can miss unsupported buyer-visible prose when structured claims are empty, and several sub-scores are overlapping proxies. Final rendered output and durable state update require independent evaluation.
5. **Scale ownership risk:** cancellation and Steel endpoint exclusivity are process-local. Gate 13 therefore stays serial/single-owner; multiple workers require durable cancellation intent, leases/fencing, guarded transitions, reconciliation, and centralized endpoint ownership.
6. **Cleanup risk:** optional diagnostics can outlive the run deadline and delay resource release; diagnostics/cleanup need independent bounded deadlines.
7. **Product/value risk:** there is no complete main-branch operator workflow and no measured preparation-time savings, accepted handoff, willingness to pay, or delivery cost.
8. **Agency boundary risk:** authentication, tenant/client ownership, per-client offer/claim configuration, budgets, retention/export/deletion, audit, and recovery must exist before accepting another organization's data.
## Next action

**Gate 13 — audit hardening before the measured sample (issue #65):** accept the focused SSE backlog regression/fix in PR #70, then close the full redirect/request policy path, terminal persistence/supervision + reconciliation, server-owned source/page/content capture receipt + uncertainty handoff, rendered-prose evaluator, and bounded diagnostics/cleanup gaps. Keep execution serial and preserve Gate 11/12 regressions.

After those trust blockers are green, obtain the operator's explicit fixed company/domain cohort, freeze it, wire approved target → bounded real-model research → evidence review → accepted/corrected brief, and record review time, corrections, coverage, duration, failures, and complete cost. Do not choose or broaden real-company targets autonomously.

Do not start authenticated contact discovery, outreach/email/LinkedIn/X, CRM writes, calendar/social actions, voice/avatar, agency-client data ingestion, or new irreversible external side effects in Gate 13.
## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
