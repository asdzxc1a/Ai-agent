# Browser Foundation Milestone — Gates 0–7

**Archived:** 2026-09-19  
**Purpose:** Preserve detailed acceptance evidence from the browser-foundation phase without keeping STATE.md as a chronological CI ledger.

This file is cold project memory. Fresh contributors should normally read STATE.md first and open this file only when detailed evidence for Gates 0–7 is needed.

## Gate 0 — Repository + CI

PR #19 merged after GitHub Actions run `35375643603` passed:

- frozen install;
- lint;
- typecheck;
- unit tests;
- build.

## Gate 1 — Steel alone, local

Quality CI run `35376572552` passed frozen install, lint, typecheck, unit tests, and build.

Steel integration run `35376572583` passed against immutable Steel image:

`ghcr.io/steel-dev/steel-browser@sha256:58fc8f1ed309a647ea7e7a53005b90cb239b8995698d195a261654ac8804974c`

Acceptance result:

- deterministic fixture healthy;
- Steel healthy;
- 10 consecutive create → CDP connect → navigate → click → verify → screenshot → release cycles passed;
- the 10-session acceptance completed in 15.86s;
- cleanup completed successfully.

Screenshot artifact: `10560622294`  
Artifact digest: `sha256:92b4c1cfcb614252256343088ded29be71e6483e7277e0b64c2d190dbb15a176`

## Gate 2 — Stagehand → Steel

Branch evidence:

- normal CI run `35378403117` passed frozen install, lint, typecheck, unit tests, and build;
- Stagehand→Steel run `35378403386` passed 10 consecutive `observe → act(observed Action) → extract` sessions in 19.02s with explicit Steel release and cleanup.

PR #25 merge evidence on the code-complete head:

- CI `35379048578` — passed;
- Stagehand Steel integration `35379048624` — passed;
- Steel integration `35379048628` — passed.

## Gate 3 — Owned browser/agent interfaces

PR #27 evidence on head `f6d93b74912d6412cb1be76b6050265142f83094`:

- CI `35381977883` — passed;
- Steel integration `35381977729` — passed;
- Stagehand semantic integration `35381977879` — passed.

The owned-runtime semantic acceptance completed 10/10 sessions in 13.87s (14.42s total Vitest duration), including cleanup.

## Gate 4 — First product API

PR #29 code-head evidence on `4de8a6cf7e9e48d31541cc9260238110ad0d12fa`:

- CI `35384275224` — passed;
- Steel integration `35384276299` — passed;
- Stagehand/API integration `35384275365` — passed.

The 10-session semantic regression passed in 18.96s.

The real HTTP API structured browser acceptance passed in 1.95s (2.75s total Vitest duration), returning:

~~~json
{
  "count": 1,
  "status": "clicked"
}
~~~

Cleanup succeeded.

## Gate 5 — Durable run state

PR #31 evidence on head `90ef1dde8cb062c731e6c2ee9f8e49d776c2715e`:

- CI `35385727058` — passed;
- Steel integration `35385726966` — passed;
- combined Stagehand/PostgreSQL run `35385727172` — passed.

Inside the combined run:

- 10-session semantic regression passed in 18.68s;
- Gate 4 HTTP browser acceptance passed in 1.98s;
- PostgreSQL repository acceptance passed in 285ms;
- full API restart acceptance passed in 2.14s (2.95s total);
- the same COMPLETED result, persisted steps, and ordered events survived a fresh pool/API instance.

PostgreSQL image:

`postgres@sha256:6c538e7206ea40ff740ef27883529390a690b6ead6ba96b44c67a9f7c638e8fd`

## Gate 6 — Replayable SSE

PR #33 evidence on head `6a4c7a6134d28106696c5d050298cd8b3852d384`:

- CI `35387635098` — passed;
- Steel run `35387634898` — passed;
- combined Stagehand/PostgreSQL/SSE run `35387634903` — passed.

The PostgreSQL replay test:

- disconnected after `RUN_CREATED` event id 1;
- confirmed the run continued;
- reconnected with `Last-Event-ID: 1`;
- received exactly ids 2–3: `RUN_STARTED`, `RUN_COMPLETED`;
- received no duplicates;
- final result matched persisted state.

SSE acceptance passed in 643ms (877ms total Vitest duration), and the durable restart regression remained green.

## Gate 7 — Artifacts + debugging

PR #35 acceptance evidence on code-complete head `a816ff6c3dc8c471d00ec48718b74b8fec6f5362`.

### Quality CI

Run `35391692165` passed:

- frozen install;
- lint;
- strict TypeScript;
- 20/20 unit tests across 7 files;
- all workspace builds.

Artifact-store tests covered:

- redacted JSON/metadata;
- local binary round-trip across a fresh store instance;
- local JSON round-trip across a fresh store instance;
- path traversal rejection.

RunEngine tests covered:

- success/failure lifecycle artifacts;
- diagnostic opt-in;
- secret redaction;
- omission of action arguments from run summary;
- best-effort artifact-store failures.

API tests covered:

- artifact list/download;
- media type/no-store behavior;
- typed artifact/run 404s.

### Steel integration

Run `35391691999` passed against the pinned Steel digest.

- original 10-session lifecycle regression: 20.270s;
- owned Steel browser adapter captured a JPEG and retrieved a generated console diagnostic: 1.832s;
- cleanup passed.

Raw Steel workflow artifact: `10565318496`  
Artifact digest: `sha256:7e219bc7efc372d8f78f83bc51a245e12e6c27fc1d118bfc92c0150441be07fa`

### Combined Stagehand/PostgreSQL/API integration

Run `35391692005` passed against pinned Steel and PostgreSQL.

- 10-session owned-runtime Stagehand→Steel semantic regression: 16.546s;
- real HTTP browser artifact acceptance: 2.012s;
- HTTP acceptance proved artifact listing/download, readable JPEG magic bytes, and summary URL-secret redaction;
- PostgreSQL repository acceptance: 82ms;
- SSE disconnect/replay: 632ms;
- durable API restart: 1.951s;
- cleanup passed.

## Foundation conclusion

By the end of Gate 7, the repository had proven the following infrastructure path:

~~~text
HTTP API
  ↓
RunEngine
  ↓
RunRepository
  ├ InMemoryRunRepository
  └ PostgresRunRepository

BrowserRuntime
  └ SteelBrowserRuntime

AgentRuntime
  └ StagehandAgentRuntime

ArtifactStore
  ├ InMemoryArtifactStore
  └ LocalArtifactStore
~~~

This milestone proves integration, durability of stored run state, replayable events, cleanup behavior, and debugging evidence.

It does not by itself prove broad multi-step web-agent capability.
