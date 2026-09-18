# Current Project State

**Last updated:** 2026-09-18  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Browser foundation  
**Current gate:** Gate 3 — Our browser/agent interfaces  
**Overall status:** Gate 2 passed all PR #25 merge gates: strict CI, raw Steel regression, and Stagehand→Steel semantic integration are green. Gate 3 is next after PR #25 merges.

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

Only after that path is reliable:

```text
Stagehand
  ↓ CDP
Steel inside E2B sandbox
  ↓
Chromium
```

## What is already decided

- Use this repository as the working home because it was effectively empty.
- TypeScript-first initially.
- Do not merge/fork Stagehand, Steel, and E2B into one codebase.
- Integrate them through our own small interfaces.
- Prove Stagehand→Steel locally before adding E2B.
- Build one gate at a time.
- Tests are the evidence for progress.
- Keep durable project memory in GitHub, not in chat.
- A fresh Astra starts with `AGENTS.md` and this file.

## What has been built

Foundation code includes the TypeScript/pnpm workspace, `@astra/contracts`, `@astra/browser-steel`, and `@astra/agent-stagehand`. Steel owns browser/session/CDP lifecycle; Stagehand 3.7.0 attaches to Steel over CDP. The semantic integration uses a secret-free deterministic test LLM that supplies only structured model judgments while Stagehand still performs real page observation, encoded-ID→XPath mapping, browser action execution, and Zod-validated extraction.

Project-memory system:

- `AGENTS.md`
- `docs/project/CHARTER.md`
- `docs/project/STATE.md`
- `docs/project/PLAN.md`
- `docs/project/DECISIONS.md`
- `docs/project/LESSONS.md`
- `docs/project/TEST_STRATEGY.md`
- `docs/project/HANDOFF_PROTOCOL.md`
- GitHub PR template

## What has been tested

Gate 1 evidence:
- quality CI run `35376572552`: frozen install, lint, typecheck, unit tests, build — passed;
- Steel integration run `35376572583`: pinned Steel container healthy, deterministic fixture healthy, **10 consecutive create → CDP connect → navigate → click → verify → screenshot → release cycles passed**;
- screenshot artifact `10560622294` uploaded successfully;
- cleanup completed successfully;
- tested Steel image: `ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`.

Gate 0 evidence: PR #19 merged after PR-triggered GitHub Actions run `35375643603` passed install, lint, typecheck, unit tests, and build with the committed lockfile.

Gate 1 evidence: GitHub Actions run `35376572583` passed against immutable Steel image `ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`. The 10-session acceptance test passed in 15.86s, uploaded 10 screenshots as artifact `10560622294`, and cleanup succeeded. Artifact digest: `sha256:92b4c1cfcb614252256343088ded29be71e6483e7277e0b64c2d190dbb15a176`.

Gate 2 branch evidence: normal CI run `35378403117` passed frozen install, lint, typecheck, unit tests, and build. Stagehand→Steel run `35378403386` passed 10 consecutive `observe → act(observed Action) → extract` sessions in 19.02s with explicit Steel release and cleanup.

Gate 2 PR #25 merge evidence on the code-complete head: CI run `35379048578` — passed; Stagehand Steel integration run `35379048624` — passed; Steel integration run `35379048628` — passed.

Memory bootstrap verification: required files were created and fetched successfully from GitHub; the bootstrap change is recorded in PR #15.

## Known risks

1. Upstream Stagehand/Steel/E2B APIs will evolve; adapters must isolate that churn.
2. Live-web tests are inherently flaky; local deterministic fixture sites must be the main development benchmark.
3. Adding E2B too early would multiply complexity.
4. Forking upstreams too early would create unnecessary maintenance burden.
5. Documentation can become stale if the PR process does not require state updates.

## Next action

**Gate 3:** introduce our own `BrowserRuntime`, `BrowserSession`, and `AgentRuntime` contracts; move all Steel-specific behavior behind a Steel adapter and all Stagehand-specific behavior behind a Stagehand adapter; then rerun the Gate 2 semantic test unchanged in behavior through those owned interfaces.

## Gate completion rule

The current gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file has been updated with the evidence.

## Latest durable lesson

Start simple: **local Stagehand→Steel first; E2B later.**
