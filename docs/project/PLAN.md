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

**Status:** NOT_STARTED

Purpose:

- define exactly what Astra sells before asking a model to sell it;
- define the smallest owned sales-domain state needed for prospecting and consultative selling;
- establish deterministic evaluation before live outreach, voice, or external side effects.

Build:

- `ServiceOffer` with approved claims, evidence requirements, non-claims, and unknowns;
- provider-neutral schemas for `Evidence`, `Prospect`, `Buyer`, `Opportunity`, `QualificationState`, `SalesDecision`, `NextAction`, `Outcome`, and `PublicProof`;
- AI-native company/workforce transformation ontology V1;
- explicit separation of observed fact, inferred hypothesis, operator-approved claim, and unknown;
- consultative policy baseline: research → relevant hypothesis → one useful question → state update → evidence/next step;
- 30–50 deterministic SalesBench scenarios covering fit, no-fit, objections, uncertainty, trust, discovery, qualification, and next-step choices;
- structured score vector for factuality, evidence use, relevance, question quality, information gain, qualification quality, trust, pressure, and next-step quality.

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
- SalesBench scenarios are runnable from a clean checkout without external websites;
- baseline results are recorded even if model-backed sales performance is weak;
- deterministic policy/security assertions have zero known violations;
- existing Gates 0–7 regressions remain green.

---

## Gate 9 — Evidence-backed prospect research

**Status:** NOT_STARTED

Purpose:

- turn the proven browser substrate into the first sales-specific capability;
- produce useful prospect intelligence before Astra is allowed to contact anyone.

Build:

- input: approved company URL/domain plus optional ICP context;
- browser research through owned BrowserRuntime/AgentRuntime contracts;
- evidence bundle containing source URL, observation, capture time, and uncertainty;
- company summary, likely transformation opportunities, relevant buying signals, and explicit unknowns;
- hard distinction between observed facts and sales hypotheses;
- research artifacts sufficient to audit each material claim.

Non-goals:

- no contact discovery behind authentication;
- no outreach;
- no CRM writes;
- no social posting.

Acceptance:

- deterministic company fixtures cover at least 20 research cases;
- required facts/evidence are correct on >=95% of deterministic cases;
- zero unsupported claims are promoted as observed facts;
- every material prospect claim can be traced to stored evidence;
- a small approved public-web sample may run as secondary trend evidence, never as the only merge gate.

---

## Gate 10 — ICP scoring + durable prospect queue

**Status:** NOT_STARTED

Purpose:

- decide who Astra should spend time on without letting an LLM silently define fit.

Build:

- explicit ICP/disqualifier configuration;
- explainable fit score with rule/model contributions separated;
- durable `Prospect` records in PostgreSQL;
- prospect states such as `NEW | RESEARCHED | QUALIFIED_FOR_OUTREACH | DEFERRED | DISQUALIFIED`;
- next-best-action suggestion without execution;
- deduplication by canonical company identity.

Acceptance:

- ranking is reproducible for deterministic fixtures;
- disqualifiers cannot be overridden by prose from the model;
- duplicate companies do not create independent active prospects;
- every score exposes rationale and uncertainty;
- restart preserves the queue and prospect state.

---

## Gate 11 — Personalized outreach draft + human approval

**Status:** NOT_STARTED

Purpose:

- prove Astra can convert research into a relevant first contact without granting autonomous send authority.

Build:

- draft generation for one approved channel first;
- recipient/channel/message as a typed server-owned proposal;
- evidence references used to personalize the message;
- anti-spam/repetition/unsupported-claim checks;
- approval/edit/reject lifecycle;
- preview UI/artifact.

Non-goals:

- no autonomous send;
- no purchased-list blasting;
- no multi-channel sequence engine.

Acceptance:

- 30–50 SalesBench outreach scenarios include strong-fit, weak-fit, no-fit, ambiguous evidence, and sensitive situations;
- factuality/evidence gates pass before a draft is approvable;
- drafts do not fabricate familiarity, urgency, customer proof, or business facts;
- rejected/edited drafts remain auditable;
- no external network side effect occurs in the gate.

