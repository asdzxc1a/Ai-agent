# Build gates

## Gate A — Qwen runtime
- Add `qwen-audio-agent` dependency pinned to a known stable release.
- Wrap `SalesBackendAdapter` using `createBackendAgentHost()`.
- Run Qwen's `verifyBackendAdapterConformance()` suite.
- Pass: lifecycle, task isolation, cancellation, subscription cleanup.

## Gate B — realtime voice
- Configure Qwen's OpenAI realtime provider for GPT-Live.
- Validate transcript, barge-in, delegation, task completion and resumed speech without HeyGen.
- Measure p50/p95 turn latency.

## Gate C — HeyGen renderer
- Port only session/media transport from HeyGen's GPT-Live demo.
- Feed assistant PCM to LITE media-server websocket.
- Pass: 20 conversations with no audio drift; interruptions clear buffered avatar audio.

## Gate D — sales visuals
Implement first six artifact types:
`product_card`, `comparison`, `pricing`, `case_study`, `roi`, `next_step`.
Browser owns layout; backend owns data.

## Gate E — real brain
Start with an OpenAI-compatible endpoint for DeepSeek V4.1 Flash. Keep model selection in env/config. Add GLM/Qwen only as drop-in alternatives, not architecture forks.

## Gate F — real product truth
Replace demo catalog with database/API. Pricing and availability must come from structured tools, never RAG.

## Gate G — CRM sandbox
Read contact/account/opportunity state. Write actions require user confirmation and sandbox first.
