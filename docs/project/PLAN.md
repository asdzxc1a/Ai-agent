# Build Plan

Status values:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `PASSED`

Only one gate should normally be `IN_PROGRESS`.

## Gate 0 — Repository + CI

**Status:** PASSED

Build:

- TypeScript workspace;
- package manager configuration;
- lint;
- typecheck;
- unit-test runner;
- build;
- GitHub Actions CI.

Acceptance:

- clean checkout installs deterministically;
- `pnpm lint` passes;
- `pnpm typecheck` passes;
- `pnpm test` passes;
- `pnpm build` passes;
- same commands run in GitHub Actions.

Do not add browser complexity yet.

---

## Gate 1 — Steel alone, local

**Status:** PASSED

Build:

- local Steel via supported Docker/Docker Compose;
- one deterministic fixture web page;
- `SteelBrowserProvider` spike;
- raw Playwright/CDP connectivity for verification.

Acceptance:

- create Steel session;
- navigate to local fixture;
- click deterministic button;
- verify changed state;
- capture screenshot;
- close session;
- repeat 10/10 successfully.

---

## Gate 2 — Stagehand → Steel

**Status:** PASSED

Build:

- Stagehand connects to Steel's CDP URL;
- `observe`;
- `act`;
- `extract`;
- structured result schema.

Acceptance:

- local deterministic fixture task completes 10/10;
- output schema validates;
- browser session closes every time;
- no leaked processes/sessions.

---

## Gate 3 — Our browser/agent interfaces

**Status:** PASSED

Build:

- `BrowserRuntime`;
- `BrowserSession`;
- `AgentRuntime`;
- Steel adapter;
- Stagehand adapter;
- fake implementations for unit tests.

Acceptance:

- Gate 2 test passes through our abstractions;
- application code contains no direct Steel-specific calls outside the Steel adapter;
- application code contains no direct Stagehand-specific calls outside the Stagehand adapter.

---

## Gate 4 — First product API

**Status:** PASSED

Build:

- `POST /v1/runs`;
- `GET /v1/runs/:id`;
- URL + goal + optional output schema;
- run IDs;
- structured result.

Acceptance:

- API request runs deterministic browser task;
- result matches schema and expected fixture state;
- failure returns typed error, not generic 500.

---

## Gate 5 — Durable run engine

**Status:** PASSED

Build:

- PostgreSQL;
- `runs`;
- `run_steps`;
- `run_events`;
- states: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.

Acceptance:

- run state survives API process restart;
- steps/events remain queryable;
- final result persists;
- no run is marked complete without final validation.

---

## Gate 6 — Replayable SSE

**Status:** PASSED

Build:

- `GET /v1/runs/:id/events`;
- monotonically increasing sequence IDs;
- reconnect support using last event ID.

Acceptance:

- disconnect client mid-run;
- run continues;
- reconnect receives missing events in order;
- final result exactly matches persisted run.

---

## Gate 7 — Artifacts + debugging

**Status:** PASSED

Build:

- screenshots;
- URLs;
- browser console errors;
- action summaries;
- timing;
- model/agent response metadata;
- local artifact storage first.

Acceptance:

- intentionally failing fixture leaves enough evidence to diagnose why it failed;
- secrets are not present in normal logs/artifacts.

---

## Gate 8 — Sales domain contract + SalesBench baseline

**Status:** PASSED

Purpose:

- define exactly what Astra sells before asking a model to sell it;
- define the smallest owned sales-domain state needed for prospecting and consultative selling;
- build a trustworthy evaluation harness and record an honest Baseline 0 before improving sales intelligence.

Build:

- `ServiceOffer` with approved claims, evidence requirements, non-claims, and unknowns;
- provider-neutral schemas for `Evidence`, `Prospect`, `Buyer`, `Opportunity`, `QualificationState`, `SalesDecision`, `NextAction`, `Outcome`, and `PublicProof`;
- AI-native company/workforce transformation ontology V1;
- explicit separation of observed fact, inferred hypothesis, operator-approved claim, and unknown;
- consultative policy baseline: research → relevant hypothesis → one useful question → state update → evidence/next step;
- 30–50 deterministic SalesBench scenarios covering fit, no-fit, objections, uncertainty, trust, discovery, qualification, and next-step choices;
- two evaluation lanes:
  1. deterministic policy/contract lane;
  2. pinned-model capability lane;
