# Gate 13 agent comparator — blinded review and descriptive reporting hardening

**Date:** 2026-09-24  
**Protocol:** `gate13-agent-comparator-v1`  
**Live-company comparator authorization:** none  
**Real-company comparator attempts consumed:** 0  
**Original Gate 13 human baselines:** unchanged at 0/43

## Why this follow-up exists

PR #108 established a separate, isolated general-purpose browser-agent comparator. The next engineering risk was interpretation rather than browsing: a comparator can produce evidence-backed briefs, but a second model's approval must not silently become “human reviewed,” “source verified,” or an overall Gate 13 verdict. Cost reporting also needed an explicit boundary because Codex token usage is measurable while actual Codex subscription billing is not equivalent to OpenAI API list pricing.

This follow-up freezes those semantics before any live-company comparator result exists.

## Blinded model-review layer

Completed comparator attempts may receive exactly one append-only `gate13-agent-comparator-model-review-v1` review.

Frozen reviewer:
- harness: Codex CLI 0.154.0;
- model: `gpt-5.6-luna`;
- input: brief + supplied evidence only;
- hidden from reviewer: arm identity, generator prompt/identity, timing, cost, token usage, other targets, human baseline, and human-review data;
- tools: forbidden;
- record label: `MODEL_REVIEWED`;
- human review minutes: always `null`.

Review records are bound to:
- the terminal first-attempt ID;
- SHA-256 of the immutable attempt JSON;
- current comparator protocol SHA-256;
- frozen review-prompt SHA-256.

The review answers only whether the brief is supported by the **provided evidence**. It is not independent source-page verification and cannot satisfy the original Gate 13 human-audit requirement.

Real reviewer fixture evidence:
- reviewer model: `gpt-5.6-luna`;
- fixture outcome: PASS;
- sample review classification on the synthetic evidence: `USABLE_WITH_MINOR_EDIT`, `MINOR`;
- reviewer usage: 9,396 input tokens, 304 output tokens, and 92 reasoning-output tokens on the final qualification run;
- no tool execution;
- `humanReviewMinutes = null`.

## Descriptive reporting

`gate13:comparator report` now produces a descriptive-only cohort summary:

- attempted/completed/failed/timed-out/cancelled/blocked counts;
- remaining target IDs;
- pending model-review IDs;
- supported-value and explicit-unknown field counts;
- median terminal/completed elapsed time;
- generator token totals;
- model-review usable-with-minor-edit-or-better count;
- unsupported/partially-supported material finding count.

The report hard-codes `verdict = DESCRIPTIVE_ONLY`. It does not create an acceptance pass/fail threshold.

## Reference-cost accounting

The comparator protocol hash-binds `gate13-agent-comparator-reference-cost-v1`.

Accounting label:
`REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL`

Frozen source-dated reference rates:
- GPT-5.6 Sol generation input: $10/M;
- GPT-5.6 Sol generation output: $30/M;
- GPT-5.6 Luna review input: $0.50/M;
- GPT-5.6 Luna review output: $1.80/M;
- reference browser compute: $0.3328/hour.

The Sol rates reuse Gate 13's conservative long-context/cache-write upper-bound treatment. The Luna rates apply the same logic. This normalized dollar metric is explicitly **not** an actual Codex/API/AWS bill.

Completed-attempt reference cost is not marked complete until the frozen model review also exists and its runner-owned usage is present. Missing usage remains missing rather than becoming zero.

## Frozen identities after this hardening

- protocol SHA-256: `980e3edc1c345583acd8ca3c39ff81be0c0038682729eb816456b59e6b764dae`;
- generator prompt SHA-256: `9ce37ce18eb0bb7d035e96d7c35abb9c327c44066cd425130a3dd4d0af47455f`;
- review prompt SHA-256: `5651042c2f687f40aad698992ea6b0cfc718ba7ee7f912982aebc9434ddf209e`;
- reference-cost plan SHA-256: `6cedb1bf3db403766b5b8638e2c95491730d5283b81045e42aee457841529b4c`;
- source manifest SHA-256: `9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109`.

Mutation-free comparator preflight on those exact files returned:
- `PREPARED_NOT_AUTHORIZED`;
- 43 targets;
- browser readiness `READY`;
- reviewer `gpt-5.6-luna`;
- cost accounting `REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL`;
- comparator authorization `null`;
- original human gate `UNCHANGED`.

## Browser fixture requalification

Chrome for Testing 153.0.8010.52 was reinstalled from the exact Chrome-for-Testing public build after the local binary disappeared. Archive SHA-256:

`6f67faa4b34dd551b53abb6fee24edeae470ab695b0b100ddc4885ff0be6724a`

The requalified real local stack again used:
- Chrome for Testing with mock/basic credential storage;
- system Keychain access forbidden;
- real BrowserSkill 0.3.1;
- connection-bound egress;
- real Codex `gpt-5.6-sol`;
- local HTTP fixture only.

Final requalification PASS:
- elapsed: 73.193 seconds;
- retained evidence: 6;
- visited URLs: one local fixture URL;
- generator usage: 91,438 input / 76,800 cached input / 1,457 output / 98 reasoning-output tokens;
- human baseline/review minutes: `null`;
- review type at generation: `NOT_REVIEWED`.

No real company was opened.

## Qualification

Before merge:
- `pnpm check`: green;
- 218/218 deterministic tests across 43 files;
- project memory: 25 gates / 55 decisions / 38 lessons after this follow-up;
- lint/typecheck/recursive build: green;
- `pnpm audit --prod`: no known vulnerabilities;
- `git diff --check`: green.

## Next transition

The comparator still requires a **new explicit authorization** because this follow-up changes the comparator protocol SHA by freezing reviewer and cost-accounting semantics.

Do not reuse or infer authorization from the older PR #108 protocol hash. Live-company authorization must name the current protocol SHA and the unchanged manifest SHA. Engineering instructions to continue are not measured-cohort authorization.
