# Gate 8 — Sales domain contract + SalesBench baseline

**Date:** 2026-09-19  
**PR:** #52  
**Accepted code head:** `7c8e4f2ea5c9b3f412c25b0fe2ae0a8951299e29`

This is cold evidence for Gate 8. Fresh contributors should normally read STATE.md and the current gate instead.

## What Gate 8 established

Gate 8 created two owned provider-neutral packages:

- `@astra/sales-domain` — service truth, sales-domain schemas, AI-native transformation ontology, and deterministic consultative baseline policy.
- `@astra/sales-bench` — frozen deterministic sales scenarios, hard policy/security evaluation, score vector, benchmark reporting, and a pinned-model lane contract.

The service boundary explicitly allows only approved company/workforce-transformation claims and records pricing, guarantees, customer proof, certifications, timelines, and other undefined commercial details as non-claims/unknowns.

Public proof cannot be marked published without explicit authorization and PII sanitization.

## Frozen SalesBench V1

Scenario count: **36**  
Scenario categories: **13**  
Fingerprint:

`58a809b67eb92e396b3feab365bcabbe528a410b52b028384f4849345e89a163`

The committed deterministic report is:

`benchmarks/salesbench/baseline-0.json`

Baseline 0:

- hard-gate pass: **36/36**
- hard-gate failures: **0**
- policy matches: **31/36**
- policy-match rate: **86.11111111111112%**
- mean overall score: **0.9675925925925927**
- factuality: **1.0**
- evidence use: **1.0**
- relevance: **0.8888888888888888**
- question quality: **0.9444444444444444**
- information gain: **0.9583333333333334**
- qualification quality: **0.9444444444444444**
- trust: **1.0**
- pressure safety: **1.0**
- next-step quality: **0.9722222222222222**

## Benchmark-design correction

The first pre-freeze run scored 36/36 and 1.0. That was treated as benchmark leakage, not product success.

The baseline policy was left unchanged. Five scenario expectations were revised independently from the product charter before the benchmark fingerprint was frozen. The corrected baseline was then generated once and committed. This reusable lesson is recorded as L-020.

## Deterministic policy/security guarantees tested

The evaluator rejects or hard-fails:

- unapproved claim IDs;
- unknown evidence references;
- external actions without authorization;
- false qualification of a no-fit prospect;
- pressure when no current need exists;
- trusted-incumbent displacement pressure;
- prohibited pricing/guarantee/customer-proof/certification/headcount-reduction claim text;
- model-authored protected state that does not belong in SalesDecision.

The pinned-model benchmark lane requires an exact model + revision; moving aliases such as `latest`, `default`, `auto`, or `stable` are rejected.

No paid/external model benchmark was run in Gate 8 because provider credential use was not explicitly authorized. Gate 8 therefore makes no model-backed sales-quality claim.

## Acceptance evidence

### Normal CI — run 35452660433

Passed:

- project-memory consistency;
- lint;
- strict TypeScript;
- **34/34 unit tests across 9 files**;
- all workspace builds, including `@astra/sales-domain` and `@astra/sales-bench`.

### Raw Steel — run 35452660148

Passed:

- pinned Steel startup;
- 10 consecutive deterministic browser lifecycle sessions;
- screenshot/diagnostic regression;
- cleanup.

The 2-test Steel integration file completed in 19.79s. The ten-session lifecycle test took 17.650s.

Screenshot artifact:

- ID: `10587865497`
- size: 130722 bytes
- SHA-256: `a9cf1f0afa4efebee124e784390320396bd5d75f6c2e4f49fad6bf037e3a3f13`

### Combined Stagehand / PostgreSQL — run 35452660180

Passed:

- Stagehand→Steel semantic regression: 10 sessions, 18.181s test time;
- real HTTP API browser acceptance: 2.291s;
- PostgreSQL repository acceptance;
- replayable SSE: 642ms;
- durable API restart: 2.125s;
- cleanup.

## Gate conclusion

Gate 8 proves a bounded sales-domain truth layer and a reproducible deterministic SalesBench baseline. It does **not** prove live sales conversion, model-backed sales quality, autonomous outreach, voice, CRM execution, or multi-step prospect research.

Those remain future gates.