- score vector for factuality, evidence use, relevance, question quality, information gain, qualification quality, trust, pressure, and next-step quality.

Non-goals:

- no live prospect outreach;
- no email/LinkedIn/X sending;
- no voice integration;
- no CRM writeback;
- no model training;
- no new browser infrastructure.

Acceptance:

- all new public domain schemas validate deterministically;
- the service/claim boundary contains no invented pricing, guarantees, customer proof, or outcome claims;
- SalesBench scenarios/evaluators are versioned and runnable from a clean checkout;
- current behavior is recorded as Baseline 0 without changing the benchmark to improve the score;
- deterministic policy/security assertions have zero known violations;
- Gate 8 passes on evaluation-system trustworthiness, not a target conversion/sales score;
- existing Gates 0–7 regressions remain green.

---

## Gate 9 — Owned multi-step sales-agent loop

**Status:** PASSED

Purpose:

- turn the existing one-step semantic browser execution into owned multi-step orchestration suitable for prospect research;
- keep Stagehand as a semantic capability provider rather than the owner of Astra's lifecycle.

Build:

- owned loop/executor boundary;
- explicit decision outcomes such as `ACTION | COMPLETE | FAIL | BLOCKED`;
- repeated observe → decide → act → observe cycles;
- compact persisted trajectory/progress records;
- recoverable action-failure path;
- SalesBench research tasks that require at least three browser actions.

Acceptance:

- deterministic multi-step fixture completes through the owned loop;
- multiple action steps are persisted in order;
- progress evidence is sufficient to diagnose each step;
- recoverable action failure can return control to the loop without corrupting run state;
- the loop cannot mark a sales/research goal complete merely because one browser action returned success;
- Gates 1–8 regressions remain green.

---

## Gate 10 — Completion, effects, cancellation + budgets

**Status:** PASSED

Purpose:

- make `COMPLETED` mean the requested sales/research goal was verified;
- bound autonomous execution before broad prospect research.

Build:

- goal state: `IN_PROGRESS | COMPLETED | FAILED | BLOCKED`;
- completion/verifier policy separate from browser-action success;
- action effect semantics: `none | committed | unknown`;
- maximum steps;
- wall-clock timeout;
- model usage/cost budget;
- explicit cancellation propagation;
- loop detection;
- typed terminal reasons.

Acceptance:

- `act.success === true` cannot by itself mark a goal complete;
- step-limit, timeout, cost-budget, and explicit cancellation terminate with correct durable state;
- resources are released on every termination path;
- no zombie Steel session remains;
- simulated `effect=unknown` after an irreversible action is never blindly retried;
- completion verifier rejects intentionally wrong-but-schema-valid results.

---

## Gate 11 — Deterministic prospect-research qualification

**Status:** PASSED

Purpose:

- prove the owned loop can research companies reliably before touching live prospects at scale.

Build 25–50 local company/research fixtures covering:

- about/company pages;
- product/service pages;
- team/leadership pages;
- careers/hiring signals;
- press/news pages;
- multi-page evidence collection;
- tables/cards/modals;
- delayed/dynamic content;
- conflicting information;
- missing information;
- distractor elements;
- stale dates;
- prompt-injection-like page text;
- source attribution;
- unknown/uncertain facts.

Split tasks into:

- **core** — release-blocking research behaviors Astra claims to support;
- **hard** — challenge/research tasks measured without blocking every merge.

Acceptance for the core suite:

- >=95% first-attempt expected-state success over the agreed qualification sample;
- zero false-completed runs in the qualification sample;
- zero unsupported claims promoted as observed facts;
- every material fact can be traced to stored evidence;
- every failure is locally reproducible or explicitly classified;
- Gates 1/2 browser lifecycle regressions remain 10/10;
- no known browser/session leaks.

