# Current Project State

**Last updated:** 2026-09-18  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Semantic browser integration  
**Current gate:** Gate 2 — Stagehand → Steel  
**Overall status:** Gates 0 and 1 have passed. Gate 1 proved a pinned self-hosted Steel browser can complete the deterministic browser flow 10/10 over CDP in GitHub Actions.

## North star

Build the smallest reliable TinyFish-like browser-agent platform first:

```text
Our API
  ↓
Our durable run engine
  ↓
Stagehand
  ↓ CDP
Steel
  ↓
Chromium
```

Only after this local path is reliable:

```text
Stagehand
  ↓ CDP
Steel inside E2B sandbox
  ↓
Chromium
```

## What is already decided

- TypeScript-first initially.
- Do not merge/fork Stagehand, Steel, and E2B into one codebase.
- Integrate upstreams through our own small adapters.
- Prove Stagehand→Steel locally before adding E2B.
- Build one gate at a time.
- Tests are the evidence for progress.
- Keep durable project memory in GitHub, not in chat.
- Deterministic fixture sites are the primary browser regression surface.
- Upstream services/images are pinned rather than consumed through moving tags.

## What has been built

### Gate 0 foundation

- deterministic pnpm/TypeScript workspace;
- strict lint/typecheck/unit/build CI;
- `@astra/contracts` package with tested run-status contract.

### Gate 1 browser foundation

- `@astra/browser-steel` package with a minimal self-hosted Steel API client;
- pinned Steel Docker image by immutable digest:
  `sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`;
- deterministic `test-sites/simple-button` fixture;
- Playwright Core CDP verification;
- 10-iteration Steel integration test;
- failure screenshot/log artifact path;
- Docker integration workflow;
- explicit Steel session release and zero-live-session assertion.

## What has been tested

### Gate 0

Post-merge GitHub Actions on `main`: run `35375005784` passed frozen install, lint, typecheck, unit tests, and build.

### Gate 1

PR head `8df8f8090997c89331ab1ef70b26f7c8b01e2e06`:

- normal CI run `35376655240`: **PASSED**;
- Steel integration run `35376655354`: **PASSED**;
- integration exercised create → CDP connect → fixture navigation → click → state verification → PNG screenshot → close/release **10/10**;
- final assertion found zero live Steel sessions.

Two earlier integration attempts failed and produced useful lifecycle fixes; see `LESSONS.md` L-007 and L-008.

## Known risks

1. Steel currently publishes a moving public `:latest` image; our runtime is protected by an immutable digest, but upgrades must be deliberate and re-evaluated.
2. Steel startup on a cold GitHub runner pulls a large browser image and is slow; optimize CI caching later, not during correctness gates.
3. Upstream Stagehand/Steel/E2B APIs will evolve; adapters must isolate that churn.
4. Live-web tests remain inherently flaky; local deterministic fixtures remain the release gate.
5. Adding E2B before the local Stagehand→Steel path is stable would multiply complexity.

## Next action

**Gate 2 — Stagehand → Steel.**

Use the existing Steel adapter, pinned Steel runtime, and deterministic fixture.

Prove Stagehand can connect to the Steel-provided CDP endpoint and reliably perform:

```text
observe
  ↓
act
  ↓
extract structured result
```

Acceptance remains:

- deterministic fixture task 10/10;
- structured output schema validates;
- Steel session cleanup succeeds every time;
- no leaked browser sessions;
- no E2B yet.

## Gate completion rule

The current gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file has been updated with the evidence.

## Latest durable lesson

Readiness must be defined at the deepest resource the test needs. A healthy HTTP service is not necessarily a ready browser, and a session request should reuse compatible initialized browser state rather than forcing unnecessary lifecycle churn.
