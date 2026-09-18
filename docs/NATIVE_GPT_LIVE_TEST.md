# Native GPT-Live + DeepSeek test

This is the pre-HeyGen validation path for Arcana SalesOS.

## Architecture

```text
Browser microphone
  <-> OpenAI GPT-Live (`gpt-live-1`) over WebRTC
       -> client delegation
       -> SalesOS / DOGA / server-owned state and truth
       -> DeepSeek (`deepseek-flash`) hidden sales reasoner
       -> canonicalized SalesOS guidance
       -> `session.commentary.append`
       -> GPT-Live spoken response
       -> browser speakers
```

HeyGen is intentionally not involved in this mode. The legacy Qwen + HeyGen bridge remains in the repository for later avatar rendering.

## Only two secrets are required

Set these on the Render service:

- `OPENAI_API_KEY` — must have access/billing for `gpt-live-1`.
- `SALES_REASONER_API_KEY` — the DeepSeek API key.

Everything else is already configured in `render.yaml` and the deployed service:

- `SALES_VOICE_MODE=native-gpt-live`
- `GPT_LIVE_MODEL=gpt-live-1`
- `GPT_LIVE_VOICE=marin`
- `SALES_REASONER_MODE=deepseek`
- `SALES_REASONER_BASE_URL=https://api.deepseek.com`
- `SALES_REASONER_MODEL=deepseek-flash`
- Arcana/Dubai concierge business context
- Arcana event-service catalog
- external action execution disabled by default

## Safety / behavior boundary

GPT-Live owns conversational timing, audio, acknowledgements, and natural phrasing. Commercial decisions are delegated to SalesOS. DeepSeek does not talk directly to the buyer.

SalesOS remains the authority for state, DOGA strategy, product/service truth, approved evidence, action proposals, and learning trajectories. The live voice is instructed not to invent venue availability, access, named clients, pricing, deadlines, guarantees, or supplier facts.

## Test procedure

1. Add the two secrets in Render.
2. Let Render restart the service.
3. Open the deployed Arcana SalesOS URL.
4. `/health` should report `voiceMode: native-gpt-live`, `liveReady: true`, and `reasonerMode: deepseek`.
5. Click **Start live call** and allow microphone access.
6. Test normal discovery, objections, interruptions, unsupported factual requests, and backoff behavior.
7. Inspect the right-hand SalesOS panel for state/delegation/evidence updates.

Do not enable production action execution or connect HeyGen until the native voice + sales-brain loop passes the frozen sales scenarios and factuality checks.
