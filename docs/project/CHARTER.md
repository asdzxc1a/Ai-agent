# Project Charter

## Why this project exists

Build a production-quality web-agent platform with the useful behavior of TinyFish while using clean-room architecture and permissively licensed foundations.

The product should eventually accept:

- a URL,
- a natural-language goal,
- an optional structured output schema,

then operate an isolated browser reliably and return verified structured output with enough evidence and artifacts to debug failures.

## Product principle

The product is **not** "an LLM plus Playwright."

It is a layered system:

```text
API / SDK
   ↓
Durable Run Engine
   ↓
Agent Runtime
   ↓
Semantic Browser Layer
   ↓
Browser Session Runtime
   ↓
Isolation/Sandbox Layer
   ↓
Live Web
```

Longer-term layers include profiles, credentials, research, monitoring, search/fetch primitives, observability, evaluation, and a specialized action model.

## Initial foundation

### Stagehand

Role: semantic browser interaction.

Use initially for:

- observe;
- act;
- extract;
- model-facing page interaction;
- structured browser tasks.

Treat Stagehand as replaceable behind our own `AgentRuntime`.

### Steel Browser

Role: browser service.

Use initially for:

- Chromium lifecycle;
- CDP WebSocket;
- browser sessions;
- screenshots/logging;
- profiles/proxy capabilities when needed.

Treat Steel as replaceable behind our own `BrowserRuntime`.

### E2B Runtime

Role: sandbox/isolation layer.

Add only after local Steel + Stagehand integration passes.

Use later for:

- one isolated sandbox per browser workload;
- Firecracker isolation;
- lifecycle/placement;
- teardown;
- production-like resource isolation.

Treat E2B as infrastructure, never as agent logic.

## Core abstractions

The product owns provider-neutral boundaries for browser sessions, agent sessions, durable run orchestration, run storage, and artifacts.

The canonical executable contracts live in code, not in this charter:

- `packages/browser-runtime/src/index.ts`;
- `packages/agent-runtime/src/index.ts`;
- `packages/run-engine/src/`;
- `packages/artifact-store/src/`.

Architecturally:

~~~text
HTTP/API
  ↓
RunEngine
  ├ RunRepository
  ├ ArtifactStore
  ├ BrowserRuntime → BrowserSession
  └ AgentRuntime   → AgentSession
~~~

Provider-specific types must remain inside their adapters. The charter describes responsibilities and direction; exact TypeScript signatures are intentionally not duplicated here because code/tests are the stronger source of truth.

## Initial repository shape

```text
apps/
  api/
  dashboard/

packages/
  contracts/
  run-engine/
  browser-runtime/
  browser-steel/
  sandbox-e2b/
  agent-stagehand/
  artifacts/
  evals/

test-sites/
  simple-button/
  login/
  forms/
  pagination/
  infinite-scroll/
  iframe/
  shadow-dom/
  dynamic-list/

infra/
  local/
  e2b/
```

This structure is directional. Do not create folders before they are needed.

## Non-goals for the first reliable vertical slice

Do not build yet:

- our own Chromium fork;
- our own Mako-like model;
- Search;
- Fetch;
- Research;
- Monitor;
- production Vault integrations;
- proxy reputation intelligence;
- billing;
- organizations;
- MCP;
- Python SDK;
- multi-region orchestration.

## Long-term differentiation

Our moat should become:

1. our semantic page representation;
2. our action model;
3. reliability/recovery;
4. evidence-backed output verification;
5. domain intelligence;
6. trajectory/evaluation data;
7. browser/runtime improvements justified by measurement.

## Success definition

The first meaningful product milestone is:

> One API call can reliably operate one isolated browser and return verified structured JSON, with a replayable run history and enough artifacts to understand any failure.

Everything else grows around that.
