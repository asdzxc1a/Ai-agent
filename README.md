# Astra — Autonomous Consultative Sales Agent

Astra is our company's autonomous consultative sales agent and the public proof of the AI-native company/workforce transformation service it sells.

The product goal is not merely browser automation or a talking avatar. Astra should eventually research suitable prospects, understand company/buyer context from evidence, conduct strong consultative sales conversations, qualify real opportunities, propose and safely execute authorized next actions, measure outcomes, and generate sanitized proof that can become public demonstrations.

## Fresh agent? Start here

**Astra and any new coding agent should read:**

1. [AGENTS.md](./AGENTS.md)
2. [Current project state](./docs/project/STATE.md)
3. The active gate in [Build plan](./docs/project/PLAN.md)
4. [Test strategy](./docs/project/TEST_STRATEGY.md)
5. The active GitHub issue for the current gate/subtask, if one exists

Do not start by reading every historical document.

## Product architecture

~~~text
Approved target / ICP
        ↓
Evidence-backed prospect research
        ↓
Sales ontology + durable prospect/buyer/opportunity state
        ↓
Consultative strategy / next-best-action
        ↓
Text / voice / optional avatar
        ↓
Typed action proposal + authorization
        ↓
Handoff / follow-up / meeting / CRM / approved browser action
        ↓
Outcome + evaluation
        ↓
Experience memory + sanitized public proof
~~~

Astra remains one visible salesperson. Browser runtimes, models, voice providers, avatars, CRM/email/calendar/social systems, validators, and evaluators remain replaceable implementation layers.

## What already exists

Gates 0–7 built the browser/research/run substrate:

- TypeScript workspace and CI;
- Steel browser/session adapter;
- Stagehand semantic-browser adapter;
- owned browser/agent contracts;
- asynchronous run API;
- durable PostgreSQL run/step/event state;
- replayable SSE;
- screenshots/diagnostics/artifacts;
- secret redaction;
- deterministic browser integration evidence.

This foundation is retained. It is now infrastructure for the sales product, not the product mission itself.

