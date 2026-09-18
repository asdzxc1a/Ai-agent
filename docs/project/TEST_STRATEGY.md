# Test Strategy

The project advances by evidence, not by confidence.

## Test pyramid

### 1. Unit tests

Fast, deterministic.

Use for:

- contracts;
- state transitions;
- schemas;
- adapters with fakes;
- cancellation/budget logic;
- event ordering;
- profile merge/version logic.

Run on every PR.

### 2. Contract tests

Verify our adapters satisfy our own interfaces.

Examples:

- `SteelBrowserProvider` satisfies `BrowserRuntime`;
- `StagehandAgentRuntime` satisfies `AgentRuntime`;
- fake providers run the same contract suite.

Run on every PR.

### 3. Local browser integration tests

Use local deterministic fixture sites plus Steel.

Required before E2B.

Run on every relevant PR.

### 4. Sandbox/isolation tests

Use E2B/Firecracker only after Gate 8.

Required for:

- isolation;
- teardown;
- cancellation;
- concurrency.

Run on self-hosted/KVM-capable CI or controlled infrastructure, not assumed to work on generic hosted CI.

### 5. Live-web tests

Small and nightly.

Used for trend detection, never as the sole proof a feature works.

## Required fixture suite

Grow gradually toward 25–50 tasks.

Each fixture must define:

```json
{
  "id": "cart-cheapest-red-item",
  "goal": "Add the cheapest red item to the cart",
  "expected": {
    "cartCount": 1,
    "product": "Red Widget"
  },
  "maxSteps": 8,
  "timeoutMs": 30000
}
```

A fixture should expose one or a few specific browser difficulties.

## Gate evidence

A gate is `PASSED` only if:

1. required tests exist;
2. tests pass from a clean checkout/environment;
3. results are recorded in PR/CI;
4. `STATE.md` points to the evidence;
5. no known blocker is hidden by retries.

## Reliability rules

- Never fix a flaky test by adding arbitrary sleep unless the behavior being tested truly requires elapsed time.
- Prefer condition/settle based waits.
- Every bug should become a regression test when practical.
- Retries may measure reliability but must not hide deterministic failures.
- Record first-attempt success separately from retry-assisted success once metrics exist.

## Failure artifacts

Browser integration failures should eventually preserve:

- screenshot before/after relevant action;
- current URL;
- step/action summary;
- console/browser error;
- duration;
- run ID;
- relevant semantic/agent output;
- no plaintext secret values.

## Minimum quality targets before expanding scope

Before Gate 9 / E2B:

- deterministic fixture suite >= 95%;
- Gate 1 and Gate 2 smoke tests 10/10;
- no known browser session leaks;
- structured output validation works;
- failures leave useful artifacts.

## Metrics later

Track:

- fixture completion rate;
- structured-answer accuracy;
- first-attempt success;
- retry-assisted success;
- median/P95 steps;
- median/P95 duration;
- browser startup latency;
- browser crash rate;
- agent loop rate;
- profile restore success;
- cost/successful task.
