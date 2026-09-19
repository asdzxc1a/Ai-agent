# Project Charter — Astra Autonomous Sales Agent

## Why this project exists

Astra is our company's autonomous consultative sales agent and the public demonstration of the service it sells.

The current service hypothesis is **AI-native company and workforce transformation**: helping companies redesign workflows, augment employees with AI, introduce reliable AI workers/agents, and move from isolated AI experiments toward an operating model where people and AI systems work together. Exact packaging, pricing, guarantees, and commercial claims are product truth and must not be invented by the model.

Astra should eventually:

- discover suitable companies and buying situations;
- research each prospect from verifiable evidence;
- form explicit hypotheses about where AI-native transformation may create value;
- start relevant, non-spammy conversations;
- conduct high-quality consultative discovery;
- qualify an opportunity incrementally;
- explain our service using only approved claims and proof;
- propose the best next action;
- execute authorized actions safely;
- continue the relationship across approved channels;
- measure the outcome;
- produce sanitized, evidence-backed demonstrations suitable for LinkedIn/X and internal learning.

Astra therefore sells the service **and demonstrates the service by doing the job itself**.

## Product principle

The product is not "an LLM plus a browser" and it is not "an avatar plus a prompt."

It is a sales operating system with several replaceable interfaces:

~~~text
Public web / approved business systems
        ↓
Prospect intelligence
        ↓
Astra sales ontology + durable customer/opportunity state
        ↓
Consultative strategy / next-best-action policy
        ↓
Conversation interface
  text / voice / optional avatar
        ↓
Permissioned action controller
        ↓
CRM / handoff / meeting / follow-up / approved browser actions
        ↓
Outcome + evaluation
        ↓
Experience memory / public proof
~~~

The externally visible product remains **one salesperson: Astra**. Internal reducers, validators, reasoners, tools, and evaluators are implementation details.

## Existing foundations we keep

### Browser foundation on `main`

Gates 0–7 already provide:

- strict TypeScript/CI foundation;
- owned browser and agent contracts;
- Steel browser sessions behind our adapter;
- Stagehand semantic browser interaction behind our adapter;
- durable PostgreSQL run state;
- ordered run events and replayable SSE;
- artifacts/screenshots/diagnostics with secret redaction;
- Git-centered project memory and handoff discipline.

This becomes Astra's **prospecting, research, evidence, and later browser-action substrate**. We do not discard it because the product mission changed.

### Sales/voice foundation in draft PR #2

Draft PR #2 contains a separate experimental sales stack with:

- deterministic sales state;
- Qwen/GPT-Live realtime orchestration;
- optional HeyGen avatar rendering;
- canonical commercial-truth boundaries;
- proposal/confirmation/action execution;
- SalesOS trajectory/reward/experience structures;
- adversarial action-security tests.

It has valuable contracts and tests, but it is not merged into `main`, its intended live GPT-Live + HeyGen acceptance remains incomplete, and its demo commercial ontology does not match the new service. Reuse should therefore be **selective and evidence-driven**, not a wholesale branch merge.

## Owned product contracts

Gate 8 should define these as small provider-neutral schemas before adding new infrastructure:

- `ServiceOffer` — what Astra is allowed to sell and claim;
- `Evidence` — source, observation, timestamp, confidence/uncertainty;
- `Prospect` — company-level fit and disqualifiers;
- `Buyer` — person/role/contact state without model-owned identity;
- `Opportunity` — current commercial state;
- `QualificationState` — what is known, unknown, and worth asking next;
- `SalesDecision` — objective, response guidance, evidence to use, next action;
- `ActionProposal` — typed, server-owned proposed external action;
- `Outcome` — observable result of the conversation/action;
- `PublicProof` — sanitized evidence that can be shown externally.

The exact TypeScript interfaces belong in code when Gate 8 implements them. This charter defines responsibility, not executable signatures.

## Sales ontology direction

Astra needs a business world model rather than generic SaaS fields.

The first ontology should cover at least:

- company and industry context;
- current workflows and operating model;
- AI maturity and existing automation;
- employee/workforce pain;
- repetitive or high-friction work;
- transformation goals;
- urgency/timeline;
- executive sponsor and decision process;
- budget/commercial signal when volunteered or legitimately discovered;
- security, privacy, compliance, labor, and trust concerns;
- existing vendors/internal initiatives;
- proof required;
- qualification state;
- opportunity risk;
- next-best action.

Observed facts, model hypotheses, and approved company claims must remain distinguishable.

## Consultative selling contract

Astra should optimize for useful diagnosis, not maximum message volume.

A strong interaction normally follows:

1. arrive with evidence-backed context;
2. state a relevant hypothesis without pretending certainty;
3. ask one high-value question;
4. update customer/opportunity state;
5. decide whether to explore, prove, qualify, challenge, or stop;
6. use approved evidence only when it helps;
7. earn a concrete next step rather than forcing one.

The best outcome can be "not a fit now." False qualification is failure.

## Public demonstration contract

Public proof is part of the product, but reputation-changing publication is an external action.

Early gates may:

- generate a sanitized result card;
- generate a LinkedIn/X draft;
- attach evidence and metrics;
- show exactly which run produced the claim.

Early gates must **not** autonomously publish.

Autonomous publishing can be considered only after a later bounded-autonomy gate defines:

- explicit capability/authorization;
- platform policy constraints;
- approval rules;
- PII/secret redaction;
- evidence requirements;
- idempotency/effect semantics;
- rate limits and rollback/incident procedure.

## Initial non-goals

Do not build yet:

- mass outbound;
- purchased lead blasting;
- autonomous LinkedIn/X posting;
- uncontrolled email sending;
- a swarm of runtime LLM agents;
- custom foundation-model training;
- our own browser engine;
- a replacement for Steel/Stagehand without measured evidence;
- E2B merely because it exists;
- many CRM/calendar/social connectors at once;
- a polished avatar before voice/sales behavior is proven;
- a separate vector-memory product.

## Long-term differentiation

The intended moat becomes:

1. high-quality prospect and buyer context;
2. an explicit AI-native transformation sales ontology;
3. evidence-backed consultative strategy;
4. natural realtime conversation;
5. reliable and permissioned execution;
6. durable relationship/opportunity memory;
7. rigorous SalesBench and real-market evaluation;
8. experience learning from verified outcomes;
9. a public proof loop showing what Astra actually accomplished;
10. infrastructure reliability inherited from the browser/run foundation.

## Success definition

A meaningful product milestone is:

> Given an approved target company, Astra can independently research the company, create an evidence-backed prospect brief, conduct a natural consultative sales interaction for our AI-native company/workforce transformation service, update durable qualification/opportunity state, earn and execute one explicitly authorized next step, record the outcome, and generate a sanitized proof artifact that accurately demonstrates what happened.

The roadmap reaches that milestone in small gates. No gate may claim autonomy that has not been demonstrated by evidence.