A separate draft sales/voice branch, [PR #2](https://github.com/asdzxc1a/Ai-agent/pull/2), contains reusable experimental work around Qwen, GPT-Live, HeyGen, sales state, action confirmation, and SalesOS. The current roadmap reuses those pieces selectively after the main-branch sales contracts are defined.

## Current gate

**Gate 13 — Evidence-backed live prospect research**

The audit-confirmed pre-sample hardening is now merged: request-path policy, SSE backlog replay, atomic terminal persistence/recovery, page/screenshot capture receipts, research uncertainty/provenance handoff, buyer-visible prohibited-prose checks, bounded diagnostics/cleanup, the serial read-only operator workflow, and a durable pre-registered sample/evaluation protocol all have regressions on `main`.

Gate 13 is still **IN_PROGRESS** because no acceptance cohort has been live-tested. The previously selected six-company U.S./China set is now treated as **calibration-only**: it can test workflow mechanics, source-page fit, reviewer instructions, and cost accounting, but it cannot close Gate 13.

The first acceptance experiment is **single-market U.S. transportation operations**. Its candidate universe is the complete 43-equity iShares U.S. Transportation ETF (IYT) holdings snapshot dated 2026-09-17, benchmarked to the S&P Transportation Select Industry FMC Capped Index. China remains a separate calibration track until its local multi-source research policy is qualified.

The acceptance experiment must:

- enrich all 43 frozen U.S. transportation members, then approve them through one manifest-hash-bound atomic batch before freezing exactly that complete universe; no member may be dropped because it looks hard or inaccessible;
- compare against the existing human researcher using their **normal tools**, not an artificially one-page-restricted baseline;
- persist an actually measured human baseline as durable server-timestamped state for each acceptance target **before** Astra is allowed to start that target;
- freeze the cost ceiling, rationale, source-attributed model/browser/provider rate plan, and exact live execution profile before results;
- record blind versus unblinded review;
- use the frozen `gate13-brief-review-v1` rubric so accepted/minor/major/rejected outcomes are derived from correction severity rather than reviewer discretion;
- run only frozen sample members through the bounded read-only research path;
- manually audit every durable observed evidence item against its source page/screenshot; completed outcomes derive `materialClaimsReviewed` from the durable attempt evidence count rather than reviewer input;
- freeze the requested-field ledger to `companyName | companySummary | transformationOpportunities | buyingSignals`; completed outcomes derive covered field IDs/counts from durable values or explicit unknowns, while failed attempts cover zero;
- produce an accepted or corrected brief without contacting the prospect;
- measure **total Astra-side human preparation time** (setup + evidence audit + corrections/finalization + failure triage + other operator work), coverage, duration, failures, and complete delivery cost against the existing human workflow.

The internal Gate 13 operator surface is intentionally narrow. Before authorization, `pnpm gate13:operator -- acceptance-preflight` can validate the exact canonical 43-target manifest/universe, proposed execution profile versus current env/repository pins, source-dated model/browser cost plan, positive cost ceiling/rationale, and normal-tools baseline description with **no database or browser access**; success is explicitly `PREPARED_NOT_AUTHORIZED`. `acceptance-readiness` is a separate DB-read-only command that reports the next durable transition without executing it. `pnpm gate13:operator -- preview` reads the exact checked-in 43-target candidate manifest, validates that it is still `NOT_APPROVED` with every row `PENDING_OPERATOR_APPROVAL`, and prints the exact manifest SHA-256 without mutating durable state. The `approve` command derives every `ApprovedResearchTarget` from those exact manifest bytes and refuses persistence unless the operator explicitly confirms the manifest ID, exact SHA-256, and `--authorize-all-43`. After approval, the same operator app derives the acceptance sample from the canonical manifest + frozen universe + stored atomic batch, records server-timestamped measured-human baselines, starts one serial read-only target at a time, surfaces capture artifacts for human audit, persists completed/failed attempts with server-derived run duration and owned-action count, derives reviewed outcomes from durable baseline/attempt truth, and evaluates only the complete frozen cohort. Live `run-target` also holds one fail-fast PostgreSQL advisory ownership lock for the duration of the process so two operator shells cannot accidentally execute Gate 13 research concurrently; this remains a single-owner guard, not the later multi-worker lease/fencing system. Stagehand token usage is mapped into owned model-usage evidence and captured before cleanup in the durable run step plus `run-summary.json`; `pnpm gate13:operator -- run-usage --run-id <id>` exposes it without converting tokens into an invented dollar cost. Acceptance sample freeze also requires `--execution-profile-file` plus `--cost-plan-file`: the execution profile pins the checked-in Stagehand dependency version, model name/base URL, Steel base URL, and the checkout's expected immutable Steel image pin; the profile labels that image identity as expected-only rather than claiming the running endpoint's digest was attested. The versioned source-dated rate plan carries explicit model and browser-provider categories. `run-target` compares the live environment with that frozen profile before starting research and persists the matched profile as a durable run step. `record-outcome` reads the durable run summary and derives the persisted component costs + total from that frozen plan; the reviewer JSON no longer supplies `deliveryCostUsd`, `endToEndDurationMs`, `unauthorizedActions`, or requested-field coverage counts; cost/duration/action/coverage evidence comes from the frozen sample plus durable attempt/run truth. Read-only preview/status/evaluation commands do not auto-run migrations. Do not run the approval mutation or any real-company research command without the corresponding explicit operator authorization and pre-run measurement state.

See [STATE.md](./docs/project/STATE.md) for the current verified truth. `pnpm check:memory` enforces that this README gate matches it.

## Persistent project memory

- [PROJECT_MEMORY_SYSTEM.md](./docs/project/PROJECT_MEMORY_SYSTEM.md) — self-contained portable memory/handoff specification.
- [CHARTER.md](./docs/project/CHARTER.md) — why Astra exists and the target product architecture.
- [STATE.md](./docs/project/STATE.md) — small current source of truth.
- [PLAN.md](./docs/project/PLAN.md) — gated roadmap and acceptance tests.
- [DECISIONS.md](./docs/project/DECISIONS.md) — durable architecture/product decisions.
- [LESSONS.md](./docs/project/LESSONS.md) — reusable engineering lessons.
- [TEST_STRATEGY.md](./docs/project/TEST_STRATEGY.md) — what counts as evidence.
- [HANDOFF_PROTOCOL.md](./docs/project/HANDOFF_PROTOCOL.md) — fresh-context workflow.
- [history/](./docs/project/history/) — cold milestone/incident/pivot evidence; do not read by default.

GitHub issues are short-lived working memory for the active gate/subtask. Tests and CI remain the strongest evidence.

## Core rule

**One gate at a time. A gate does not pass until its required deterministic and behavioral evidence passes.**

Research/drafting is not authorization to send outreach or publish externally.

## Development

The current foundation pins:

- Node.js `24.21.0`
- pnpm `10.34.5`
- TypeScript `6.0.3`

From a clean checkout:

~~~bash
pnpm install --frozen-lockfile
pnpm check
~~~

Project-memory-only changes should at minimum run:

~~~bash
pnpm check:memory
~~~

Relevant browser integration gates remain available through the existing Steel/Stagehand test commands and GitHub Actions.

## Browser foundation

The proven browser path remains:

~~~text
RunEngine
  ↓
AgentRuntime → Stagehand
  ↓
BrowserRuntime → Steel
  ↓
Chromium
~~~

Provider-specific types stay inside adapters. Future authenticated profiles, isolation/E2B, production queues, and broader browser capabilities are added only when a sales gate creates a measured need for them.
