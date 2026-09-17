# Realtime Sales Avatar Foundation

Milestone 1 of a realtime AI salesperson built around **Qwen Audio Agent + OpenAI GPT-Live + HeyGen LiveAvatar LITE**, with a vendor-neutral sales brain.

This repository intentionally starts with the **sales core and integration boundaries** rather than hard-coding API providers. It runs without API keys today.

## Run

```bash
npm test
npm run demo
```

## Implemented

- server-owned sales/deal state
- DOGA-style dynamic turn strategy
- deterministic product catalog and recommendation
- Qwen `BackendPort`-shaped backend adapter
- OpenAI-compatible reasoner adapter for DeepSeek / GLM / Qwen / OpenAI endpoints
- normalized backend activity/artifact events
- HeyGen audio-renderer boundary
- Qwen Gateway integration seam

## Why this shape

Qwen Audio Agent already provides the realtime gateway, task lifecycle and backend extension contract. HeyGen's GPT-Live reference already proves the difficult audio-to-avatar bridge. This project owns the part neither should own: **sales policy, commercial truth, tools, deal state, and evaluation**.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).
