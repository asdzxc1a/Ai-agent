# Current Project State

**Last updated:** 2026-09-19  
**Repository:** `asdzxc1a/Ai-agent`  
**Phase:** Browser foundation → agent capability evaluation  
**Current gate:** Gate 8 — Deterministic eval suite  
**Overall status:** Gates 0–7 are PASSED. Gate 7 was squash-merged in PR #35 at `653e07246857ddf5e95e5589bdac947ee58e511a`. The project-memory hardening is implemented in PR #38. Gate 8 remains the current product gate and no Gate 8 product implementation has started.

## North star

Build the smallest reliable TinyFish-like browser-agent platform first:

~~~text
Our API
  ↓
Our durable run engine
  ↓
Stagehand
  ↓ CDP
Steel
  ↓
Chromium
~~~

Only add sandbox/isolation complexity after the local browser-agent path is measured and reliable.

## What works now

The repository currently has:

- strict TypeScript workspace + deterministic CI;
- owned `BrowserRuntime` / `BrowserSession` contracts;
- Steel browser adapter with session lifecycle, screenshots, and diagnostics;
- owned `AgentRuntime` / `AgentSession` contracts;
- Stagehand adapter over Steel CDP;
- asynchronous HTTP run API;
- provider-neutral `RunEngine` / `RunRepository`;
- fast in-memory repository and durable PostgreSQL repository;
- persisted runs, steps, and ordered events;
- replayable SSE using persisted event sequence IDs;
- artifact abstraction with in-memory/local filesystem stores;
- downloadable screenshots/diagnostics/run summaries;
- artifact redaction tests;
- pinned Steel and PostgreSQL runtime images;
- clean GitHub-centered project memory/handoff discipline.

## Important current limits

These are current product limits, not hidden future work:

- the owned RunEngine executes one observe/select/act cycle, not a general multi-step agent loop;
- the current repeated semantic acceptance proves one deterministic fixture behavior, not broad web-agent capability;
- the Stagehand integration acceptance uses a deterministic fixture LLM for reproducibility;
- persisted run state is durable, but in-flight execution is still process-bound and not worker-recoverable;
- `CANCELLED` exists as a state but cancellation propagation is not implemented;
- hard step/time/model-cost budgets are not implemented yet;
- E2B/sandbox isolation has not started;
- authentication, tenancy, and public-service network policy are not implemented;
- local artifact storage is not a distributed production artifact service;
- no production composition/bootstrap executable currently wires the complete service outside integration tests.

## Completed milestones

| Gate | Status | Durable evidence |
| --- | --- | --- |
| 0 — Repository + CI | PASSED | PR #19 / CI evidence archived |
| 1 — Steel alone, local | PASSED | pinned Steel, 10/10 lifecycle regression |
| 2 — Stagehand → Steel | PASSED | PR #25 |
| 3 — Owned browser/agent interfaces | PASSED | PR #27 |
| 4 — First product API | PASSED | PR #29 |
| 5 — Durable run state | PASSED | PR #31 |
| 6 — Replayable SSE | PASSED | PR #33 |
| 7 — Artifacts + debugging | PASSED | PR #35 |

Detailed Gates 0–7 CI runs, timings, image digests, and artifact IDs are preserved in:

`docs/project/history/2026-09-18-gates-0-7-browser-foundation.md`

Tests and current code remain stronger evidence than this summary.

## Project memory

The memory system uses:

- `AGENTS.md` as the bootloader;
- this file as the single hot-memory hub;
- the active GitHub issue as short-lived working memory;
- `PLAN.md` for future gates;
- `DECISIONS.md` for durable rationale;
- `LESSONS.md` for reusable learning;
- `history/` for cold completed evidence;
- tests/CI as the strongest source of truth.

The complete reusable specification is:

`docs/project/PROJECT_MEMORY_SYSTEM.md`

Structural invariants are checked with:

~~~bash
pnpm check:memory
~~~

## Known risks

1. Broad agent capability is still unmeasured; Gate 8 must expose the real baseline rather than assume it.
2. Upstream Stagehand/Steel/E2B APIs can evolve; owned adapters must continue isolating that churn.
3. Live websites are inherently flaky; deterministic local fixtures remain the primary development/evaluation substrate.
4. Adding sandbox/distributed infrastructure before agent behavior is measured can hide the actual product bottleneck.
5. Project memory can drift again if hot state is allowed to become a historical ledger; detailed evidence belongs in cold history.

## Next action

**Roadmap correction before Gate 8 implementation:** after PR #38 is merged with green CI, update the future gates and evaluation strategy using the completed architectural review. Then begin the revised Gate 8. No Gate 8 product implementation belongs in the memory-hardening PR.

## Gate completion rule

A product gate is complete only when its acceptance tests in `PLAN.md` and `TEST_STRATEGY.md` pass and this file reflects the verified result.
