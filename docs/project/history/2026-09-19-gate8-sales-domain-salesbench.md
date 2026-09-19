# 2026-09-19 — Gate 8 sales domain + SalesBench baseline

## Purpose

Gate 8 defines the smallest owned commercial truth and evaluation layer Astra needs before multi-step prospect research, live outreach, voice, or external sales actions.

The gate intentionally does **not** prove that Astra is already a good market salesperson. It creates the contracts and frozen benchmark required to measure improvement honestly.

## Implemented

### `@astra/sales-domain`

Runtime-validated contracts now exist for:

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

Truth classes are explicit:

- `observed_fact`;
- `inferred_hypothesis`;
- `approved_claim`;
- `unknown`.

The evidence validators enforce that:

- approved claim IDs cannot carry modified claim text;
- observed decision claims must match referenced observed evidence;
- hypotheses cannot use unknown evidence as support;
- public proof claims require evidence references.

The first service-offer boundary is deliberately conservative. It defines workflow assessment, agent/workflow design, implementation support, and evaluation/reliability as approved capabilities, while leaving pricing, quantified ROI, named customer proof, guaranteed outcomes, and standard timelines unknown unless later operator-approved evidence is added.

### AI-native transformation ontology V1

The ontology groups:

- company context;
- operating model;
- AI maturity;
- workforce;
- opportunity;
- risk/trust constraints;
- truth classes.

This is a domain vocabulary, not a claim that every dimension is already automatically extracted.

### Consultative baseline policy V0

The baseline policy:

- treats no current need as a valid defer outcome;
- respects incumbent suppliers;
- asks one qualification question at a time;
- treats security/workforce/AI skepticism as discovery inputs;
- refuses to invent pricing;
- requires approval for human handoff;
- reads `Opportunity.activeSignals` as the single signal source;
- shares only traceable observed/approved evidence.

It is intentionally simple and frozen as Baseline 0 rather than presented as the target sales policy.

### `@astra/sales-bench`

SalesBench V1 contains 40 versioned deterministic scenarios covering:

- qualification;
- fit/no-fit;
- timing/no-current-need;
- incumbent supplier;
- evidence/proof requests;
- security/trust;
- workforce concern;
- AI skepticism;
- budget/timeline/decision process;
- unsupported guarantees/pricing/named-customer proof;
- next-step readiness;
- anti-repetition of already-known qualification facts.

The runner supports:

- deterministic candidates;
- provider-neutral pinned model candidates;
- structured hard failures;
- separate score components;
- reproducible candidate/model/policy metadata.

No paid external model call was made in this gate. The model-backed lane is implemented and contract-tested, but this evidence does not claim a real hosted-model benchmark.

## Baseline 0

Candidate:

`consultative-baseline-v0`

Final deterministic Baseline 0 from CI run `35452463916`:

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

Frozen failed scenarios:

1. `known-budget-budget-question`
2. `known-decision-process-repeated-signal`
3. `known-security-but-security-signal`
4. `known-workflow-pain-existing-supplier`
5. `named-customer-proof-unknown`
6. `proof-request-without-evidence`
7. `send-info-without-evidence`
8. `weak-fit-ready-next-step`

These failures are part of Baseline 0. Later policies should improve against the frozen benchmark rather than rewriting the scenarios to remove the failures.

## Important review findings during implementation

### Single source of truth for signals

The first implementation duplicated buyer signals in both policy input and `Opportunity.activeSignals`.

That was removed. Opportunity state is the authoritative signal source.

### Claim-ID smuggling

The first evidence validator checked that an approved claim ID existed but did not require the statement to match the approved text.

The validator now requires exact approved text for the claim ID.

### Observed-fact traceability

A decision could initially cite a valid evidence ID while changing the alleged observed statement.

Observed claims now have to match referenced observed evidence.

### Evaluator negation false-positive

The first forbidden-string fixture could interpret safety guidance such as "do not offer discounts" as if a discount had been offered.

The fixture now checks concrete prohibited claims/phrases rather than the mere mention of a prohibited concept in a warning.

### Anti-repetition fixture integrity

Three first-pass benchmark descriptions said budget/workflow/decision facts were already known while the fixture data still marked them unknown.

Those fixtures were corrected before Baseline 0 was frozen.

## Verification

Final product-code head before memory promotion:

`47e0020e6130f7ea243daaf42bff6974d5cf21d3`

Required evidence:

- CI run `35452463916` — PASSED
  - frozen install;
  - `pnpm check:memory`;
  - lint;
  - strict typecheck;
  - **36/36 tests across 10 test files**;
  - all workspace builds.
- Steel integration `35452463895` — PASSED
  - pinned Steel startup;
  - ten-session Steel acceptance 10/10;
  - cleanup.
- Stagehand Steel integration `35452463890` — PASSED
  - Stagehand → Steel 10/10;
  - HTTP API browser acceptance;
  - PostgreSQL repository acceptance;
  - replayable SSE;
  - durable API restart;
  - cleanup.

## What Gate 8 does not prove

Gate 8 does not prove:

- reliable multi-step autonomous research;
- real prospect accuracy on arbitrary public websites;
- real model sales quality;
- live voice quality;
- outreach effectiveness;
- real external action safety;
- market conversion.

Those remain later gates.

## Next gate

Gate 9 — Owned multi-step sales-agent loop.

Active issue: #53.
