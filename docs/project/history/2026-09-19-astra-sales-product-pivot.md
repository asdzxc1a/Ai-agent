# 2026-09-19 — Astra sales-product pivot

## Why this history record exists

This file preserves the detailed rationale for changing Astra's **product mission** while keeping verified infrastructure history out of hot memory.

The Git-centered memory protocol itself is not being replaced. The pivot changes project-specific mission, future gates, and acceptance criteria.

## Previous product framing

Through Gate 7, `main` was intentionally developed as a small TinyFish-like browser-agent platform:

~~~text
API
  ↓
durable RunEngine
  ↓
Stagehand
  ↓
Steel / Chromium
~~~

That sequence produced useful, verified infrastructure:

- owned browser/agent contracts;
- deterministic Steel/Stagehand integration;
- asynchronous run API;
- PostgreSQL run/step/event durability;
- replayable SSE;
- artifacts/screenshots/diagnostics;
- secret redaction;
- GitHub-centered project memory.

Those gates remain PASSED. The pivot does not reinterpret failed work as success or delete its evidence.

## New product mission

The user's explicit product priority is now:

> Astra becomes our company's autonomous consultative sales agent and a public demonstration of the service it sells.

The service direction is AI-native company/workforce transformation: helping companies redesign workflows, augment employees with AI, introduce reliable AI workers/agents, and operate people + AI together.

Astra should eventually:

1. find appropriate prospects;
2. research them from evidence;
3. build durable company/buyer/opportunity context;
4. conduct consultative discovery;
5. qualify without becoming a questionnaire/spam bot;
6. use approved proof/claims;
7. earn a concrete next step;
8. execute authorized actions safely;
9. measure the outcome;
10. produce sanitized proof that can support LinkedIn/X demonstrations.

The strongest demonstration is Astra doing the sales job itself.

## What changes

Future work after Gate 7 is reordered around the sales loop.

Old planned work such as broad browser fixture expansion, E2B, profiles, production queues, live-web evaluation, and generic capability expansion is no longer pursued simply because it was on the old roadmap.

Those capabilities may still be built when a sales gate requires them:

- browser fixtures → prospect research/evidence acceptance;
- profiles/credentials → authenticated approved channel actions;
- E2B/isolation → bounded authenticated browser autonomy if measurements justify it;
- production queue → production sales service after market value is proven;
- live-web evaluation → controlled prospect/market evidence.

## What does not change

- tests/current code remain stronger than prose;
- Gates 0–7 remain historical truth;
- Stagehand/Steel remain replaceable adapters;
- TypeScript-first remains the initial owned-code direction;
- GitHub remains canonical project memory;
- one gate/bounded subtask at a time;
- external irreversible/reputation-affecting actions remain authorization-gated until deliberately changed.

## Separate reusable asset: draft sales/voice PR #2

Draft PR #2 / branch `codex/sales-avatar-foundation` predates the current `main` browser platform and contains a substantial sales/voice experiment:

- deterministic sales state;
- Qwen Audio Agent integration;
- GPT-Live integration;
- optional HeyGen LiveAvatar;
- hidden sales reasoning;
- canonical product/visual truth;
- action proposal/confirmation/execution;
- SalesOS trajectory/reward/experience structures;
- adversarial action security tests.

Its previous integration gate recorded green automated results, but:

- it is not merged into current `main`;
- it was built against an older repository shape;
- its demo commercial ontology is generic SaaS;
- the intended real GPT-Live + HeyGen live/human acceptance is still pending.

Therefore D-022 requires selective reuse behind new owned contracts rather than a wholesale branch merge.

## Why Gate 8 starts with domain + evaluation

It would be easy to jump immediately to voice, prospect scraping, CRM connectors, or social posting.

That would recreate the project's earlier risk: optimizing substrate before defining the product contract.

Gate 8 instead makes the following explicit:

- what Astra is allowed to sell;
- what claims require evidence;
- which company/buyer/opportunity facts exist;
- how observed facts differ from hypotheses;
- what qualification means;
- what a good consultative action looks like;
- how sales behavior is scored.

Only then does Gate 9 use the browser foundation for prospect research.

## Public proof policy

The user wants Astra's results to become public demonstrations on LinkedIn/X.

This is a product requirement, but it is deliberately split into two stages:

1. generate evidence-backed, sanitized `PublicProof` and social-post drafts;
2. publish only through an explicitly authorized capability.

No model text is treated as permission to publish.

## Current handoff

Current product gate:

**Gate 8 — Sales domain contract + SalesBench baseline**

Active issue:

**#43 — Pivot Astra roadmap to autonomous consultative sales agent**

Next implementation work should stay inside Gate 8. Do not begin live outreach, social posting, voice integration, CRM writes, E2B, or model training until the relevant later gate is reached or the user explicitly reprioritizes and project memory is updated.
