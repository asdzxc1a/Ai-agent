# 2026-09-19 — Gate 11 deterministic prospect-research qualification

## Result

Gate 11 passed in PR #62 at verified product head:

`b5234191b7b981398264c361146902494c56f592`

Base:

`e45a5ded3d55d038969e4cd4a9e0283d808c9b2c`

ResearchBench v1 is frozen independently from the browser candidate and qualifies Astra's owned deterministic Stagehand→Steel prospect-research path across a materially broader local task distribution.

## Frozen benchmark

Benchmark freeze commit:

`1978c1d`

ResearchBench v1 contains 30 deterministic local tasks:

- 20 core release-blocking tasks;
- 10 hard challenge tasks;
- two tasks in every required Gate 11 category;
- about/company, product/service, team/leadership, careers/hiring, press/news;
- multi-page research, tables/cards/modals, dynamic content;
- conflicting information, missing information, distractors, stale dates;
- prompt-injection-like page text, source attribution, unknown/uncertain facts.

Candidate inputs exclude fixture pages and expected answers. The evaluator rejects fabricated evidence, unsupported findings, wrong source attribution, unknown→fact promotion, and false completion.

## Qualification history

### First frozen browser measurement

Candidate head:

`1a3a2fc633e59d76871733c1a44c925c4441c5b2`

Stagehand Steel run:

`35460339430`

Result:

- total: 28/30 (93.33%);
- core: 19/20 = 95%;
- hard: 9/10 = 90%;
- unsupported claims: 0;
- false-completed reports: 2;
- failed: `dynamic-transformation-program`, `dynamic-target-year`.

The benchmark remained frozen. Both failures were classified as qualification-harness defects: the consumed “Load research evidence” trigger remained mounted, so the deterministic observer selected it again instead of the newly-created reveal action.

### Intermediate harness regression

Head:

`2161b4d2d8f1ce2a6044ecf461399880ac0d4b29`

Stagehand Steel run:

`35461049947`

Result:

- total: 27/30 = 90%;
- core: 19/20 = 95%;
- hard: 8/10 = 80%;
- unsupported claims: 0;
- false-completed reports: 3;
- failed: `layout-modal-headquarters`, `dynamic-transformation-program`, `dynamic-target-year`.

Service diagnostics showed `Identifier 'trigger' has already been declared`. A fixture-script scope cleanup had accidentally declared the same binding twice, so modal/dynamic handlers never installed. Again, tasks and evaluator expectations were not changed.

### Final frozen measurement

Final product head:

`b5234191b7b981398264c361146902494c56f592`

Stagehand Steel run:

`35461483407`

Result:

- total: 30/30 = 100%;
- core: 20/20 = 100%;
- hard: 10/10 = 100%;
- false completions: 0;
- unsupported claims: 0;
- failed scenarios: none.

The final correction removed only the duplicate fixture-script binding, made non-completed RunEngine states fail the benchmark candidate instead of falling back to an apparent report, and added structural tests proving every frozen task's pages/expected facts/unknowns are internally consistent.

## Authoritative evidence

Final head `b5234191b7b981398264c361146902494c56f592`:

- CI `35461483365` — PASSED
  - project-memory consistency;
  - lint;
  - strict typecheck;
  - 67/67 tests across 14 files;
  - all workspace builds.
- Steel integration `35461483465` — PASSED
  - pinned Steel;
  - ten-session raw Steel lifecycle regression;
  - screenshot artifacts;
  - cleanup.
- Stagehand Steel integration `35461483407` — PASSED
  - ResearchBench v1: 30/30, core 20/20, hard 10/10;
  - zero false completions and zero unsupported claims;
  - all ResearchBench runs verified Steel session status `released`;
  - legacy three-action owned research acceptance;
  - real Steel cancellation/release acceptance;
  - legacy ten-session Stagehand→Steel regression;
  - HTTP API browser acceptance;
  - PostgreSQL repository acceptance;
  - replayable SSE acceptance;
  - durable API restart acceptance;
  - cleanup.

The ResearchBench qualification itself completed in 46.024s. The legacy three-action research test completed in 2.106s, real Steel cancellation in 1.316s, and the ten-session Stagehand→Steel regression in 14.465s.

## Acceptance interpretation

Gate 11 proves the owned deterministic research path across the frozen local task distribution. It does not claim paid hosted-model generalization or live-web safety.

Every final material finding is checked against observed evidence with a source URL. Missing/ambiguous values remain explicit unknowns, conflicting dated facts resolve by recency, and prompt-injection-like page text does not alter the deterministic research contract.

Final failures are zero. Earlier first-attempt failures remain reproducible/classified above rather than being erased.

## Boundary preserved

Gate 11 did not add sandbox/E2B complexity, live prospect research at scale, outreach, voice/avatar, CRM/calendar/social actions, or new irreversible external side effects.

Next gate: Gate 12 — Sandbox + network safety for external research (issue #63).