---

## Gate 12 — Persistent consultative sales conversation

**Status:** NOT_STARTED

Purpose:

- make Astra a real seller in text before adding realtime voice complexity.

Build:

- durable buyer/account/opportunity state;
- incremental qualification rather than questionnaire behavior;
- objection handling grounded in current state and approved evidence;
- one visible seller persona;
- canonical sales decision boundary where models advise and server-owned state wins;
- conversation trajectory events suitable for later evaluation;
- selective reuse of proven sales-state/canonicalization concepts from draft PR #2 behind owned main-branch contracts.

Acceptance:

- multi-turn SalesBench includes discovery, no-fit, incumbent supplier, uncertainty, trust, budget/timing, and handoff scenarios;
- buyer facts persist across process restart;
- model output cannot overwrite protected identity/consent/action truth;
- known facts are not repeatedly re-asked without a reason;
- evaluation records information gain and next-step quality per scenario.

---

## Gate 13 — Realtime voice route selection + live acceptance

**Status:** NOT_STARTED

Purpose:

- add natural voice only after the sales brain/state is testable independently;
- select one canonical realtime path by evidence rather than branch history.

Build:

- adapter(s) for the strongest reusable voice work from draft PR #2;
- benchmark existing Qwen→GPT-Live path and/or native GPT-Live path behind one owned conversation contract;
- interruption/barge-in handling;
- transcript-to-durable-sales-state correlation;
- live latency/transport metrics;
- optional avatar kept behind a renderer interface.

Non-goals:

- no need to keep two production voice architectures;
- no avatar rewrite;
- no real external sales actions.

Acceptance:

- deterministic/mock transport tests remain green;
- at least 20 scripted live conversations complete without state corruption;
- human microphone tests cover interruption, unclear speech, and long turns;
- no unsupported commercial claim is introduced by the speaking layer;
- measured latency/reliability selects the canonical voice route;
- if avatar rendering is enabled, it passes a separate drift/reconnect acceptance rather than deciding voice architecture.

---

## Gate 14 — Durable action plane + real human handoff

**Status:** NOT_STARTED

Purpose:

- make Astra able to create real business value with one safe external action.

Build:

- durable PostgreSQL action proposal/state machine;
- typed `human_handoff` payload containing opportunity/buyer/context summary;
- explicit confirmation;
- atomic `confirmed → executing` transition;
- provider idempotency key;
- `none | committed | unknown` effect semantics;
- sanitized receipt and audit trail;
- one real internal handoff provider only.

Acceptance:

- pending/unconfirmed actions cannot execute;
- process crash/retry cannot silently execute the handoff twice;
- ambiguous provider failure is represented as `unknown`, never guessed;
- cross-prospect/session execution is blocked;
- provider secrets cannot enter client-visible receipts or learning artifacts;
- one approved end-to-end handoff succeeds in a controlled environment.

---

## Gate 15 — Follow-up + scheduling/CRM, one connector at a time

**Status:** NOT_STARTED

Purpose:

- extend the same durable action contract instead of adding ad-hoc integrations.

Build in sequence:

1. follow-up draft/send provider;
2. meeting/scheduling provider;
3. CRM opportunity/note provider.

Each action gets a typed server-owned payload, permission scope, idempotency contract, sanitizer, regression suite, and explicit enablement.

Acceptance:

- each connector passes independently before the next is added;
- no generic arbitrary-tool execution endpoint appears;
- real writes remain policy/permission gated;
- CRM state and Astra state reconcile after retries/restarts.

---

## Gate 16 — Public proof pipeline

**Status:** NOT_STARTED

Purpose:

- let Astra demonstrate its own work without turning marketing copy into an unverified claim.

Build:

