# Current Project State

**Last updated:** 2026-09-18  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Foundation bootstrap  
**Current gate:** Gate 0 — Repository + CI  
**Overall status:** Gate 0 is in progress on branch `gate-0-workspace-ci`; the TypeScript workspace is created and CI/lockfile verification is pending.

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

Foundation code now exists: a minimal TypeScript/pnpm workspace plus the initial `@astra/contracts` package and run-status unit test.

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

Gate 0 unit/CI acceptance is not yet complete. The first unit test has been added; dependency installation, lint, typecheck, test, and build still need to pass in GitHub Actions.

Memory bootstrap verification: required files were created and fetched successfully from GitHub; the bootstrap change is recorded in PR #15.

## Known risks

1. Upstream Stagehand/Steel/E2B APIs will evolve; adapters must isolate that churn.
2. Live-web tests are inherently flaky; local deterministic fixture sites must be the main development benchmark.
3. Adding E2B too early would multiply complexity.
4. Forking upstreams too early would create unnecessary maintenance burden.
5. Documentation can become stale if the PR process does not require state updates.

## Next action

**Finish Gate 0 on issue #16:** generate the real pnpm lockfile in GitHub Actions, switch CI to strict frozen-lockfile mode, then prove lint/typecheck/test/build all pass.

Create the minimal TypeScript workspace and CI that runs:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not add Stagehand, Steel, or E2B during the first Gate 0 PR unless required to prove the workspace itself.

## Gate completion rule

The current gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file has been updated with the evidence.

## Latest durable lesson

Start simple: **local Stagehand→Steel first; E2B later.**
