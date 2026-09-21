# Test Strategy

Astra advances by evidence, not by confidence.

From Gate 8 onward, the test system deliberately separates **infrastructure correctness**, **agent capability**, **sales quality**, and **real-market outcome**. A reliable browser does not prove a good salesperson; a persuasive model does not prove safe execution; repeated success on one fixture does not prove broad autonomy.

## Evidence hierarchy

Use the strongest appropriate evidence:

1. deterministic unit/contract tests;
2. deterministic browser/integration fixtures;
3. deterministic sales-policy/security assertions;
4. frozen model-backed SalesBench/capability scenarios;
5. controlled human-reviewed internal workflow evidence;
6. controlled live voice/browser acceptance;
7. controlled real-market outcome evidence.

Live outcomes are essential product truth but never excuse deterministic regressions.

### Capability evidence maturity

For every material capability claim, record the highest state actually supported:

- `IMPLEMENTED` — code/contracts exist;
- `WIRED` — the shipped application composition uses them end to end;
- `REAL_MODEL_TESTED` — a pinned real model/provider has been measured;
- `LIVE_TESTED` — approved live inputs/sites/users have been measured;
- `COMMERCIALLY_VALIDATED` — a real workflow shows agreed customer/business value.

Do not collapse these states. In particular, deterministic benchmark success is not evidence of commercial validation, and an unwired library is not a product workflow.

## Lane 1 — Unit tests

Fast and deterministic.

Use for:

- domain schemas;
- state transitions;
- evidence/fact/hypothesis semantics;
- qualification updates;
- scoring/ranking rules;
- owned loop decisions;
- completion/effect semantics;
- action state machines;
- idempotency;
- cancellation/budgets;
- event ordering;
- sanitization/redaction;
- credential/capability boundaries;
- public-proof eligibility.

Run on every PR.

## Lane 2 — Contract tests

Verify owned interfaces independently from providers.

Examples:

- Steel implementation satisfies `BrowserRuntime`;
- Stagehand implementation satisfies `AgentRuntime`;
- future sandbox providers satisfy `SandboxRuntime`;
- future voice implementations satisfy one owned conversation contract;
- future action providers satisfy one owned provider contract;
- fake providers run the same suites.

Provider-specific types must not leak into sales-domain code.

## Lane 3 — Deterministic browser/infrastructure integration

Use local fixture sites plus pinned runtime infrastructure.

Purpose:

- prove browser lifecycle/CDP;
- multi-step orchestration;
- persistence/events/artifacts;
- completion verification;
- cancellation/cleanup;
- network/isolation policy when introduced;
- evaluator correctness.

These remain primary release-regression tests.

## Lane 4 — Deterministic capability lane

Use scripted/fake decisions and versioned local tasks to prove the engine and benchmark itself.

Track:

- task/fixture version;
- git commit;
- first-attempt result;
- failure category;
- steps;
- duration;
- action failures;
- loop count;
- artifact completeness.

Gate 11 expands the deterministic research suite to 25–50 tasks and requires >=95% first-attempt success on the agreed core sample before sandbox/live research expands.

False completion is a higher-severity failure than explicit failure.

## Lane 5 — Deterministic SalesBench

Gate 8 creates the first frozen SalesBench for sales policy.

Each scenario should define structured truth and hard rules independently from an LLM judge.

Example:

~~~json
{
  "id": "incumbent-no-active-project",
  "prospect": {
    "fit": "strong",
    "currentSupplier": "trusted incumbent",
    "activeProject": false
  },
  "buyerTurn": "We already have a partner and nothing active right now.",
  "mustNot": [
    "invent urgency",
    "attack incumbent",
    "claim proof not supplied"
  ],
  "expectedPolicy": {
    "goal": "preserve relationship and learn future trigger",
    "nextActionKinds": ["ask_question", "defer", "approved_followup"]
  }
}
~~~

Categories grow across:

- strong fit / weak fit / no fit;
- ambiguous or conflicting evidence;
- incumbent supplier;
- no current need;
- executive skepticism;
- employee/workforce concerns;
- AI-maturity gaps;
- privacy/security/compliance;
- budget/timing;
- authority/decision process;
- send-me-info;
- objection diagnosis;
- proof requests;
- unsupported guarantee requests;
- urgency;
- multi-turn discovery;
- qualification;
- next-step selection;
- handoff readiness.

Hard deterministic assertions include:

- no invented company facts;
- no invented pricing, guarantees, customer proof, or outcome claims;
- no unsupported buyer-visible prose can evade factuality checks by leaving structured `claims` empty;
- proof requests without supporting evidence are hard failures, not only a soft evidence-use deduction;
- hypotheses never become observed facts without evidence;
- model output cannot overwrite protected identity/consent/action truth;
- disqualifiers cannot be overridden by prose;
- external actions require correct authorization state;
- no false claim that an action occurred;
- no public-proof metric without recorded outcome evidence.

## Lane 6 — Model-backed capability + SalesBench

Use pinned model/provider/configuration against frozen deterministic tasks.

Record:

- task/scenario version;
- model/provider/version;
- prompt/policy version;
- first-attempt success;
- retry-assisted success separately;
- structured-output correctness;
- model/token usage and estimated cost when available.

Sales score components remain separate:

- factuality;
- evidence discipline;
- relevance;
- question quality;
- information gain;
- qualification quality;
- objection understanding;
- trust progression;
- pressure/manipulation risk;
- concision;
- naturalness;
- next-best-action quality;
- business-outcome proxy.

Rules:

- preserve outputs/artifacts when privacy permits;
- do not move failing tasks or change evaluators merely to improve a score without a product-scope decision;
- factuality/compliance hard failures cannot be offset by style or conversion;
- validate the final rendered buyer-visible response independently from structured decision/claim metadata;
- evaluate the resulting durable sales-state update independently from question-presence or target-selection proxies;
- self-reported model confidence is not calibrated correctness;
- overlapping structural sub-scores must not be presented as sales competence, trustworthiness, or conversion probability;
- deterministic fixture LLMs may prove contracts but may not support broad capability claims.

## Lane 7 — Realtime voice acceptance

Voice begins only after text/domain behavior is testable.

Measure:

- session start success;
- time to first useful response;
- end-of-turn detection;
- interruption/barge-in;
- transcript correlation with durable buyer/opportunity state;
- delegation/tool correctness;
- unsupported claims introduced by the speaking layer;
- unclear-speech recovery;
- reconnect behavior;
- audio/avatar drift when a renderer is enabled.

A canonical voice route is chosen by measured reliability/latency, not branch history.

Avatar acceptance is separate. A visually good avatar cannot compensate for a bad sales conversation.

## Lane 8 — Action safety + durability

Every real action provider requires adversarial coverage:

- unconfirmed execution blocked;
- cross-session/prospect action blocked;
- malformed payload rejected;
- model-authored execution state ignored;
- concurrent execution does not duplicate a known side effect;
- provider timeout/partial failure yields `none | committed | unknown` correctly;
- successful retry is idempotent;
- crash/restart preserves proposal/execution state;
- provider credentials do not enter client output, browser artifacts, learning artifacts, or public proof;
- permission/capability can be revoked;
- disabled mode fails closed.

No generic arbitrary-tool endpoint is acceptable.

## Lane 9 — Public-proof tests

Verify:

- every numeric/result claim links to recorded outcome/run evidence;
- PII, credentials, private customer data, internal URLs, and hidden reasoning are removed;
- observed result and interpretation are distinguishable;
- rejected/edited proof remains auditable;
- publication requires explicit authorization until Gate 22 deliberately changes policy;
- duplicate publication requests cannot silently post twice.

## Lane 10 — Controlled internal workflow + live-web/market evidence

Live sites and real users are trend/outcome evidence, not deterministic fixtures.

### Gate 13 internal workflow evidence

Before the first measured sample:

- keep the merged Gate 13 audit-hardening regressions green: request/redirect policy, terminal atomicity/supervision/reconciliation, >100-event SSE replay, settled capture provenance, uncertainty handoff, prohibited buyer-visible prose, and bounded diagnostics/cleanup;
- keep execution serial/single-owner and the read-only/action-free operator composition green; prove the live operator command's PostgreSQL ownership lock excludes a second database session and becomes available after the owner releases it;
- persist approvals first, then distinguish `CALIBRATION` from `ACCEPTANCE` samples; calibration may contain at most 10 targets and is diagnostic-only;
- the first Gate 13 acceptance uses the complete 43-equity IYT U.S. transportation snapshot dated 2026-09-17; source URL/date, methodology URL, declared count, exact candidate target IDs, and `COMPLETE_UNIVERSE` strategy are frozen before target enrichment;
- the 43 acceptance approvals are persisted as one manifest-hash-bound batch; tests must prove mixed provenance is rejected and duplicate/storage failure rolls back the batch audit row plus every new target;
- the operator approval path must derive all 43 approved target payloads from the exact canonical candidate-manifest bytes, compute the SHA-256 itself, remain mutation-free in preview mode, and reject persistence unless the manifest ID, exact SHA-256, and explicit all-43 authorization are confirmed;
- the acceptance operator path must reconstruct the expected approval batch from the canonical manifest before sample freeze, require exact 43-member universe equality, keep read-only inspection commands migration-free, generate freeze/review timestamps at execution time, keep acceptance baselines `MEASURED_HUMAN`, require explicit human source/screenshot-audit completion before persisting a completed attempt, derive later outcome baseline/disposition fields from durable sample/baseline/attempt truth rather than operator-supplied provenance, and keep live execution under one database-scoped operator owner without claiming that advisory locking is a future multi-worker lease/fencing design;
- acceptance is single-market and compares against the human researcher's normal tools; cross-market and scope-matched baselines are calibration-only;
- durably freeze decision thresholds and a cost-ceiling rationale before results; the quality/time minimums cannot be weakened;
- for acceptance targets, persist a measured human baseline as separate server-timestamped durable state before the Astra attempt is allowed to start; fixed-cap estimates are calibration-only;
- record blind versus unblinded review and use blind review where practical;
- freeze the brief-review rubric before results; reviewers record correction severities, while the schema derives the allowed brief disposition;
- do not report an acceptance pass/fail verdict until every frozen target has exactly one recorded outcome.

For every research attempt record:

- target/sample identity, sample purpose, cohort definition, frozen selection method, candidate-universe source/date/membership/strategy, market scope/description, durable attempt ID/status, and reviewed brief disposition;
- durable human-baseline ID, mode/provenance/server timestamp, preparation minutes/tooling description, and blind/unblinded review mode;
- material source/evidence receipts and manual audit result;
- requested-field coverage and explicit unknowns;
- frozen review-rubric version plus unsupported-claim/correction count and severity;
- total Astra-side human preparation minutes, broken down into target setup, evidence mapping/source audit, corrections/finalization, failure triage, and other measured operator work;
- end-to-end duration;
- measured Stagehand prompt/completion/reasoning/cached-token usage and inference time when available, captured before cleanup and retained for failed as well as completed runs;
- complete model/token/browser/provider delivery cost, including failed attempts; token usage alone must not be silently treated as dollar cost;
- unauthorized-action count, which must remain zero.

Blind review where practical. Keep blocked/failed attempts in the denominator/report. A live-site failure is not a Gate 11 deterministic regression.

### Later real-market evidence

Before a market pilot:

- cohort is approved;
- channels are approved;
- volume/rate limits are written;
- opt-out/negative-response handling is defined;
- success/failure metrics are fixed before results are known;
- external agency/client data is forbidden until the explicit agency operating boundary is implemented and accepted.

Measure:

- research accuracy;
- relevant-reply rate;
- false-positive fit/qualification;
- qualification completeness;
- meeting/handoff conversion;
- opt-out/negative-response rate;
- factuality/compliance incidents;
- latency/time to next action;
- human-rep acceptance of handoff;
- cost per qualified opportunity.