**Pause here before adding sandbox complexity or live outreach.**

---

## Gate 12 — Sandbox + network safety for external research

**Status:** PASSED

Purpose:

- add isolation only after multi-step sales research is measured;
- prevent untrusted public websites from reaching sensitive networks/runtime state.

Build:

- owned `SandboxRuntime` / `SandboxSession` boundary;
- E2B or another provider behind that boundary only if it passes the owned contract;
- explicit browser/network egress policy;
- isolation tests for cookies, storage, filesystem, processes, ports, and session identifiers;
- redirect/DNS/private-network defenses;
- composed sandboxed browser runtime.

Acceptance:

- unchanged sales-research contracts run through local and sandbox providers;
- Stagehand/sales logic gains no E2B-specific dependency;
- sandbox terminates after success/failure/cancellation;
- localhost, private RFC1918, link-local, and metadata targets are blocked by default for untrusted runs;
- allowed public-fixture navigation still works;
- two simultaneous sandboxes do not share state.

---

## Gate 13 — Evidence-backed live prospect research

**Status:** IN_PROGRESS

Purpose:

- turn the approved-target/evidence foundation into one complete human-supervised research workflow for our own company;
- close audit-confirmed trust gaps before a measured live-web sample can count as product evidence;
- measure whether Astra reduces preparation effort without increasing factual risk.

Build:

- retain the merged approved-target registry, evidence contract, classified live failures, durable Prospects, and Gate 12 sandbox boundary;
- preserve the audit hardening now merged on `main`:
  - PR #70: completed SSE replay drains through the terminal sequence beyond one 100-event batch;
  - PR #71: the full scheme/credential/port/hostname/DNS/IP network policy owns every Stagehand request path, including redirects/subresources;
  - PR #72: terminal event + run snapshot are atomic/transactional, background execution is supervised, and orphaned active runs reconcile before API readiness;
  - PR #73: material evidence uses semantically settled server-owned capture receipts binding final page URL, capture time, page-content hash, screenshot hash, and artifact identity; research uncertainty/provenance survives into sales evidence;
  - PR #74: prohibited buyer-visible commercial prose hard-fails even when structured `claims` is empty; frozen SalesBench v1 remains 32/40;
  - PR #75: diagnostics and each cleanup operation have independent bounded deadlines, and browser/provider cleanup is attempted even after agent cleanup failure/timeout;
  - PR #77: the first operator research composition is stored-approval-only, serial, read-only, action-free, source-page constrained, and persists only after operator artifact review;
  - PR #78: the measured cohort/criteria are durable and pre-registered; measured runs require frozen-sample membership; failed live attempts remain in the denominator; incomplete cohorts cannot report a pass;
- constrain the research composition to research-safe actions; effect labels describe retry semantics and never authorize the first side effect;
- keep Gate 13 execution serial/single-owner while durable worker ownership, fencing, and cross-process endpoint reservations are not implemented;
- keep the merged smallest complete operator workflow green: stored approval → frozen-sample membership → bounded read-only model-backed research on the approved start page → evidence/uncertainty review → accepted/corrected brief or explicit live failure;
- use small cross-region samples only for calibration/stress testing; they may not close Gate 13;
- for Gate 13 acceptance, freeze 30–50 approved companies from one explicit commercial niche, consistent with D-030 and the September audit;
- require a measured human baseline for each acceptance target before its Astra attempt starts; fixed-cap baseline estimates are calibration-only;
- record whether review was blind or unblinded and prefer blind review where practical;
- freeze a rationale-backed cost ceiling before results and record every attempt, review minutes, correction count/severity, unsupported material claims, requested-field coverage, duration, and complete provider/browser cost.

Non-goals:

- no authenticated contact discovery;
- no outreach/email/LinkedIn/X;
- no CRM writes;
- no social posting;
- no voice/avatar;
- no scheduling/calendar actions;
- no multi-worker or agency-client operation;
- no new irreversible external side effect.

Acceptance:

