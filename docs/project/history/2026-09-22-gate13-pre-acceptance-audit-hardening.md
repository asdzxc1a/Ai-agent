# 2026-09-22 — Gate 13 pre-acceptance audit hardening

## Scope

Deep pre-acceptance audit and implementation hardening after independently cloning and executing the repository at main `86c41ffedba9d58a9959cb4ba3c7dbeb159f2e7d`.

No real-company approval, sample freeze, measured baseline, live prospect research, outreach, or external side effect was performed.

## Reproduced findings

The audit reproduced, rather than only inferred:

- a never-resolving screenshot could outlive `maxDurationMs`, leaving the run `RUNNING` and preventing cleanup;
- the documented `pnpm gate13:operator -- <command>` form passed `--` through as the command under pinned pnpm 10.34.5;
- application DNS/IP validation returned no connection-bound address, leaving a DNS time-of-check/time-of-use gap;
- self-hosted Steel endpoint exclusivity remains process-local and is not a future multi-worker lease/fencing mechanism;
- the generic HTTP run/artifact API has no authentication/tenant ownership and remains an internal foundation surface;
- the pinned Stagehand transitive tree contained `undici@5.29.0` with production audit findings.

## Implemented hardening

PR #103:

- bounds page-evidence/screenshot/run-summary artifact work and propagates run cancellation into Steel screenshot fetch;
- adds a regression where a never-resolving screenshot terminates as typed `RUN_TIMEOUT` with agent/browser cleanup;
- accepts the documented leading pnpm `--` separator;
- adds provider-neutral `BrowserSessionOptions.networkProxyUrl`;
- adds an Astra-owned connection-bound HTTP/CONNECT egress proxy;
- makes the owned network policy return the exact validated target/address set and has the proxy dial a validated literal address for untrusted public destinations;
- keeps Stagehand request interception as a second policy layer;
- forces the sandbox-owned proxy route into Steel session creation;
- freezes `ASTRA_CONNECTION_BOUND_PROXY_V1` plus the browser-visible proxy host in `gate13-execution-profile-v2`;
- routes pinned Stagehand/Steel sandbox/research acceptance through the new proxy composition;
- scopes a pnpm override to `@ai-sdk/provider-utils>undici=6.28.0`;
- pins GitHub Actions to immutable commit SHAs;
- aligns main-push Stagehand/Steel integration path coverage with PR coverage.

Authentication/tenancy and durable multi-worker Steel leases remain explicit later production boundaries rather than Gate 13 scope creep.

## Evidence

Authoritative code head before this documentation promotion: `5e283e485386c2a70132a24d9edaa629b50ca8ef`.

- CI PR run `35755221613` — **PASSED**
  - project-memory consistency;
  - lint;
  - strict typecheck;
  - 31/31 test files, 191/191 tests;
  - all workspace builds after adding the explicit Gate 13 sandbox-runtime package dependency.
- CI push run `35755216851` — **PASSED**.
- Steel integration `35755221687` — **PASSED**
  - pinned Steel startup;
  - ten-session raw Steel lifecycle;
  - screenshots/diagnostics;
  - cleanup.
- Stagehand Steel integration `35755221646` — **PASSED**
  - pinned Steel + PostgreSQL startup;
  - Stagehand→Steel acceptance through the sandbox composition;
  - HTTP API browser acceptance;
  - PostgreSQL repository acceptance;
  - replayable SSE;
  - durable API restart;
  - cleanup.

An earlier CI run on `1d589ab1...` intentionally remains red: tests/typecheck were green, but the recursive build exposed that `@astra/gate13-operator` imported `@astra/sandbox-runtime` without declaring it. The package/lockfile dependency was then fixed rather than hiding the build failure.

## Remaining boundary

Gate 13 remains **IN_PROGRESS**. The complete 43-company acceptance cohort has not been authorized or executed. API authentication/tenant isolation and durable multi-worker browser ownership are required before later internet-facing/agency scale, but are not prerequisites for the current serial, internal, read-only Gate 13 experiment.