- `PublicProof` artifact derived from verified run/outcome evidence;
- PII/secret/customer-name redaction policy;
- metrics and evidence links suitable for internal review;
- LinkedIn/X post draft generation;
- explicit approve/edit/reject flow;
- idempotent publication proposal, but no autonomous posting yet.

Acceptance:

- a proof artifact cannot cite a metric or outcome absent from run evidence;
- sensitive/private prospect data is excluded by tests;
- the generated public draft clearly distinguishes observed result from interpretation;
- approval is required before any external publication.

---

## Gate 17 — SalesOS evaluator + experience retrieval

**Status:** NOT_STARTED

Purpose:

- improve Astra from measured experience before considering model training.

Build:

- deterministic factuality/tool/action validators;
- calibrated human/LLM evaluation workflow;
- durable reward/evaluation records;
- explicit training-eligibility hard gates;
- experience records linking state → strategy → observable outcome;
- retrieval of relevant approved experiences into strategy selection;
- bounded/deduplicated experience growth.

Acceptance:

- evaluator agreement with a human-labeled calibration set is measured;
- unsafe/unfactual outcomes cannot become approved experiences;
- experience retrieval improves frozen SalesBench without increasing hard-gate failures;
- no model weight training is required for the gate.

---

## Gate 18 — Bounded autonomy + authenticated browser capabilities

**Status:** NOT_STARTED

Purpose:

- move selected previously approved actions from human confirmation to explicit policy-controlled autonomy.

Build only for capabilities justified by evidence:

- capability/credential broker;
- profiles/session restoration for approved authenticated systems;
- per-action autonomy policy;
- rate limits and spend/reputation limits;
- E2B/isolation if measurements show authenticated browser work needs it;
- incident/kill-switch path;
- platform-specific compliance/terms constraints.

Acceptance:

- every autonomous capability is individually enabled and revocable;
- credentials never enter model context or ordinary artifacts;
- concurrency/isolation tests prevent cross-tenant/profile leakage;
- external effect state remains durable and auditable;
- autonomy can be disabled without changing conversation logic.

---

## Gate 19 — Controlled real-market pilot

**Status:** NOT_STARTED

Purpose:

- measure whether Astra creates genuine pipeline rather than merely passing simulations.

Build:

- small approved target cohort;
- human-reviewed outreach policy and volume limits;
- opportunity/outcome tracking;
- buyer feedback and human sales review;
- permanent regression capture for every material failure.

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
- human-rep acceptance of Astra handoffs.

Acceptance:

- pilot size and channels are explicitly authorized before launch;
- no success claim relies only on simulated buyers;
- all negative outcomes are retained, not filtered from the report;
- go/no-go thresholds for expanding autonomy are written before results are known.

---

## Gate 20 — Production service + scale

**Status:** NOT_STARTED

Purpose:

- productionize only after the sales loop demonstrates real value.

Build as measured needs justify:

- authenticated multi-tenant API/service;
- worker queue, leases, crash recovery, and concurrency policy;
- distributed artifact/evidence storage;
- production observability and cost accounting;
- credential management;
- channel/telephony scaling;
- isolation/sandbox hardening;
- retention/deletion/privacy controls;
- operator Agent Studio for versioned service claims, ICP, playbooks, proof, and policies.

Acceptance:

- service survives worker/process failure without corrupting opportunity/action truth;
- tenant/auth boundaries pass adversarial tests;
- operational SLOs and cost limits are defined and measured;
- agent/policy versions are traceable to every customer interaction and public proof artifact;
- production rollback/kill-switch procedures are tested.

---

# Rule for changing this plan

Do not rewrite the roadmap casually.

A durable change requires:

- reason;
- evidence;
- update to `DECISIONS.md` if architectural/product intent changes;
- updated acceptance criteria;
- `STATE.md` updated to reflect the new next action;
- active issue updated so a fresh Astra does not follow stale priority.

Small gates are deliberate. Do not combine prospect research, outreach, voice, real actions, public posting, and learning into one implementation wave.
