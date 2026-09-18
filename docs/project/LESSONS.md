# Lessons / Mistakes Ledger

Append only. Record reusable lessons, not ordinary progress.

Format:

- **Symptom**
- **Cause**
- **Fix**
- **Prevention**

## L-001 — Do not integrate all three foundations at once

**Date:** 2026-09-18

**Symptom**

The project appears to require understanding Stagehand, Steel, E2B, Firecracker, CDP, agent orchestration, and production infrastructure before anything works.

**Cause**

Thinking in terms of "combine three repositories" instead of "connect three layers through contracts."

**Fix**

First prove Stagehand→Steel locally. Add E2B only after that path is stable.

**Prevention**

The plan uses hard gates; E2B begins at Gate 9.

---

## L-002 — Do not fork upstream code without evidence

**Date:** 2026-09-18

**Symptom**

Maintenance scope explodes and upstream fixes become hard to absorb.

**Cause**

Treating source availability as a reason to own the source.

**Fix**

Use packages/services/APIs behind our adapters.

**Prevention**

Fork only after a measured blocker is documented in `DECISIONS.md`.

---

## L-003 — Live websites are poor primary tests

**Date:** 2026-09-18

**Symptom**

A test fails for reasons unrelated to our code: layout changes, geolocation, consent UI, rate limits, A/B tests.

**Cause**

Using production websites as deterministic test fixtures.

**Fix**

Build local websites for browser behaviors and keep a small separate live-web nightly suite.

**Prevention**

No gate depends only on a third-party live site.

---

## L-004 — Project memory can become a second broken product

**Date:** 2026-09-18

**Symptom**

Fresh agents spend more time reading stale docs than understanding the current implementation.

**Cause**

Duplicating state across many files and keeping full session diaries.

**Fix**

One small mutable `STATE.md`; plan for future work; append-only decisions/lessons; tests as evidence.

**Prevention**

Do not duplicate facts. Keep current state concise.


---

## L-005 — Prefer ecosystem-compatible package-manager versions over newest-major novelty

**Date:** 2026-09-18

**Symptom**

pnpm 12 generated a multi-document `pnpm-lock.yaml`. The workspace itself installed successfully, but GitHub/Dependabot ecosystem tooling has active compatibility problems with that lockfile shape and can misread the dependency graph.

**Cause**

Choosing the newest package-manager major based only on package availability rather than checking the surrounding CI/security-tool ecosystem.

**Fix**

Pin pnpm `10.34.5` for Gate 0. It produces the conventional single-document lockfile while retaining modern pnpm behavior.

**Prevention**

When changing foundational tooling, evaluate compatibility with GitHub dependency graph, Dependabot/security scanners, lockfile consumers, and CI—not just local install success.

---

## L-006 — Keep peer dependencies strict and explicit

**Date:** 2026-09-18

**Symptom**

The pnpm 10 bootstrap failed because Vitest 5 requires Vite as a peer dependency and Vite was not declared explicitly.

**Cause**

The first bootstrap happened under a toolchain that auto-installed the peer transitively, hiding the undeclared dependency.

**Fix**

Keep `strict-peer-dependencies=true`, keep `auto-install-peers=false`, and declare `vite@8.3.0` directly.

**Prevention**

Treat strict peer-dependency failures as useful contract checks. Do not silence them globally to make CI green.


---

## L-007 — Service health is not browser readiness

**Date:** 2026-09-18

**Symptom**

The first Gate 1 Steel integration saw `/v1/health` return success, then immediately resetting sessions collided with Steel's still-running default browser launch and crashed the process with Chromium lock / target-close errors.

**Cause**

The readiness probe only proved Steel's HTTP service was alive. It did not prove the underlying Chromium page and browser instrumentation were initialized.

**Fix**

Make `SteelClient.waitUntilReady()` require:

1. healthy `/v1/health`;
2. an active Steel session;
3. successful `/v1/sessions/:id/live-details`;
4. at least one real browser page.

Remove destructive startup cleanup.

**Prevention**

Define readiness at the deepest dependency required by the workload. Never equate process/API liveness with resource readiness.

---

## L-008 — Prefer compatible browser reuse over unnecessary relaunches

**Date:** 2026-09-18

**Symptom**

After browser-level readiness was fixed, creating a session still crashed Steel. The session request overrode timezone/fingerprint settings and omitted Steel's default desktop device config, so Steel considered it incompatible with the initialized browser and tore that browser down to relaunch it.

**Cause**

Our smoke test changed browser configuration even though Gate 1 only needed a default desktop session.

**Fix**

Request `deviceConfig: { device: "desktop" }` and otherwise keep the session compatible with Steel's initialized default configuration. Steel then uses its browser-reuse path instead of performing an unnecessary relaunch.

**Prevention**

For integration smoke tests, request the minimum configuration required by the behavior under test. Treat browser relaunches as meaningful lifecycle events, not incidental implementation details.
