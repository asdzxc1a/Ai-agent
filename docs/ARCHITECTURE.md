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
         -> canonical product/pricing/comparison/ROI truth
         -> OpenAI-compatible reasoner (DeepSeek / GLM / Qwen / OpenAI)
      -> normalized factual result + visual artifact
   -> browser overlays + spoken response
```

External actions use a separate server-owned control path:

```text
model proposes canonical next_step
   -> InMemoryActionProposalStore creates server ID (pending)
   -> buyer explicitly confirms (confirmed)
   -> SalesActionExecutor
   -> allowlisted ActionToolRegistry handler
   -> sandbox provider in this wave
   -> sanitized receipt
   -> proposal executed/failed
   -> sanitized SalesOS lifecycle audit
```

## Rules

1. **One visible salesperson.** Specialists never become user-facing personas.
2. **Server owns truth.** Pricing, product facts, CRM state, consent, proposal identity, and action state never live only in model memory.
3. **Models advise; tools act.** A model can propose a next step but cannot confirm, execute, choose arbitrary tools, or author a successful receipt.
4. **Human confirmation is explicit.** Execution begins only from a server-owned proposal in `confirmed` state.
5. **Execution fails closed.** `SALES_ACTION_EXECUTION_MODE` supports only `disabled` and `sandbox`; the default is `disabled`.
6. **Sandbox means local-only.** Sandbox action providers perform no network, email, CRM, calendar, payment, or filesystem side effects.
7. **At-most-once success.** A successful retry returns the stored `executed` result without rerunning the provider.
8. **Session isolation is mandatory.** Confirmation, cancellation, and execution are scoped to the proposal's owning sales session.
9. **No exposed chain-of-thought or provider secrets.** SalesOS keeps structured lifecycle fields and allowlisted receipt metadata, not raw provider payloads, credentials, arbitrary context, or private reasoning.
10. **Vendor-neutral brain.** DeepSeek/GLM/Qwen/OpenAI all plug into the same `decide()` contract.
11. **Qwen upstream-first.** Integrate via Backend Adapter SDK, knowledge/memory providers, custom client and realtime-provider contracts wherever possible.
12. **HeyGen is a renderer.** Avatar transport is isolated from sales policy and action execution.

## Implemented foundation

- deterministic `SalesSessionState` and DOGA-style turn strategy
- deterministic product/pricing/comparison/case-study/ROI truth
- Qwen-`BackendPort`-shaped `SalesBackendAdapter` and conformance tests
- OpenAI-compatible hidden reasoner plus native GPT-Live and Qwen/HeyGen transport paths
- browser sales visuals and realtime validation cockpit
- server-owned `ActionProposal` lifecycle: pending, confirmed, cancelled, executing, executed, failed
- fail-closed action execution runtime factory with disabled/sandbox modes
- modular local sandbox providers behind `ActionToolRegistry`
- session-scoped action list/confirm/cancel/execute API
- buyer confirmation UI where confirmed is visibly different from executed
- SalesOS action lifecycle auditing with sanitized receipts and generic safe failure audit text
- Promise-level race, retry, isolation, malicious-receipt, and no-network adversarial tests

## Production boundary

Production connectors are intentionally **not** part of this wave. Replacing a sandbox booking/email/CRM/trial provider with a real provider must not require changes to Qwen, GPT-Live, HeyGen, DOGA, the proposal store, or `SalesActionExecutor`.

Before any production connector is enabled, it needs its own credentials boundary, provider-specific permissioning, idempotency contract, receipt sanitizer, integration tests, and a real live human smoke test. PR #2 remains draft until the real GPT-Live + HeyGen live smoke/human test succeeds.
