# Gate 13 independent agent comparator v1 — implementation and preflight

**Date:** 2026-09-23  
**Protocol:** `gate13-agent-comparator-v1`  
**Authorization:** not granted  
**Frozen companies browsed:** none  
**Original Gate 13 state mutated:** no

## Purpose

Build a separate agent-vs-agent research experiment without impersonating or replacing the measured-human comparator required by `gate13-measured-research-v7`.

The comparator asks whether Astra's workflow outperforms an independent general-purpose browser research agent. It does not claim to measure human research time.

## Frozen comparator configuration

- purpose: `AGENT_COMPARISON`;
- comparator: `GENERAL_PURPOSE_BROWSER_AGENT`;
- measurement: `MEASURED_AGENT`;
- human baseline: `NOT_MEASURED`;
- human review: `NOT_PERFORMED`;
- source manifest SHA-256: `9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109`;
- target count: 43;
- interaction: `BROWSER_UI_AND_RENDERED_TEXT`;
- BrowserSkill CLI/daemon/extension: 0.3.1 / 0.3.1 / 0.3.1, protocol 1.3, daemon WebSocket port 52800;
- Chrome for Testing: 153.0.8010.52;
- dedicated browser label: `astra-agent-comparator`;
- browser isolation: `DEDICATED_UNSIGNED_IN_PROFILE`;
- credential store: `MOCK_KEYCHAIN`;
- system Keychain access: `FORBIDDEN`;
- enforcement: `CONNECTION_BOUND_PROXY_AND_GUARDED_BSK`;
- Codex CLI: 0.154.0;
- model: `gpt-5.6-sol`;
- serial execution, fresh context per target, zero replacement retries;
- wall-clock budget: 20 minutes;
- official approved company domains only for final evidence;
- public search domain may be used only for discovery.

## Isolation

`@astra/agent-comparator` owns separate file-backed authorization, reservation, attempt, and recovery state.

`@astra/gate13-agent-comparator` has no dependency on:

- `@astra/prospect-postgres`;
- `@astra/prospect-research`;
- `@astra/run-postgres`.

The comparator source contains no `GATE13_DATABASE_URL`, original frozen acceptance sample ID, or human-baseline mutation command. Human baseline/review durations are schema-required `null`.

## Browser execution boundary

A clean Chrome for Testing 153.0.8010.52 profile was created separately from the user's normal Chrome profile. The BrowserSkill 0.3.1 extension was loaded there, connected locally, labeled `astra-agent-comparator`, and human-help requests were disabled.

The first Chrome for Testing setup exposed a macOS `Chromium Safe Storage` Keychain prompt. That credential path is now explicitly forbidden. Measured/fixture launches use `--use-mock-keychain`, `--password-store=basic`, disabled sync/password-manager service features, and the frozen protocol records `credentialStore = MOCK_KEYCHAIN` plus `systemKeychainAccess = FORBIDDEN`. No Keychain password or approval is part of the comparator.

Real BrowserSkill + real Codex local-fixture acceptance then proved:

- exact dedicated browser binding;
- runner-launched Chrome for Testing behind the connection-bound proxy;
- BrowserSkill session creation;
- local fixture navigation;
- rendered-text observation;
- screenshot capture;
- session stop;
- `request_help = disabled`;
- system-Keychain-independent browser startup.

No real company was opened during this validation.

For measured comparator execution, the runner refuses a pre-existing dedicated profile process and launches the clean profile itself behind Astra's connection-bound egress proxy. Allowed network destinations are the current target's approved official domain(s) plus frozen search-discovery domains; only the BrowserSkill daemon loopback WebSocket is bypassed from the proxy.

## Agent execution boundary

The Codex worker receives a fresh run directory and a generated `bsk` client as its only intended browser command surface. That client writes requests into a run-local file broker. The broker lives in the trusted runner process, validates every BrowserSkill argument against the frozen read-only policy, and only then invokes the real BrowserSkill CLI with the real BrowserSkill home outside the agent sandbox.

