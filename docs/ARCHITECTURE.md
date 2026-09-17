# Architecture

## Decision

Adopt Qwen Audio Agent as the realtime agent runtime **through its public extension boundaries**, not by rewriting its core. The sales system remains vendor-neutral and can be hosted behind Qwen's `BackendPort`.

```text
Browser mic
   -> Qwen Audio Agent Gateway
      -> OpenAI GPT-Live realtime frontend
         -> assistant PCM -> HeyGen LITE audio sink -> LiveAvatar video
      -> delegated hard turn -> SalesBackendAdapter
         -> DOGA strategy selector
         -> deterministic SalesSessionState
         -> product/CRM/pricing tools
         -> OpenAI-compatible reasoner (DeepSeek / GLM / Qwen / OpenAI)
      -> normalized factual result + visual artifact
   -> browser overlays + spoken response
```

## Rules

1. **One visible salesperson.** Specialists never become user-facing personas.
2. **Server owns truth.** Pricing, product facts, CRM state, consent, and deal state never live only in model memory.
3. **Models advise; tools act.** High-consequence writes use explicit confirmation before execution.
4. **No exposed chain-of-thought.** The controller stores structured stage/strategy/decision fields, not private reasoning transcripts.
5. **Vendor-neutral brain.** DeepSeek/GLM/Qwen/OpenAI all plug into the same `decide()` contract.
6. **Qwen upstream-first.** Integrate via Backend Adapter SDK, knowledge/memory providers, custom client and realtime-provider contracts wherever possible.
7. **HeyGen is a renderer.** Avatar transport is isolated from sales policy.

## What is implemented in milestone 1

- deterministic `SalesSessionState`
- DOGA-style turn strategy selection
- deterministic product catalog/recommendation tool
- Qwen-`BackendPort`-shaped `SalesBackendAdapter`
- generic OpenAI-compatible model adapter
- HeyGen audio-sink boundary
- Qwen Gateway composition seam
- zero-key mock demo and tests

## What comes next

1. Install/pin Qwen Audio Agent and run its public backend conformance suite against `SalesBackendAdapter`.
2. Wire the existing Qwen OpenAI realtime frontend to GPT-Live.
3. Port the proven HeyGen LITE media-server sink from `heygen-com/liveavatar-gpt-live-demos`.
4. Convert `product_card` artifact events into browser overlays.
5. Add read-only product/pricing tools, then CRM sandbox reads.
6. Add explicit approval flow for calendar/CRM writes.
