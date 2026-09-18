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


---

## D-010 — Supersede D-009 with Stagehand 3.7.0 + scoped peer exception

**Date:** 2026-09-18  
**Status:** Accepted; supersedes D-009

**Decision**

Use `@browserbasehq/stagehand@3.7.0` inside `@astra/agent-stagehand`, with `zod@4.4.3`.

Keep pnpm strict peer validation enabled globally. Allow exactly this optional-peer mismatch:

```yaml
peerDependencyRules:
  allowedVersions:
    "openai@4.104.0>zod": "4.4.3"
```

**Why**

Stagehand 3.7.0 is the latest published v3 release before 3.7.3's supporting-dependency refresh and retains the direct existing-browser `cdpUrl` path we need. Stagehand itself declares Zod 3 or Zod 4 support. Its Ollama adapter requires Zod 4, while OpenAI 4.104.0 declares Zod 3 as an optional peer. OpenAI's package metadata confirms that peer is optional, and our Gate 2 runtime uses a custom `LLMClient`, not OpenAI's Zod helper APIs.

**Consequence**

The exception is intentionally narrow and auditable. Any Stagehand/OpenAI/Zod upgrade must remove or re-justify it; broad peer-check disabling remains forbidden.

**Revisit when**

Stagehand v4 is intentionally integrated through a browser image that contains its extension, or a later compatible Stagehand/provider set removes the peer conflict.


---

## D-011 — Own runtime contracts; providers are adapters

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The application boundary is now:

```text
BrowserRuntime → BrowserSession
AgentRuntime   → AgentSession
```

Steel implements `BrowserRuntime`. Stagehand implements `AgentRuntime`. The agent runtime receives our `BrowserSession`, not a Steel response object or provider-specific session type.

**Why**

Future browser provisioning (including E2B) must be replaceable without changing agent logic or product API code. Likewise, Stagehand must be replaceable without changing browser provisioning.

**Consequences**

- Steel types stay inside `@astra/browser-steel`.
- Stagehand types stay inside `@astra/agent-stagehand`.
- product/application code depends on `@astra/browser-runtime` and `@astra/agent-runtime`.
- provider-neutral test fakes exist for both contracts.
- current Stagehand extraction still requires Zod internally, but that implementation detail is checked inside the adapter rather than exposed as the runtime contract.

**Evidence**

PR #27: CI `35381977883`, Steel `35381977729`, Stagehand semantic integration `35381977879`; all passed. The 10-session semantic test ran entirely through owned runtime interfaces.


---

## D-012 — Gate 4 API is asynchronous and intentionally in-memory

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

The first product API exposes:

- `POST /v1/runs` → HTTP 202 + run ID;
- `GET /v1/runs/:id` → current run snapshot.

Execution continues asynchronously in the API process. Gate 4 stores run state in memory only.

**Why**

This proves the external contract and runtime orchestration without mixing HTTP design with database/queue engineering. Durability, recovery, steps, and events are the explicit purpose of Gate 5.

**Consequences**

- API process restart loses Gate 4 runs by design.
- no claim of production durability is made yet.
- Gate 5 must preserve the Gate 4 route/response behavior while moving authoritative state to PostgreSQL.

---

## D-013 — Public structured output starts as a small explicit schema subset

**Date:** 2026-09-18  
**Status:** Accepted

**Decision**

Gate 4 supports an object-root output schema with string/number/boolean properties, optional `const`, optional `required`, and optional `additionalProperties: false`.

Unsupported schemas return typed HTTP 400 `UNSUPPORTED_OUTPUT_SCHEMA`.

**Why**

A small truthful contract is safer than claiming full JSON Schema while only partially implementing it. The current Stagehand adapter requires a concrete runtime schema, so the API compiles the supported public subset internally.

**Consequences**

- the public API contract is provider-neutral;
- Zod remains an API/runtime implementation detail;
- future schema expansion is explicit and testable;
- unsupported constructs fail fast instead of being silently ignored.