The broker allows only:

- exact labeled BrowserSkill session start;
- allowed-domain navigation;
- rendered observation/snapshot;
- bounded scrolling/reload/wait;
- run-local screenshots;
- exact session stop.

It rejects click/fill/press/select/upload/download/evaluate/help and other side-effect or arbitrary BrowserSkill commands.

The Codex subprocess gets an isolated HOME/TMPDIR, a narrowed PATH, host skill discovery disabled, unrelated Codex app/browser/computer features disabled, and no original Gate 13 database environment. Codex shell-event auditing rejects non-BrowserSkill shell commands, broker traces reject denied BrowserSkill invocations, and agent output is validated again for official-domain evidence plus runner-derived field/evidence mapping. A forbidden shell/browser command makes that first comparator attempt fail; it is never silently replaced.

## Fixture evidence

Deterministic tests cover:

- separate authorization requirement;
- duplicate first-attempt rejection;
- restart/interruption recovery as terminal failure;
- timeout of a worker that ignores cancellation;
- official-domain evidence enforcement;
- dedicated BrowserSkill label/version readiness;
- blocked side-effect commands;
- frozen protocol/manifest binding;
- original Gate 13 storage isolation.

A real Codex `gpt-5.6-sol` run was first exercised against a fake BrowserSkill fixture, then the full local stack was exercised with the real BrowserSkill daemon/extension plus a local HTTP fixture behind the connection-bound proxy. The integrated run used only:

1. `bsk session start --browser astra-agent-comparator --json`;
2. `bsk navigate http://127.0.0.1:<fixture-port>/about --session <id>`;
3. `bsk observe --session <id>`;
4. `bsk screenshot --session <id> --out <run-local-path>`;
5. `bsk session stop <id>`.

The final integrated fixture completed in 76.636 seconds with eight retained evidence items, one local visited URL, human measurements `null`, review type `NOT_REVIEWED`, and runner-owned Codex JSONL usage of 73,638 input tokens (57,216 cached), 1,873 output tokens, and 138 reasoning-output tokens. The browser was launched with the frozen mock-keychain flags, so no macOS Keychain password/approval was required. The stricter shell-event audit also rejects chained commands such as `bsk ...; cat ...`, so a successful attempt cannot hide arbitrary shell work behind an allowed BrowserSkill prefix. No real company was opened and no non-BrowserSkill shell command passed the audit.

## Pre-PR #108 preflight

With the dedicated BrowserSkill profile connected, comparator preflight returned:

- status: `PREPARED_NOT_AUTHORIZED`;
- protocol SHA-256: `d2fa146c5d63363683af0c26e4ad4bd455724df7da4359023624ae7ed31a69fa`;
- prompt SHA-256: `9ce37ce18eb0bb7d035e96d7c35abb9c327c44066cd425130a3dd4d0af47455f`;
- manifest SHA-256: `9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109`;
- 43 targets;
- original human gate: `UNCHANGED`;
- comparator authorization: null.

No comparator reservation or measured live-company attempt has been created. Repository qualification is green at `213/213` deterministic tests across 41 files, `25 gates / 52 decisions / 35 lessons`, zero lint/typecheck/build failures, and `pnpm audit --prod` reports no known vulnerabilities.

## Next transition at that time

Merge the comparator implementation after CI. A live comparator cohort requires separate explicit authorization bound to the exact comparator protocol SHA and manifest SHA. Do not treat general instructions to continue engineering as that measured-cohort authorization.

> **2026-09-24 continuation:** PR #108 subsequently merged, and the comparator protocol was intentionally extended before live authorization with frozen blinded-model-review and reference-cost semantics. The old protocol SHA above is historical and is superseded by `docs/project/history/2026-09-24-gate13-agent-comparator-review-reporting.md`. No live-company comparator attempt occurred under the old hash.
