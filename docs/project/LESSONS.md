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

## L-007 — Configure runtime environments centrally, not per fixture

**Date:** 2026-09-18

**Symptom**

ESLint rejected the Node-based fixture server because `process` and `console` were not defined for generic `.mjs` files.

**Cause**

The lint configuration treated repository JavaScript as environment-neutral even though utility/fixture scripts intentionally run under Node.js.

**Fix**

Define Node script globals centrally in `eslint.config.js` for repository `.js`/`.mjs` files.

**Prevention**

When a runtime is an architectural choice, encode it once in tooling rather than adding inline lint exceptions to each script.

---

## L-008 — Installed type packages do not imply compiler inclusion under strict TypeScript

**Date:** 2026-09-18

**Symptom**

TypeScript could not resolve `process`, `node:fs/promises`, `node:path`, `fetch`, or `Response` even after `@types/node` was installed.

**Cause**

The strict TS configuration did not explicitly include Node types.

**Fix**

Add `"types": ["node"]` to the shared TypeScript compiler options.

**Prevention**

Treat runtime typings as an explicit compiler contract. Do not rely on automatic ambient-type discovery.

---

## L-009 — Validate external infrastructure before writing integration logic

**Date:** 2026-09-18

**Symptom**

A moving container tag could make browser tests non-reproducible or fail for reasons unrelated to our code.

**Cause**

Upstream Steel publishes its Docker workflow primarily through the moving `:latest` tag.

**Fix**

Resolve the image once, boot/health-check it, and pin the resulting immutable digest before writing the browser acceptance test.

**Prevention**

For critical external runtime images, pin by digest and record the tested digest in repository state.


---

## L-007 — Runtime-aware lint and type environments must be explicit

**Date:** 2026-09-18

**Symptom**

The first Gate 1 quality run failed because the Node fixture script was linted without Node globals, and TypeScript code using Node APIs needed the Node type environment explicitly enabled.

**Cause**

The repository-level lint/type configuration assumed TypeScript library code and did not yet describe executable Node scripts.

**Fix**

Declare Node globals for repository `.js/.mjs` scripts and set `types: ["node"]` in the shared TypeScript config with a Node-24-compatible `@types/node` pin.

**Prevention**

Whenever a new runtime class is introduced (Node script, browser, worker, edge runtime), encode that runtime explicitly in lint/type configuration rather than disabling safety rules.
