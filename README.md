# Realtime Sales Avatar

A realtime AI salesperson built around **Qwen Audio Agent + OpenAI GPT-Live + HeyGen LiveAvatar LITE**, with a vendor-neutral sales brain, server-owned deal state, and a framework-neutral SalesOS learning harness.

The architecture deliberately separates five concerns:

1. **Qwen Audio Agent** — realtime session, task lifecycle, voice/tool orchestration.
2. **GPT-Live** — natural full-duplex conversation and interruption.
3. **HeyGen LiveAvatar LITE** — visual/audio rendering only.
4. **Sales backend** — DOGA-style strategy, commercial truth, deal state, and tools.
5. **SalesOS harness** — structured trajectories, rewards, experience memory, evaluation/export, and eventually training data for our own model.

## What is implemented

- deterministic server-owned `SalesSessionState`
- high-confidence buyer fact extraction before model reasoning
- DOGA-style per-turn sales strategy
- deterministic demo product catalog/recommendation
- Qwen `BackendPort` adapter that passes Qwen's public conformance suite
- real composition inside Qwen `GatewayApplication`
- session-preserving custom Qwen `backendRuntime`, so separate visitor sessions cannot collapse into one owner-scoped deal state
- real Qwen Gateway WebSocket task-path regression test
- OpenAI-compatible hidden supervisor adapter for DeepSeek / GLM / Qwen / OpenAI-compatible endpoints
- canonical model-decision boundary that blocks model-authored consent/IDs and rebuilds product facts/pricing from structured catalog truth
- sales-specific `spawn_thinking` routing scope for pricing, recommendation, objections, qualification, comparisons, ROI, and commercial facts
- consultative realtime salesperson profile
- LiveAvatar LITE session mint/start/stop client
- resilient HeyGen media-server socket with readiness gating, keep-alive, reconnect, PCM forwarding, and interruption
- server-side Qwen → HeyGen bridge with playback receipts
- bridge metrics proving audio, transcripts, tool calls, sales-backend delegation, and visual artifacts
- Qwen-standard sales visual artifact contract
- browser sales visual rendering with HTML escaping and canonical pricing/comparison/product truth
- local session/control API
- server-owned `ActionProposal` lifecycle with explicit human confirmation before execution
- fail-closed `SALES_ACTION_EXECUTION_MODE=disabled|sandbox` runtime; default is `disabled`
- modular local-only sandbox action providers with sanitized receipts and no external network side effects
- at-most-once action execution with idempotent replay after successful execution and cross-session isolation
- browser buyer-approval UI that keeps `confirmed` visually distinct from `executed`
- local browser test console with LiveKit video, text input, 24 kHz mic streaming, interruption, transcripts, sales visuals, action controls, and runtime metrics
- guarded paid smoke test that refuses to spend credits unless explicitly confirmed
- append-only `salesos.event.v1` trajectory capture from backend decisions and selected realtime events
- multi-component `salesos.reward.v1` with factuality/compliance hard gates before a trajectory becomes training-eligible
- explicit `salesos.experience.v1` experience bank for reusable state → strategy → outcome records
- portable per-session `salesos.learning-bundle.v1` export for future CustomerLM, counterfactual, replay, and RL workers
- raw PCM and hidden chain-of-thought are excluded from the SalesOS learning stream

## Requirements

- Node.js `>=22.22.2`
- npm 10+

Install:

```bash
npm install
cp .env.example .env
```

## Free development

No OpenAI or HeyGen key is needed for the deterministic sales core/tests:

```bash
npm test
npm run demo
```

Run the full free foundation gate, including the adversarial action-security suite:

```bash
npm run verify:foundation
```

Focused gates are also available:

```bash
npm run smoke:offline
npm run test:security
```

`smoke:offline` exercises:

- the real Qwen Gateway WebSocket `task.create` path
- visitor-session propagation into the sales backend
- standard sales artifact delivery
- protection against model-authored pricing/consent/identity changes
- browser visual rendering and escaping

The Qwen source dependency and LiveKit browser SDK are pinned so upstream changes cannot silently change the test environment.

## Permissioned action execution

The model may propose a canonical `next_step`, but it cannot confirm or execute it. The server creates an opaque action proposal and owns the lifecycle:

```text
pending -> confirmed -> executing -> executed
   \-> cancelled          \-> failed
```

Execution is controlled by:

```dotenv
SALES_ACTION_EXECUTION_MODE=disabled
# or, for local fake providers only:
SALES_ACTION_EXECUTION_MODE=sandbox
```

