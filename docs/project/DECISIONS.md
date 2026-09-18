# Architecture Decision Ledger

This is append-only. Keep entries concise.

## D-001 — Use three foundations as separate layers

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Use:

- Stagehand for initial semantic browser interaction;
- Steel for browser/session/CDP runtime;
- E2B later for sandbox isolation.

Do not merge their source trees.

**Why**

Each project solves a different layer. Keeping boundaries explicit minimizes maintenance and lets us replace each component independently.

**Consequence**

We own adapters and contracts, not upstream internals.

---

## D-002 — Stagehand→Steel before E2B

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Prove Stagehand driving Steel locally over CDP before adding E2B.

**Why**

This splits one difficult three-system integration into two small integrations:

1. semantic agent ↔ browser runtime;
2. browser runtime ↔ isolation runtime.

**Consequence**

E2B is forbidden in early gates unless this decision is deliberately superseded.

---

## D-003 — TypeScript-first

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Initial owned product code is TypeScript-first.

**Why**

Stagehand and Steel fit naturally, E2B has usable JS/TS APIs, and a single language reduces early integration cost.

**Consequence**

Do not modify E2B's Go internals initially.

---

## D-004 — GitHub is persistent project memory

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Project state lives in versioned repository files and test evidence, not in chat memory.

**Why**

Fresh Astra/agents must be able to recover the project without prior conversation context.

**Consequence**

Every gate-completing PR updates `STATE.md` and relevant memory ledgers.

---

## D-005 — Deterministic fixture sites before live-web dependence

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Most development/evaluation uses local deterministic websites.

**Why**

Live websites change, A/B test, rate-limit, block automation, and create false regressions.

**Consequence**

Live-web tests are secondary trend signals, not the primary merge gate.

---

## D-006 — Do not fork upstreams early

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Consume Stagehand as a package, Steel as a service/image, and E2B through its supported runtime/API surface.

**Why**

A fork makes us responsible for an additional product.

**Revisit when**

Measured limitations cannot be solved through adapters, configuration, or upstream contribution.

---

## D-007 — Tests outrank documentation

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Current passing code/tests are the strongest project truth.

**Why**

Docs can become stale.

**Consequence**

A memory entry that claims a feature works without corresponding test evidence is not sufficient to mark a gate complete.


---

## D-008 — Pin browser runtime images by immutable digest

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The Steel runtime used by automated acceptance tests is pinned by OCI image digest in `infra/steel-image.txt`.

**Why**

A moving image tag makes a green test non-reproducible and can introduce upstream changes without a repository diff.

**Consequence**

Upgrading Steel becomes an explicit, testable change: resolve a new digest, run the complete browser acceptance suite, then commit the new digest.

**Current tested digest**

`ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`


---

## D-008 — Pin external runtime images by immutable digest

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Steel is consumed as an external container runtime pinned by OCI digest. The currently verified image is:

`ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`

**Why**

Steel publishes a moving `:latest` image. A moving tag makes browser behavior change without a repository change and makes CI failures impossible to reproduce confidently.

**Consequence**

Runtime upgrades are explicit engineering changes: resolve a new digest, smoke-test it, run the full browser acceptance suite, then update `infra/steel-image.txt`.


---

## D-009 — Pin Stagehand v3.7.3 for direct Steel CDP compatibility

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Use `@browserbasehq/stagehand@3.7.3` for the Stagehand→Steel compatibility layer in Gate 2.

**Why**

V3 explicitly supports attaching to an already-running browser through `localBrowserLaunchOptions.cdpUrl`. Stagehand v4 moved local browser operation to an extension-resident runtime; its default `localBrowser.connect()` path assumes the Stagehand extension is available to the browser process. Our Stagehand SDK runs on the host while Steel's Chromium runs in Docker, so v4 would require extension injection/mounting before we have evidence that complexity is valuable.

**Consequence**

Stagehand is treated as a replaceable compatibility layer. Gate 2 does not adopt v4 extension plumbing.

**Revisit when**

We intentionally build a browser image/runtime that preloads the Stagehand v4 extension, or our own semantic/runtime layer makes Stagehand replaceable entirely.
