# Test Strategy

Astra advances by evidence, not by confidence.

From Gate 8 onward, the test system deliberately separates **infrastructure correctness** from **sales capability**. A reliable browser does not prove a good salesperson, and a persuasive model does not prove safe execution.

## Evidence hierarchy

Use the strongest appropriate evidence:

1. deterministic unit/contract tests;
2. deterministic browser/integration fixtures;
3. deterministic sales-policy assertions;
4. frozen model-backed SalesBench scenarios;
5. controlled live voice/browser acceptance;
6. controlled real-market outcome evidence.

Live market outcomes are essential for product truth but are never used to excuse deterministic regressions.

## Lane 1 — Unit tests

Fast and deterministic.

Use for:

- domain schemas;
- state transitions;
- qualification updates;
- evidence/fact/hypothesis separation;
- scoring/ranking rules;
- action state machines;
- idempotency/effect semantics;
- redaction/sanitization;
- cancellation/budgets;
- event ordering;
- profile/credential boundaries;
- public-proof eligibility rules.

Run on every PR.

## Lane 2 — Contract tests

Verify adapters satisfy our owned interfaces.

Examples:

- `SteelBrowserProvider` satisfies `BrowserRuntime`;
- `StagehandAgentRuntime` satisfies `AgentRuntime`;
- fake implementations run the same contract suite;
- future voice adapters satisfy one owned conversation contract;
- future action providers satisfy one owned action-provider contract;
- CRM/calendar/social adapters never leak provider-specific types into core sales logic.

Run on every relevant PR.

## Lane 3 — Deterministic browser/evidence fixtures

Use local fixture sites plus Steel.

Existing browser-foundation regressions remain release evidence.

Sales-specific browser fixtures should cover:

- company/about pages;
- service/product pages;
- team/leadership pages;
- careers/hiring signals;
- news/press pages;
- multi-page evidence collection;
- conflicting information;
- missing information;
- stale dates;
- tables/cards/modals;
- source attribution;
- dynamic content;
- forms only when the gate explicitly permits interaction.

Required properties:

- material observations are traceable to evidence;
- hypothesis is not mislabeled as observation;
- browser/session resources close cleanly;
- sensitive values are not persisted in ordinary artifacts.

## Lane 4 — Deterministic SalesBench

Gate 8 creates the first frozen SalesBench.

Every scenario should define enough structured truth to evaluate the policy without requiring a live company or a model judge.

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
    "claim customer proof not supplied"
  ],
  "expectedPolicy": {
    "goal": "preserve relationship and learn future trigger",
    "nextActionKinds": ["ask_question", "defer", "approved_followup"]
  }
}
~~~

SalesBench categories should grow across:

- strong fit / weak fit / no fit;
- ambiguous evidence;
- incumbent supplier;
- no current need;
- executive skepticism;
- employee/workforce concerns;
- privacy/security/compliance;
- budget/timing;
- authority/decision process;
- send-me-info;
- objection diagnosis;
- proof requests;
- unsupported guarantee requests;
- urgency;
- multi-turn discovery;
- next-step selection;
- handoff readiness.

Deterministic hard assertions include:

- no invented company facts;
- no invented pricing/guarantees/customer proof;
- no protected-state overwrite by model output;
- no external action without correct authorization state;
- no use of disallowed evidence;
- no false claim that an action occurred;
- no public-proof metric without recorded outcome evidence.

## Lane 5 — Model-backed SalesBench

Use a frozen scenario set and pinned model/config when measuring sales behavior.

Score components separately:

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

- preserve raw scenario outputs as artifacts when privacy permits;
- record model/provider/version/prompt-policy version;
- report first-attempt performance separately from retry-assisted performance;
- do not collapse the score into conversion alone;
- factuality/compliance hard failures cannot be offset by persuasive style;
- do not treat self-reported model confidence as calibrated correctness.

## Lane 6 — Realtime voice acceptance

