# Architecture

## Decision

Use Qwen Audio Agent as the realtime orchestration runtime through its public extension boundaries. GPT-Live owns the full-duplex voice frontend, HeyGen LiveAvatar LITE is a renderer, and the server owns commercial truth, action state, and external side effects.

```text
Browser mic / text
   -> Qwen Audio Agent or native GPT-Live session
      -> GPT-Live voice frontend
      -> delegated sales turn -> SalesBackendAdapter
         -> deterministic SalesSessionState
         -> DOGA strategy
         -> product / pricing / case-study / ROI truth
         -> vendor-neutral hidden reasoner
         -> canonical visual / next_step
      -> server creates ActionProposal
         -> pending
         -> explicit human confirm or cancel
         -> SalesActionExecutor
         -> allowlisted registered provider
         -> sanitized receipt
      -> HeyGen LiveAvatar LITE renders assistant audio/video
   -> browser overlays, approval controls, transcripts and metrics
```

## Authority boundaries

1. **One visible salesperson.** Hidden specialists never become user-facing personas.
2. **Server owns truth.** Pricing, product facts, identity, consent, deal state and transaction state are not model memory.
3. **Models advise; tools act.** A model can propose a `next_step`; it cannot confirm, execute, pick an arbitrary tool, or invent a success receipt.
4. **Human confirmation is explicit.** Execution requires a server-owned proposal in `confirmed` state.
5. **Execution fails closed.** `SALES_ACTION_EXECUTION_MODE` defaults to `disabled`; unknown modes fail rather than falling back.
6. **Sandbox means local-only.** Sandbox providers make no email, CRM, calendar, payment, filesystem or external network calls.
7. **Session isolation is end-to-end.** A buyer cannot confirm or execute another buyer's proposal.
8. **At-most-once side effects.** The store transitions to `executing` before awaiting a provider; successful retries return the stored result.
9. **Audit is independently sanitized.** SalesOS allowlists receipt metadata and stores a generic action failure marker, not raw provider payloads or exception text.
10. **No hidden chain-of-thought.** SalesOS stores observable structured state and outcomes, not private reasoning or raw PCM.
11. **Vendor-neutral brain.** DeepSeek/GLM/Qwen/OpenAI-compatible supervisors share the same decision contract.
12. **HeyGen is a renderer.** Avatar transport remains isolated from sales policy and action execution.

## Action execution runtime

The action runtime factory returns the selected mode, whether execution is enabled, the registered tool set, and an executor when permitted.

Allowed modes:

```text
disabled  (default)
sandbox
```

Lifecycle:

```text
model proposes next_step
  -> server creates opaque ActionProposal
  -> pending
  -> human confirms
  -> confirmed
  -> permissioned executor
  -> executing
  -> executed | failed

pending | confirmed
  -> human cancels
  -> cancelled
```

The browser reads proposal state from the server. It never infers confirmation or execution from transcript text, and it never navigates to model-provided URLs.

## SalesOS action audit

Action lifecycle events preserve useful structured fields such as proposal/task IDs, kind, safe label, status, timestamps, executed flag and sanitized receipt metadata.

Allowed receipt metadata is limited to:

- `provider`
- `referenceId`
- `status`
- `summary`
- `sandbox`

Tokens, authorization headers, arbitrary provider bodies, private context, credentials, raw audio and hidden reasoning are excluded. Raw provider failure messages are also excluded because they may contain secrets.

## Production connectors

This wave intentionally includes no production connector mode. Future calendar, CRM, email, trial or handoff providers must implement the provider interface behind `ActionToolRegistry` without changing Qwen, GPT-Live, HeyGen, DOGA, `ActionProposalStore`, or `SalesActionExecutor`. Production providers must preserve the same confirmation, session-isolation, at-most-once and receipt-sanitization boundaries.