- audit-hardening regressions for redirect/request policy, terminal persistence/supervision/reconciliation, >100-event SSE replay, capture provenance, buyer-visible prohibited prose, and bounded diagnostics/cleanup remain green;
- material research evidence has server-owned semantically settled provenance receipts; manual source/screenshot spot-checks remain mandatory for the measured sample until automated semantic-support judgment is separately qualified;
- uncertainty/provenance survive the research → sales-domain handoff;
- current buyer-visible `SalesDecision` prose cannot pass prohibited-claim checks solely because structured `claims` is empty; any future shipped renderer/state-update pipeline requires an independent equivalent check;
- the merged operator workflow remains read-only/action-free and can produce a reviewable accepted/corrected brief without contacting the prospect;
- every measured run requires both stored approval and membership in the durable frozen sample;
- the measured cohort contains only explicitly approved frozen targets, cannot be overwritten/widened after freeze, and is never broadened during the run;
- calibration cohorts return no pass/fail verdict even when complete;
- Gate 13 acceptance cohorts contain 30–50 frozen targets from the chosen niche; incomplete cohorts return no verdict and exactly one outcome per frozen target is required;
- acceptance outcomes use `MEASURED_HUMAN` baseline provenance recorded before the corresponding Astra attempt; baseline source and review mode remain durable evidence;
- every material observed fact in the measured sample is manually checked against its claimed source;
- unsupported hypotheses are never represented as observed facts and unknowns remain explicit;
- live-site failures remain `LIVE_RESEARCH_FAILURE` and do not change the frozen Gate 11 deterministic release result;
- experiment thresholds are frozen durably before results: zero observed unsupported material claims, at least 90% of briefs usable with only a minor edit, at least 50% reduction in median total human preparation time including review, zero unauthorized actions, and an operator-supplied positive maximum delivery cost per brief;
- deterministic Gate 11 remains the release gate and Gate 12 sandbox/network regressions remain green.

### Ordering after Gate 13

- prove the text seller before realtime voice;
- prove one durable human handoff before adding voice/avatar complexity;
- do not add multiple workers until durable cancellation intent, leased/fenced ownership, atomic transitions, reconciliation, and centrally owned Steel endpoint allocation exist;
- before accepting any external agency/client data, add and pass an explicit agency operating boundary covering identity/authorization, tenant/client ownership, per-client offer/ICP/claims, approval roles, budgets, retention/export/deletion, audit, and recovery.

---

## Gate 14 — ICP scoring + durable prospect queue

**Status:** NOT_STARTED

Purpose:

- decide who Astra should spend time on without letting an LLM silently define fit.

Build:

- explicit ICP/disqualifier configuration;
- explainable fit score with rule/model contributions separated;
- durable prospect/account identity;
- prospect states such as `NEW | RESEARCHED | QUALIFIED_FOR_OUTREACH | DEFERRED | DISQUALIFIED`;
- next-best-action suggestion without execution;
- deduplication by canonical company identity.

Acceptance:

- ranking is reproducible for deterministic fixtures;
- disqualifiers cannot be overridden by model prose;
- duplicate companies do not create independent active prospects;
- every score exposes rationale and uncertainty;
- restart preserves queue/prospect state.

---

## Gate 15 — Personalized outreach draft + human approval

**Status:** NOT_STARTED

Purpose:

- prove Astra can turn research into a relevant first contact without granting autonomous send authority.

Build:

- draft generation for one approved channel first;
- recipient/channel/message as a typed server-owned proposal;
- evidence references used for personalization;
- anti-spam/repetition/unsupported-claim checks;
- approval/edit/reject lifecycle;
- preview artifact/UI.

Non-goals:

- no autonomous send;
- no purchased-list blasting;
- no multi-channel sequence engine.

Acceptance:

- SalesBench outreach scenarios include strong-fit, weak-fit, no-fit, ambiguous evidence, and sensitive situations;
- factuality/evidence gates pass before a draft is approvable;
- drafts do not fabricate familiarity, urgency, customer proof, or business facts;
- rejected/edited drafts remain auditable;
- no external side effect occurs in this gate.

---

## Gate 16 — Persistent consultative sales conversation

**Status:** NOT_STARTED

Purpose:

- make Astra a real seller in text before adding realtime voice complexity.

Build:

- durable buyer/account/opportunity state;
- incremental qualification rather than questionnaire behavior;
- objection handling grounded in current state and approved evidence;
- one visible seller persona;
- canonical sales-decision boundary where models advise and server-owned state wins;
- conversation trajectory events suitable for later evaluation;
- selective reuse of proven sales-state/canonicalization concepts from draft PR #2 behind owned main-branch contracts.

Acceptance:

- multi-turn SalesBench includes discovery, no-fit, incumbent supplier, uncertainty, trust, budget/timing, and handoff scenarios;
- buyer facts persist across process restart;
- model output cannot overwrite protected identity/consent/action truth;
- known facts are not repeatedly re-asked without a reason;
- evaluation records information gain and next-step quality.

---

## Gate 17 — Durable action plane + real human handoff

**Status:** NOT_STARTED

Purpose:

- prove one safe, useful business handoff after the text seller works and before adding realtime voice complexity.

Build:

- durable PostgreSQL action proposal/state machine;
- typed `human_handoff` payload containing opportunity/buyer/context summary;
- explicit confirmation;
- atomic `confirmed → executing` transition;
- provider idempotency key;
- `none | committed | unknown` effect semantics;
- sanitized receipt/audit trail;
- one real internal handoff provider only.

Acceptance:

- pending/unconfirmed actions cannot execute;
- crash/retry cannot silently execute twice;
- ambiguous provider failure is `unknown`, never guessed;
- cross-prospect/session execution is blocked;
- secrets cannot enter client-visible receipts, learning artifacts, or public proof;
- one approved controlled handoff succeeds end to end;
- handoff acceptance and human correction effort are recorded as product evidence.

---

## Gate 18 — Realtime voice route selection + live acceptance

**Status:** NOT_STARTED

Purpose:

- add natural voice only after the text seller and one durable human handoff are accepted;
- choose one canonical realtime route by measured outcome, latency, and reliability rather than branch history;
- defer this gate if voice has no demonstrated value relative to its transport, QA, and support cost.

Build:

- one owned conversation/voice adapter contract;
- benchmark strongest reusable work from draft PR #2 (Qwen→GPT-Live and/or native GPT-Live);
- interruption/barge-in;
- transcript-to-durable-sales-state correlation;
- latency/transport/cost metrics;
- optional avatar behind a renderer interface.

Non-goals:

- no requirement to keep two production voice architectures;
- no avatar rewrite;
- no new autonomous external sales actions.

Acceptance:

- deterministic/mock transport tests pass;
- at least 20 scripted live conversations complete without state corruption;
- human microphone tests cover interruption, unclear speech, and long turns;
- speaking layer adds no unsupported commercial claims;
- measured latency/reliability/cost selects one canonical route;
- an explicit measured user/business outcome justifies retaining voice rather than text-only operation;
- avatar, if enabled, passes a separate drift/reconnect acceptance.

---

## Gate 19 — Follow-up + scheduling/CRM, one connector at a time

**Status:** NOT_STARTED

Purpose:

- extend the same durable action contract instead of adding ad-hoc integrations.

Build in sequence:

1. follow-up draft/send provider;
2. meeting/scheduling provider;
3. CRM opportunity/note provider.

Each action requires a typed server-owned payload, permission scope, idempotency contract, sanitizer, regression suite, and explicit enablement.

Acceptance:

- each connector passes independently before the next is added;
- no generic arbitrary-tool execution endpoint appears;
- real writes remain policy/permission gated;
- CRM state and Astra state reconcile after retries/restarts.

---

## Gate 20 — Public proof pipeline

**Status:** NOT_STARTED

Purpose:

- let Astra demonstrate its own work without turning marketing copy into an unverified claim.

Build:

- `PublicProof` artifact derived from verified run/outcome evidence;
- PII/secret/customer-name redaction policy;
- metrics/evidence links for internal review;
- LinkedIn/X draft generation;
- approve/edit/reject flow;
- idempotent publication proposal, but no autonomous posting yet.

Acceptance:

