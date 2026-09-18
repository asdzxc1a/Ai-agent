# Current Project State

**Last updated:** 2026-09-18  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Browser foundation  
**Current gate:** Gate 8 — Deterministic eval suite  
**Overall status:** Gate 7 is PASSED and squash-merged in PR #35 at `653e07246857ddf5e95e5589bdac947ee58e511a`. Gate 8 is next and has not started.

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

Foundation code now includes owned browser/agent runtimes, the product HTTP API, a provider-neutral `RunEngine`/`RunRepository` boundary, `InMemoryRunRepository` for fast tests, and `PostgresRunRepository` as the durable implementation. PostgreSQL persists `runs`, `run_steps`, and `run_events`; the Gate 4 HTTP contract is unchanged, and a completed browser run survives a fresh DB pool and API instance.

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

Gate 3 PR #27 evidence on head `f6d93b74912d6412cb1be76b6050265142f83094`: CI run `35381977883` — passed; Steel integration run `35381977729` — passed; Stagehand Steel integration run `35381977879` — passed. The owned-runtime semantic acceptance completed 10/10 sessions in 13.87s (14.42s total Vitest duration), including cleanup.

Gate 4 PR #29 code-head evidence on `4de8a6cf7e9e48d31541cc9260238110ad0d12fa`: CI run `35384275224` — passed; Steel integration run `35384276299` — passed; Stagehand/API integration run `35384275365` — passed. The 10-session semantic regression passed in 18.96s, and the real HTTP API structured browser run passed in 1.95s (2.75s total Vitest duration), returning `{ count: 1, status: "clicked" }` with successful cleanup.

Gate 5 PR #31 evidence on head `90ef1dde8cb062c731e6c2ee9f8e49d776c2715e`: CI run `35385727058` — passed; Steel integration run `35385726966` — passed; combined Stagehand/PostgreSQL run `35385727172` — passed. In that combined run, the 10-session semantic regression passed in 18.68s, the Gate 4 HTTP browser acceptance passed in 1.98s, PostgreSQL repository acceptance passed in 285ms, and the full API restart acceptance passed in 2.14s (2.95s total), proving the same COMPLETED result, persisted steps, and ordered events survive a fresh pool/API instance. PostgreSQL image: `postgres@sha256:6c538e7206ea40ff740ef27883529390a690b6ead6ba96b44c67a9f7c638e8fd`.

Gate 6 PR #33 evidence on head `6a4c7a6134d28106696c5d050298cd8b3852d384`: CI run `35387635098` — passed; Steel run `35387634898` — passed; combined Stagehand/PostgreSQL/SSE run `35387634903` — passed. The PostgreSQL replay test disconnected after `RUN_CREATED` (event id 1), confirmed the run continued, reconnected with `Last-Event-ID: 1`, and received exactly ids 2–3 (`RUN_STARTED`, `RUN_COMPLETED`) with no duplicates. The SSE test passed in 643ms (877ms total Vitest duration), and the durable restart regression remained green.

Gate 7 PR #35 acceptance evidence on head `a816ff6c3dc8c471d00ec48718b74b8fec6f5362`:
- CI run `35391692165` — passed frozen install, lint, strict TypeScript, **20/20 unit tests across 7 files**, and all workspace builds. Artifact-store tests cover redacted JSON/metadata plus local binary and JSON round-trips across fresh store instances; RunEngine tests cover success/failure lifecycle artifacts, diagnostic opt-in, redaction, action-argument omission, and best-effort storage failures; API tests cover artifact list/download and typed 404s.
- Steel integration run `35391691999` — passed against pinned Steel `ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`. The original 10-session lifecycle regression passed in 20.270s, and the owned Steel browser adapter independently captured a JPEG and retrieved a generated console diagnostic in 1.832s. Workflow cleanup passed.
- Combined Stagehand/PostgreSQL run `35391692005` — passed against pinned Steel and PostgreSQL `postgres@sha256:6c538e7206ea40ff740ef27883529390a690b6ead6ba96b44c67a9f7c638e8fd`. The 10-session owned-runtime Stagehand→Steel semantic regression passed in 16.546s; the real HTTP browser artifact acceptance passed in 2.012s and proved artifact listing/download, readable JPEG magic bytes, and summary URL-secret redaction; PostgreSQL repository acceptance passed in 82ms; SSE disconnect/replay passed in 632ms; durable API restart passed in 1.951s; cleanup passed.
- Raw Steel workflow artifact `10565318496` uploaded the 10 regression screenshots; digest `sha256:7e219bc7efc372d8f78f83bc51a245e12e6c27fc1d118bfc92c0150441be07fa`.

Memory bootstrap verification: required files were created and fetched successfully from GitHub; the bootstrap change is recorded in PR #15.

## Known risks

1. Upstream Stagehand/Steel/E2B APIs will evolve; adapters must isolate that churn.
2. Live-web tests are inherently flaky; local deterministic fixture sites must be the main development benchmark.
3. Adding E2B too early would multiply complexity.
4. Forking upstreams too early would create unnecessary maintenance burden.
5. Documentation can become stale if the PR process does not require state updates.

## Next action

**Gate 8 — Deterministic eval suite:** create/focus the Gate 8 issue and focused branch from latest `main`, then follow the Gate 8 acceptance criteria. No Gate 8 implementation has started.

## Gate completion rule

The current gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file has been updated with the evidence.

## Latest durable lesson

Start simple: **local Stagehand→Steel first; E2B later.**
