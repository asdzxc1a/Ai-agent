# 2026-09-19 — Gate 12 sandbox + network safety

## Result

Gate 12 passed in PR #64 at verified product head:

`40b36bec89c660c16e06d12800d04ce7ae6265fb`

Base:

`aa10b2e4e06a374f67e2864f57133374b319eb39`

Gate 12 establishes Astra-owned sandbox lifecycle and network-isolation contracts before any controlled live-web research.

## What Gate 12 proves

- provider-neutral `SandboxRuntime` / `SandboxSession` lifecycle;
- `SandboxedBrowserRuntime` composes sandbox controls around any owned browser runtime;
- browser sessions may carry a durable `isolationId`, which RunEngine records without provider knowledge;
- untrusted egress is fail-closed and requires explicit host allowance;
- explicit navigation rejects non-HTTP(S), URL credentials, disallowed ports, unsafe DNS/IP results, mixed public/private answers, and DNS rebinding to unsafe address space;
- loopback, RFC1918, CGNAT, link-local, metadata/reserved, multicast, and non-global IPv6 targets fail closed;
- Stagehand applies its native context-wide domain policy for redirects, popups, and subresources while explicit navigation receives Astra-owned DNS/IP preflight;
- sandbox cleanup is exercised on verified success, failure, timeout/cancellation paths;
- sandboxed agent code receives no filesystem, process, environment, or raw-port capability;
- pinned self-hosted Steel is treated as single-tenant per endpoint;
- concurrent isolated runs use independent pinned Steel endpoints;
- cookie/localStorage separation is proven while both provider instances are alive;
- sequential reuse of one endpoint is clean only after fail-closed browser-state cleanup succeeds;
- independent provider containers isolate filesystem, process visibility, and loopback-only port state;
- frozen ResearchBench v1 remains 30/30 through sandbox composition.

## Failed provider measurements preserved

### Same-endpoint session identity was not isolation

Initial Gate 12 Stagehand run `35462902601` preserved the frozen ResearchBench at 30/30 but failed the new sandbox-isolation checks.

Two assumptions were disproven:

1. a blocked redirect does not necessarily make Stagehand `goto()` reject even when the blocked target is never reached;
2. two session IDs on one pinned self-hosted Steel endpoint could share cookie/localStorage because the service reused one Chrome profile.

The correction did not weaken the network policy or ResearchBench. Astra instead made self-hosted Steel explicitly single-tenant per endpoint, added a second independent pinned Steel provider for simultaneous-isolation acceptance, and changed redirect safety to assert the prohibited sentinel is never contacted.

### OS-isolation process probe self-matched

Stagehand run `35463793571` passed ResearchBench and the browser/network isolation checks but failed the new process-isolation probe.

The probe searched process command lines for its marker while the probe's own command line contained the same marker. That was a harness false positive, not a provider isolation leak.

The test was corrected to establish the marker process inside the primary container, verify it is visible there, exclude the probe itself, and then verify the secondary container cannot observe it.

### Sequential cleanup used the wrong CDP target

Stagehand run `35464172800` showed that sending `Storage.clearDataForOrigin` through Stagehand's root browser connection returned CDP `-32603 Internal error`. Every otherwise-successful sandboxed research run therefore terminated as `CLEANUP_FAILED`.

The cleanup remained fail-closed. The command was moved to Stagehand's supported target-scoped `page.sendCDP(...)` surface while cookie clearing remained on the context API.

## Authoritative evidence

Final product head `40b36bec89c660c16e06d12800d04ce7ae6265fb`:

- CI `35464578737` — PASSED
  - project-memory consistency;
  - lint;
  - strict typecheck;
  - 83/83 tests across 18 files;
  - all workspace builds.
- Steel integration `35464578746` — PASSED
  - pinned Steel startup;
  - ten-session raw Steel lifecycle regression;
  - screenshot artifacts;
  - cleanup.
- Stagehand Steel integration `35464578747` — PASSED
  - ResearchBench v1: 30/30;
  - core: 20/20;
  - hard: 10/10;
  - zero false completions;
  - zero unsupported claims;
  - trusted-fixture/private-network/redirect safety: passed;
  - concurrent and sequential cookie/localStorage isolation: passed;
  - provider-container filesystem/process/loopback-port isolation: passed;
  - real Steel cancellation/release acceptance: passed;
  - legacy ten-session Stagehand→Steel regression: passed;
  - HTTP API browser acceptance: passed;
  - PostgreSQL repository acceptance: passed;
  - replayable SSE acceptance: passed;
  - durable API restart acceptance: passed;
  - cleanup: passed.

Selected final-run timings:

- sandbox network/private-target test: 4.309s;
- browser-state isolation test: 8.660s;
- filesystem/process/loopback-port isolation: 0.980s;
- real cancellation/release: 1.559s;
- legacy ten-session Stagehand→Steel: 18.257s;
- HTTP API browser acceptance: 3.00s;
- PostgreSQL acceptance: 303ms;
- replayable SSE: 975ms;
- durable API restart: 3.13s.

Local final validation used Node 24.21.0 / pnpm 10.34.5 and passed `pnpm check` with 83/83 tests across 18 files.

## Acceptance interpretation

Gate 12 proves the owned sandbox/network contract and the measured deployment rule for the current pinned self-hosted Steel provider. It does not claim that one shared Steel endpoint is multi-tenant safe, and it does not claim a production E2B/cloud sandbox deployment.

A future sandbox provider may replace the current arrangement only behind the owned `SandboxRuntime` boundary and only after passing the same lifecycle, egress, private-network, state-isolation, and cleanup tests.

## Boundary preserved

Gate 12 did not perform live prospect research, authenticated contact discovery, outreach, voice/avatar, CRM/calendar/social writes, or any new irreversible external side effect.

Next gate: Gate 13 — Evidence-backed live prospect research (issue #65).