`disabled` is the default and exposes no executor. `sandbox` registers only local fake handlers for the allowlisted action kinds; they do not call email, calendar, CRM, payments, the filesystem, or external networks.

The control API exposes server-owned proposal state and mutations:

```text
GET  /sessions/:id/actions
POST /sessions/:id/actions/:proposalId/confirm
POST /sessions/:id/actions/:proposalId/cancel
POST /sessions/:id/actions/:proposalId/execute
```

Execution fails closed unless the proposal belongs to the same sales session and is explicitly confirmed. Successful retries return the stored executed result rather than repeating the provider call. SalesOS receives an independently sanitized lifecycle audit: only allowlisted receipt metadata and a generic failure marker enter the learning bundle.

## SalesOS learning layer

SalesOS observes the realtime salesperson rather than becoming a second salesperson. The same harness receives structured policy decisions from `SalesBackendAdapter` and observable realtime events from `QwenHeyGenBridge`.

For a live avatar session, the control API can expose the accumulated learning bundle and attach offline evaluation:

```text
GET  /sessions/:id/learning
POST /sessions/:id/reward
POST /sessions/:id/experience
```

The reward API keeps factuality and compliance as hard gates. A high conversion score cannot make an unsafe or unsupported trajectory eligible for training.

Training frameworks do **not** run on the live hot path. AReaL/GRPO, CustomerLM simulation, counterfactual branching, SPEAR-style replay, RLSTA-style mining, or another trainer should consume exported learning bundles later.

See [docs/SALES_OS.md](docs/SALES_OS.md).

## Prepare a live test

Add these to `.env`:

```dotenv
QWEN_AUDIO_REALTIME_PROVIDER=gpt-live
OPENAI_API_KEY=...
LIVEAVATAR_API_KEY=...
QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH=./config/sales-assistant.md

# Keep the hidden supervisor free/deterministic for the first transport test.
SALES_REASONER_MODE=mock
```

An explicit `LIVEAVATAR_AVATAR_ID` is optional; the client can use an active public avatar for the first test.

Run the no-cost preflight:

```bash
npm run preflight:live
```

## One paid smoke test

The command below creates one LiveAvatar session and uses OpenAI Realtime. It is intentionally locked against accidental execution.

```bash
LIVE_SMOKE_CONFIRM=YES npm run smoke:live
```

The smoke test uses ephemeral local ports, sends one sales prompt, and only passes when it observes:

- a final assistant transcript
- 24 kHz assistant audio being forwarded to HeyGen
- a real Qwen `spawn_thinking` call into the sales backend

It then stops the LiveAvatar session and local servers automatically.

## Human browser test

Start the local services:

```bash
npm run gateway
```

Open:

```text
http://127.0.0.1:8788
```

The test console can:

- start/stop a LiveAvatar LITE session
- display the avatar through LiveKit
- send text into the same GPT-Live voice conversation
- stream microphone PCM16 mono at 24 kHz
- interrupt the avatar mid-response
- show whether `spawn_thinking` actually delegated to the sales backend
- show final buyer/salesperson transcripts and audio-chunk metrics
- render structured sales recommendation artifacts next to the avatar
- show pending action proposals with explicit Confirm/Cancel controls
- show confirmed actions as **not executed yet**, and show executed/failed only from server state
- expose Execute Sandbox only when the server advertises `SALES_ACTION_EXECUTION_MODE=sandbox`

This console is a validation harness, not the final sales product UI.

## Model strategy

For the first real voice/avatar test, keep `SALES_REASONER_MODE=mock` so failures can only come from the transport/orchestration layer. After that passes, switch the hidden supervisor to an OpenAI-compatible model:

```dotenv
SALES_REASONER_MODE=openai-compatible
SALES_REASONER_BASE_URL=...
SALES_REASONER_API_KEY=...
SALES_REASONER_MODEL=...
```

DeepSeek/GLM/Qwen can all live behind this same adapter; model selection does not change the realtime architecture.

The hidden model is advisory. Its output is canonicalized before use: protected identifiers/consent are excluded, explicit buyer facts win over model guesses, and product/comparison/pricing content is rebuilt from structured product truth before reaching the UI.

## Why this shape

Qwen Audio Agent already solves realtime Gateway/session/tool infrastructure. HeyGen's official GPT-Live demo already proved the difficult LiveAvatar media-server pattern. We reuse both and keep our proprietary work where it matters: **sales policy, commercial truth, product tools, deal state, trajectories, evaluation, experience memory, and eventually our own sales-tuned model**.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SALES_OS.md](docs/SALES_OS.md), and [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).