- no metric/outcome claim appears without durable evidence;
- private prospect data is excluded by tests;
- draft distinguishes observed result from interpretation;
- approval is required before publication.

---

## Gate 21 — SalesOS evaluator + experience retrieval

**Status:** NOT_STARTED

Purpose:

- improve Astra from measured experience before model training.

Build:

- deterministic factuality/tool/action validators;
- calibrated human/LLM evaluation workflow;
- durable reward/evaluation records;
- training-eligibility hard gates;
- experience records linking state → strategy → observable outcome;
- retrieval of relevant approved experiences into strategy selection;
- bounded/deduplicated experience growth.

Acceptance:

- evaluator agreement with human-labeled calibration set is measured;
- unsafe/unfactual outcomes cannot become approved experiences;
- experience retrieval improves frozen SalesBench without increasing hard-gate failures;
- no weight training is required.

---

## Gate 22 — Bounded autonomy + authenticated capabilities

**Status:** NOT_STARTED

Purpose:

- move selected previously approved actions to explicit policy-controlled autonomy.

Build only for capabilities justified by evidence:

- credential/capability broker;
- profiles/session restoration;
- per-action autonomy policy;
- tenant/user ownership and authentication where required;
- rate/spend/reputation limits;
- incident/kill-switch path;
- platform-specific compliance/terms constraints.

Acceptance:

- every autonomous capability is individually enabled/revocable;
- credentials never enter model context or ordinary artifacts;
- malicious page content cannot grant capabilities;
- authenticated state cannot leak across tenants/prospects;
- effect state remains durable/auditable;
- autonomy can be disabled without changing conversation logic.

---

## Gate 23 — Controlled real-market pilot

**Status:** NOT_STARTED

Purpose:

- measure whether Astra creates genuine pipeline rather than merely passing simulation.

Build:

- small approved target cohort;
- approved channels and volume limits;
- opportunity/outcome tracking;
- buyer feedback and human-sales review;
- permanent regression capture for material failures.

Measure separately:

- research accuracy;
- relevant-reply rate;
- qualification completeness;
- meeting/handoff conversion;
- false-positive qualification;
- opt-out/negative-response rate;
- factuality/compliance;
- time to next action;
- cost per qualified opportunity;
- human-rep acceptance of handoffs.

Acceptance:

- pilot size/channels are explicitly authorized before launch;
- the Gate 13 internal value experiment has already established a useful human-supervised workflow; this gate does not substitute feature breadth for that evidence;
- no success claim relies only on simulated buyers;
- negative outcomes remain in the report;
- go/no-go thresholds for expanding autonomy are written before results are known;
- if any participant supplies data for an organization other than our own company, the explicit agency operating boundary described after Gate 13 must be implemented and passed first.

---

## Gate 24 — Production sales service + scale

**Status:** NOT_STARTED

Purpose:

- productionize only after the sales loop demonstrates real value.

Build/verify as measured needs justify:

- authenticated multi-tenant service;
- worker queue, leases, crash recovery, and concurrency policy;
- shared artifact/evidence storage;
- production observability/cost accounting;
- credential management;
- channel/telephony scaling;
- retention/deletion/privacy controls;
- operator Agent Studio for versioned service claims, ICP, playbooks, proof, and policies;
- backup/restore, deployment rollback, graceful draining, and kill switches.

Acceptance:

- worker/process failure does not corrupt opportunity/action truth;
- tenant/auth boundaries pass adversarial tests;
- operational SLOs/cost limits are defined and measured;
- agent/policy versions are traceable to every interaction/public proof;
- backup/restore and rollback are exercised;
- production security review is complete.

---

# Rule for changing this plan

Do not rewrite the roadmap casually.

A durable change requires:

- reason;
- evidence;
- update to `DECISIONS.md` if architecture/product ordering changes;
- updated acceptance criteria;
- `TEST_STRATEGY.md` update when evidence requirements change;
- `STATE.md` update;
- active issue update so a fresh Astra does not follow stale priority.

Small gates are deliberate. Do not combine prospect research, outreach, voice, real actions, public posting, and learning into one implementation wave.