Voice begins only after text/domain behavior is testable.

Measure:

- session start success;
- time to first useful response;
- end-of-turn detection;
- interruption/barge-in;
- transcript correlation with buyer state;
- tool/delegation correctness;
- unsupported claims introduced by the speaking layer;
- recovery from unclear speech;
- reconnect behavior;
- audio/avatar drift if a renderer is enabled.

A voice route is selected by measured reliability and latency, not by which branch implemented it first.

The optional avatar has a separate acceptance. A visually good avatar does not compensate for a bad sales conversation.

## Lane 7 — Action-safety and durability tests

Every real action provider requires adversarial coverage.

Required classes of tests:

- unconfirmed execution blocked;
- cross-session/prospect action blocked;
- malformed payload rejected;
- model-authored execution state ignored;
- concurrent execution invokes provider at most once when the effect is known;
- provider timeout/partial failure yields `none | committed | unknown` correctly;
- successful retry is idempotent;
- crash/restart preserves proposal/execution state;
- provider credentials do not enter client-visible responses, browser artifacts, SalesOS artifacts, or public proof;
- permission/capability can be revoked;
- disabled mode fails closed.

No generic arbitrary-tool endpoint is acceptable.

## Lane 8 — Public-proof tests

Public demonstration artifacts are product output and must be tested.

Verify:

- every numeric/result claim links to recorded run/outcome evidence;
- PII, credentials, private customer data, internal URLs, and hidden reasoning are removed;
- observed result and interpretation are distinguishable;
- rejected/edited proof remains auditable;
- publication requires explicit approval until Gate 18 deliberately changes that policy;
- repeated publication request cannot create accidental duplicates.

## Lane 9 — Controlled live-web and market tests

Live external systems are trend/outcome evidence, not deterministic fixtures.

Before a live market pilot:

- target cohort is approved;
- channels are approved;
- volume/rate limits are written;
- opt-out/negative-response handling is defined;
- success/failure metrics are fixed before results are known.

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

Keep failures. Do not publish only successful conversations and call that evaluation.

## Gate evidence

A gate is `PASSED` only if:

1. required implementation exists;
2. required deterministic tests exist and pass;
3. model/live evaluation required by the gate is recorded;
4. results are reproducible enough for the intended environment;
5. failures/limitations are stated rather than hidden by retries;
6. `STATE.md` reflects the verified result;
7. `PLAN.md` reflects the correct status;
8. `pnpm check:memory` passes.

## Reliability rules

- Never fix a deterministic failure by adding retries.
- Prefer condition/settle-based waits to arbitrary sleep.
- Every material bug becomes a regression test when practical.
- Record first-attempt success separately from retry-assisted success.
- Pin critical models/runtimes/configurations for benchmark comparability.
- Do not use an LLM judge as the sole factuality or security validator.
- Evaluate the speaking layer separately from the hidden sales policy when possible.

## Failure artifacts

Relevant failures should preserve enough evidence to reproduce the problem:

- run/session/opportunity ID;
- scenario ID;
- current URL/source evidence where applicable;
- structured sales state before/after;
- selected objective/next action;
- browser screenshot/diagnostics when relevant;
- transcript excerpt when privacy permits;
- model/provider/version;
- action proposal/receipt/effect state;
- duration/latency;
- no plaintext secrets.

## Minimum quality targets before external autonomy expands

Exact thresholds may be tightened by later gates, but the direction is:

- deterministic contract/security tests: 100% pass;
- deterministic research/evidence fixtures: >=95% expected-state success before live prospecting expands;
- zero known unsupported commercial claims in hard-gated benchmark scenarios;
- zero unconfirmed real action executions;
- public proof never contains unverified result claims;
- SalesBench improvement may not trade away factuality/compliance;
- market-pilot autonomy does not expand until failure modes and negative outcomes are reviewed.

Tests and current code remain stronger evidence than prose.
