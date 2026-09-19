# Test Strategy

The project advances by evidence, not by confidence.

## Evidence lanes

Different tests answer different questions. Do not combine them into one success claim.

### 1. Unit tests

Fast and deterministic.

Use for:

- contracts;
- state transitions;
- schemas;
- adapter behavior with fakes;
- agent-loop decision logic;
- completion/effect semantics;
- cancellation/budget logic;
- event ordering;
- profile merge/version logic;
- redaction/security policy.

Run on every PR.

### 2. Contract tests

Verify owned interfaces independently from providers.

Examples:

- `SteelBrowserRuntime` satisfies `BrowserRuntime`;
- `StagehandAgentRuntime` satisfies `AgentRuntime`;
- sandbox providers satisfy owned sandbox contracts;
- fake providers run the same provider-neutral suites.

Run on every relevant PR.

### 3. Deterministic local integration tests

Use local fixture sites plus pinned runtime infrastructure.

Purpose:

- prove browser lifecycle;
- real CDP connectivity;
- persistence/events/artifacts;
- multi-step orchestration;
- cancellation/cleanup;
- evaluator correctness.

These are the primary release-regression tests.

### 4. Deterministic contract-eval lane

Use scripted/fake agent decisions against versioned local tasks.

Purpose:

- prove the evaluation harness itself;
- isolate engine/evaluator regressions from model variance;
- validate expected state/result checks;
- validate metrics and failure taxonomy.

This lane must be deterministic in CI.

### 5. Model-backed capability-eval lane

Use a real pinned model/configuration against the same deterministic local tasks.

Purpose:

- measure semantic understanding;
- action selection;
- multi-step completion;
- extraction correctness;
- recovery behavior;
- model usage/cost.

Do not substitute a deterministic fixture LLM for capability claims.

A real-model lane does not need to run on every ordinary PR if credentials/cost make that inappropriate, but benchmark gates must record the exact model/configuration and results.

### 6. Sandbox/isolation tests

After deterministic capability qualification, run E2B/Firecracker or another sandbox implementation in suitable controlled/KVM-capable infrastructure.

Required for:

- isolation;
- teardown;
- cancellation;
- network policy;
- concurrency.

### 7. Controlled live-web tests

Small and nightly/manual.

Used for trend detection and external-site behavior, never as the sole release proof.

## Versioned evaluation task format

Grow from 12–15 baseline tasks in Gate 8 to 25–50 qualification tasks by Gate 11.

Each task should define at least:

~~~json
{
  "id": "cart-cheapest-red-item",
  "version": 1,
  "category": "multi-step-cart",
  "startUrl": "http://fixture.local/cart",
  "goal": "Add the cheapest red item to the cart",
  "expected": {
    "type": "dom-state",
    "selector": "#cart-count",
    "value": "1"
  },
  "maxSteps": 8,
  "timeoutMs": 30000
}
~~~

Prefer deterministic evaluators over LLM-as-judge for release criteria.

Possible evaluator sources:

- DOM state;
- URL;
- server-side fixture state;
- cookies/localStorage;
- downloaded file;
- validated structured output.

## Metrics start at Gate 8

Store enough context to reproduce a benchmark:

- task ID/version/category;
- fixture version;
- git commit;
- model/provider/configuration;
- first-attempt success;
- retry-assisted success when retries exist;
- false-completion count;
- failure category;
- step count;
- duration;
- model/token usage when available;
- estimated cost when available;
- action-failure count;
- loop count;
- browser startup latency where relevant;
- artifact completeness.

Do not wait until live-web evaluation to begin collecting these metrics.

## Core vs hard tasks

By Gate 11, classify deterministic tasks as:

- **core** — supported behavior; release blocking;
- **hard** — research/challenge behavior; measured but not required on every merge.

Never move a failing core task to hard merely to make the score look better without an explicit product-scope decision.

## Gate evidence

A gate is `PASSED` only if:

1. required tests/evaluations exist;
2. required deterministic checks pass from the intended clean environment;
3. benchmark/evaluation results are recorded when the gate requires them;
4. results are linked in PR/CI evidence;
5. `STATE.md` reflects the verified result;
6. no known blocker is hidden by retries.

## Reliability rules

- Never fix a flaky test with arbitrary sleep unless elapsed time is the behavior under test.
- Prefer condition/settle-based waits.
- Every product bug should become a regression test when practical.
- Retries may measure reliability but must not hide deterministic failures.
- Record first-attempt success separately from retry-assisted success.
- A schema-valid result is not automatically semantically correct.
- A successful browser action is not automatically a completed user goal.
- Track and treat false completion as a higher-severity reliability failure than an explicit task failure.

## Failure evidence

Browser/agent integration failures should preserve, when available:

- screenshots around relevant actions;
- current URL;
- step/action summary;
- console/browser errors;
- duration;
- run ID;
- sanitized semantic/agent metadata;
- evaluator failure detail;
- no plaintext secret values.

## Minimum quality target before sandbox expansion

Before Gate 12 / E2B:

- Gate 11 core deterministic suite >= 95% first-attempt success over the agreed qualification sample;
- 0 known false-completed runs in that qualification sample;
- Gate 1/2 smoke tests remain 10/10;
- no known browser-session leaks;
- completion verification and structured output validation work;
- failures leave useful artifacts;
- benchmark results are reproducible and versioned.

Live-web tests remain secondary trend signals.