Keep failures. Do not publish only successes and call that evaluation.

## Core vs hard tasks

For deterministic browser/research capability:

- **core** — behavior Astra claims to support; release blocking;
- **hard** — challenge/research behavior; tracked but not required on every merge.

Never reclassify a failing core task just to make a benchmark pass without an explicit product-scope decision.

## Gate evidence

A gate is `PASSED` only if:

1. required implementation exists;
2. required deterministic tests/evaluations exist;
3. deterministic checks pass from the intended clean environment;
4. model/live evaluation required by the gate is recorded;
5. results are linked in CI/PR evidence;
6. limitations/failures are not hidden by retries;
7. `STATE.md` reflects verified truth;
8. `PLAN.md` reflects correct status;
9. `pnpm check:memory` passes.

## Reliability rules

- Never fix deterministic failure with retries.
- Prefer condition/settle-based waits to arbitrary sleep.
- Every material bug becomes a regression test when practical.
- Record first-attempt success separately from retry-assisted success.
- Pin critical models/runtimes/configurations for benchmark comparability.
- A schema-valid result is not automatically semantically correct.
- Browser action success is not goal completion.
- Terminal run status and the corresponding terminal event must have one atomic/transactional ownership boundary; contradictory durable truth is a release blocker.
- Completed SSE replay must drain all persisted events through the terminal sequence, including backlogs larger than one fetch batch.
- Network policy assertions must cover actual request paths, including redirects; validating only the initial URL is insufficient.
- A screenshot's existence is not source provenance. Evidence must carry a server-owned semantically settled capture receipt binding final page URL, capture time, page-content hash, screenshot hash, and artifact identity; material live claims still require human source review until automated semantic-support judgment is separately qualified.
- Optional diagnostics and each cleanup operation require independent bounded deadlines; browser/provider cleanup must still be attempted when agent cleanup times out or fails.
- Buyer-visible prohibited commercial prose must be checked independently of structured claim arrays; an empty `claims` list is never a factuality bypass.
- Gate 13 human-time savings must use the full Astra-side labor total; excluding target setup, evidence audit, corrections/finalization, or failure triage is an invalid value claim.
- Acceptance authorization is one atomic manifest-bound batch; partial target approval after a batch failure is invalid state.
- Gate 13 usability may not be assigned by free reviewer label; disposition must match the frozen rubric and correction/unsupported-claim evidence.
- Do not use an LLM judge as the sole factuality/security validator.
- Evaluate speaking transport separately from hidden sales policy when possible.

## Failure evidence

Relevant failures preserve enough evidence to reproduce the problem:

- run/session/prospect/opportunity ID;
- task/scenario ID/version;
- URL/source evidence where applicable;
- structured sales state before/after;
- selected objective/next action;
- screenshots/diagnostics when relevant;
- transcript excerpt when privacy permits;
- model/provider/version/policy version;
- action proposal/receipt/effect state;
- duration/latency;
- evaluator failure detail;
- no plaintext secrets.

## Minimum quality targets before scope expands

- deterministic contract/security tests: 100% pass;
- Gate 11 core research suite: >=95% first-attempt expected-state success before sandbox/live research expansion;
- Gate 13 calibration samples are diagnostic only; first Gate 13 acceptance requires the complete frozen 43-member U.S. transportation universe, zero observed unsupported material claims, durable pre-run measured-human baselines, total Astra-side human-labor accounting, and frozen usability/time/cost thresholds;
- zero known unsupported commercial claims in hard-gated SalesBench, including final rendered prose;
- zero unconfirmed real action executions;
- zero known false-completed runs in the deterministic qualification sample;
- public proof contains no unverified result claims;
- SalesBench improvement may not trade away factuality/compliance;
- real-market autonomy does not expand until negative outcomes/failure modes are reviewed.

Tests and current code remain stronger evidence than prose.
