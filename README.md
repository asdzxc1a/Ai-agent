# Realtime Sales Avatar

A realtime AI salesperson built around **Qwen Audio Agent + OpenAI GPT-Live + HeyGen LiveAvatar LITE**, with a vendor-neutral sales brain and server-owned deal state.

The architecture deliberately separates four concerns:

1. **Qwen Audio Agent** — realtime session, task lifecycle, voice/tool orchestration.
2. **GPT-Live** — natural full-duplex conversation and interruption.
3. **HeyGen LiveAvatar LITE** — visual/audio rendering only.
4. **Sales backend** — DOGA-style strategy, commercial truth, deal state, tools, and eventually our fine-tuned model.

## What is implemented

- deterministic server-owned `SalesSessionState`
- high-confidence buyer fact extraction before model reasoning
- DOGA-style per-turn sales strategy
- deterministic demo product catalog/recommendation
- Qwen `BackendPort` adapter that passes Qwen's public conformance suite
- real composition inside Qwen `GatewayApplication`
- OpenAI-compatible hidden supervisor adapter for DeepSeek / GLM / Qwen / OpenAI-compatible endpoints
- sales-specific `spawn_thinking` routing scope for pricing, recommendation, objections, qualification, comparisons, ROI, and commercial facts
- consultative realtime salesperson profile
- LiveAvatar LITE session mint/start/stop client
- resilient HeyGen media-server socket with readiness gating, keep-alive, reconnect, PCM forwarding, and interruption
- server-side Qwen → HeyGen bridge with playback receipts
- bridge metrics proving audio, transcripts, tool calls, and sales-backend delegation
- local session/control API
- local browser test console with LiveKit video, text input, 24 kHz mic streaming, interruption, transcripts, and runtime metrics
- guarded paid smoke test that refuses to spend credits unless explicitly confirmed

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

The Qwen source dependency is pinned to one exact commit so upstream `main` cannot change underneath us.

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

## Why this shape

Qwen Audio Agent already solves realtime Gateway/session/tool infrastructure. HeyGen's official GPT-Live demo already proved the difficult LiveAvatar media-server pattern. We reuse both and keep our proprietary work where it matters: **sales policy, commercial truth, product tools, deal state, evaluation, and eventually our own sales-tuned model**.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).
