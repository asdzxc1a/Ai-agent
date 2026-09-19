# Portable Project Memory System

**Version:** 1.0  
**Purpose:** A small, Git-centered memory and handoff system for long-running software projects worked on by humans and AI coding agents.

This document is intentionally self-contained. Copy it into another repository, adapt the paths/names, and use it to bootstrap the same memory discipline without depending on chat history, proprietary memory, embeddings, or a separate knowledge service.

---

## 1. Design goal

A fresh contributor with no previous conversation context should be able to recover the project accurately and start useful work after reading a small, ordered set of repository files.

The system optimizes for:

- correctness over recollection;
- evidence over confidence;
- one current source of truth;
- small hot context;
- durable architectural rationale;
- reusable lessons;
- aggressive compression of old detail;
- auditability through Git history.

The system is not intended to remember everything. It should preserve only information that changes future decisions or prevents repeated mistakes.

---

## 2. Core principles

### 2.1 Git is canonical memory

Project truth lives in versioned repository files, code, tests, issues, pull requests, and CI evidence.

Chat transcripts are context, not authoritative project state.

Do not require a future contributor to have access to an old conversation in order to continue the project safely.

### 2.2 Evidence outranks prose

When sources disagree, use this default priority:

1. reproducible passing tests and current code;
2. current project state;
3. accepted architecture/product decisions;
4. the active gate/work plan;
5. historical notes;
6. old conversations or informal summaries.

Documentation must be corrected when it contradicts stronger evidence.

### 2.3 One mutable head

Maintain exactly one small document that answers:

- Where are we?
- What works now?
- What is broken or uncertain?
- What is the current gate/milestone?
- What is the next action?

That document is STATE.md.

Do not create multiple competing current-status files.

### 2.4 Separate time horizons

Use different memory locations for different lifetimes:

- STATE.md: current project truth;
- active GitHub issue: current working memory for one gate/subtask;
- PLAN.md: future roadmap and acceptance criteria;
- DECISIONS.md: durable architecture/product rationale;
- LESSONS.md: reusable engineering lessons;
- history/: cold milestone and incident detail;
- tests/CI: strongest execution evidence.

### 2.5 Preserve why, not narration

Do not keep chronological diaries of every command, failed attempt, or conversation.

Record:

- verified outcomes;
- durable decisions;
- reusable lessons;
- blockers;
- exact evidence;
- next action.

Discard ordinary scratch reasoning.

### 2.6 User priority can override the roadmap

A user/product owner may explicitly change priorities.

When that happens, update STATE.md and the active issue so the next contributor does not continue the old priority by accident.

---

## 3. Recommended repository structure

A minimal installation looks like:

~~~
AGENTS.md
README.md

docs/project/
  PROJECT_MEMORY_SYSTEM.md
  STATE.md
  PLAN.md
  TEST_STRATEGY.md
  DECISIONS.md
  LESSONS.md
  HANDOFF_PROTOCOL.md
  history/

.github/
  pull_request_template.md

scripts/
  check-project-memory.mjs
~~~

GitHub issues and pull requests are part of the memory system even though they are not files.

Do not create folders or ledgers that do not have a distinct responsibility.

---

## 4. File responsibilities

### AGENTS.md — bootloader

AGENTS.md is the entry point for any fresh coding agent or contributor.

It should contain:

- project mission;
- exact fresh-context startup order;
- source-of-truth priority;
- critical engineering constraints;
- one-gate/one-subtask working rule;
- memory write-back rules;
- pointer to this portable specification.

AGENTS.md should be short and stable.

It is not a project diary.

### STATE.md — hot memory hub

STATE.md is the only mutable project-status hub.

It should contain:

- last updated date;
- current phase;
- current gate/milestone;
- one-paragraph overall status;
- current architecture/capabilities at a high level;
- completed milestone summary;
- known blockers/risks;
- next action;
- links to recent evidence and cold history.

STATE.md should remain compact.

A useful soft target is roughly 100–250 lines. When historical evidence pushes it materially beyond that, archive the old detail under history/ and replace it with a concise pointer.

### PLAN.md — future memory

PLAN.md contains the ordered roadmap.

For each gate/milestone record:

- status;
- purpose;
- build scope;
- explicit non-goals when useful;
- acceptance criteria.

PLAN.md is not a session log and should not contain long CI transcripts.

Normally only one gate is IN_PROGRESS.

### Active GitHub issue — working memory

Use one focused issue for the current gate or substantial subtask.

It should contain:

- goal;
- scope;
- non-goals;
- acceptance checklist;
- important implementation discoveries;
- blocker, if any;
- PR/evidence links.

The issue is short-lived operational memory.

When the work is complete, durable facts move to the appropriate repository memory file. Do not copy the whole issue into STATE.md.

### TEST_STRATEGY.md — evidence contract

TEST_STRATEGY.md defines what kinds of evidence count as done.

It should distinguish:

- unit tests;
- contract tests;
- deterministic integration tests;
- environment/sandbox tests;
- live/external tests;
- benchmark/evaluation evidence.

It should also state gate-completion rules and anti-flake rules.

### DECISIONS.md — durable architecture/product memory

Use an append-oriented decision ledger.

A decision entry should contain:

- stable unique ID;
- date;
- status;
- decision;
- why;
- consequences;
- revisit condition when appropriate;
- evidence when useful.

Do not record ordinary implementation choices that can be understood directly from code.

Decision IDs are immutable once referenced.

### LESSONS.md — reusable learning memory

Record lessons that should change future behavior.

A useful structure is:

- stable unique ID;
- date;
- symptom/context;
- cause;
- fix;
- prevention/general rule.

Lessons may be negative or positive. The criterion is reuse, not embarrassment.

Do not store ordinary progress here.

### history/ — cold memory

Use history/ for:

- completed milestone evidence;
- major incidents;
- benchmark snapshots;
- migrations;
- retired architecture context;
- detailed records that would bloat STATE.md.

Fresh contributors should not read history by default.

### Pull request template — write-back enforcement

The PR template should require:

- scope/gate;
- tests/evidence;
- project-memory update;
- current blocker;
- next action;
- risk.

This makes memory maintenance part of delivery rather than an optional cleanup task.

---

## 5. Fresh-context startup protocol

A fresh contributor should read in this order:

1. AGENTS.md.
2. STATE.md.
3. Only the current gate/milestone section in PLAN.md.
4. TEST_STRATEGY.md.
5. The active GitHub issue for the current gate/subtask, if one exists.
6. Relevant code and tests.
7. Relevant entries in DECISIONS.md only when architecture/product intent matters.
8. Search LESSONS.md only for problems resembling the current work.
9. Read CHARTER/product vision only when purpose or scope is unclear.
10. Read history/ only when current evidence points there.

Do not begin by reading every historical file.

The startup sequence is intentionally asymmetric: hot memory is loaded first; cold memory is pulled only when needed.

---

## 6. Source-of-truth conflict protocol

When two sources disagree:

1. reproduce or inspect the strongest available evidence;
2. prefer current passing tests/code over prose;
3. prefer STATE.md over roadmap/history for current status;
4. prefer an accepted decision over an older plan assumption;
5. correct the stale memory in the same PR when practical;
6. if the correction changes architecture, append a new decision rather than silently rewriting rationale.

Never invent a compromise between contradictory sources.

Resolve the contradiction.

---

## 7. Work lifecycle

### Before work

- read the startup sequence;
- identify exactly one gate/subtask;
- create or focus one issue;
- create a focused branch;
- record IN_PROGRESS only when implementation actually starts.

### During work

Keep scratch reasoning out of durable memory.

Update the active issue when a discovery materially changes the implementation or acceptance path.

Do not update STATE.md after every edit.

### Before completion

Complete this sequence:

1. implementation;
2. automated tests;
3. clean-environment/relevant integration evidence;
4. PLAN status update if the gate changed;
5. STATE truth update;
6. DECISIONS append only for durable decisions;
7. LESSONS append only for reusable learning;
8. history note only when detail would bloat hot memory;
9. memory consistency check;
10. PR with evidence and handoff.

### After merge

STATE.md must point to the next concrete action.

The next contributor should never have to inspect the just-finished chat to discover what comes next.

---

## 8. Information routing rule

For every fact discovered during work, ask:

- Does it describe current project state? → STATE.md
- Does it define future scope/acceptance? → PLAN.md
- Does it explain a durable architecture/product choice? → DECISIONS.md
- Is it a reusable engineering lesson? → LESSONS.md
- Is it detailed completed history? → history/
- Is it only useful while implementing the current task? → active issue
- Is it scratch reasoning or transient detail? → discard it

Most information should be discarded.

Good project memory is selective.

---

## 9. Compression and archival policy

STATE.md is not a historical ledger.

When a milestone is complete:

1. keep a one-line/short milestone summary in STATE.md;
2. keep the strongest evidence pointer;
3. move verbose CI results, timing tables, artifact IDs, or incident chronology to history/ when still useful;
4. never duplicate the same long evidence in STATE, PLAN, DECISIONS, LESSONS, and history.

A recommended history filename is:

~~~
docs/project/history/YYYY-MM-DD-<milestone-or-incident>.md
~~~

History files should explain why they exist and link back to the relevant PR/issue/commit where possible.

---

## 10. Stable identifier policy

Decision and lesson identifiers must be unique and stable.

Recommended forms:

~~~
D-001
D-002
L-001
L-002
~~~

Rules:

- never reuse an ID;
- never renumber an entry after it has been referenced;
- append new IDs monotonically;
- a deterministic check should reject duplicates;
- if a legacy repository already contains duplicate IDs, normalize the duplicate heading once with a stable suffix such as D-008A or L-007A, preserve the entry text, and document that the suffix is a legacy repair;
- new entries should return to the normal numeric sequence rather than continuing suffixes.

The point is unambiguous referencing, not perfect historical aesthetics.

---

## 11. Memory validation invariants

Automate structural rules that are cheap to check.

A memory checker should verify at least:

- required memory files exist;
- STATE.md declares a current gate/milestone;
- the current gate exists in PLAN.md;
- gate statuses use an allowed set;
- no more than one gate is IN_PROGRESS;
- STATE.md contains a Next action section;
- decision IDs are unique;
- lesson IDs are unique;
- the portable memory-system specification exists.

Project-specific repositories may add invariants.

Do not make the checker interpret architecture or decide whether prose is true. Tests/code remain the evidence for that.

---

## 12. Gate/milestone discipline

A gate is complete only when:

1. required implementation exists;
2. required automated tests exist;
3. tests pass from the intended clean environment;
4. gate-specific acceptance criteria pass;
5. results are recorded in CI/PR evidence;
6. STATE.md reflects the new truth;
7. PLAN.md reflects the correct status;
8. no known blocker is hidden by retries.

Retries may measure reliability.

Retries must not turn a deterministic failure into a claimed pass.

---

## 13. Recommended templates

### 13.1 AGENTS.md starter

~~~md
# <PROJECT> Operating Contract

## Mission

<One concise paragraph describing what the project is building.>

## Fresh-context startup

After reading this file:

1. Read docs/project/STATE.md.
2. Read only the current gate in docs/project/PLAN.md.
3. Read docs/project/TEST_STRATEGY.md.
4. Read the active GitHub issue, if one exists.
5. Inspect relevant code/tests.
6. Read relevant DECISIONS only when needed.
7. Search LESSONS only for related problems.
8. Read history only when explicitly needed.

## Source-of-truth priority

1. Passing tests/current code.
2. STATE.md.
3. Accepted DECISIONS.md entries.
4. PLAN.md.
5. history/.
6. old conversations.

## Working rule

Work on one gate or well-bounded subtask at a time.

Every meaningful change ends with implementation, tests, evidence, and memory write-back.

## Memory

The portable memory protocol is docs/project/PROJECT_MEMORY_SYSTEM.md.
~~~

### 13.2 STATE.md starter

~~~md
# Current Project State

**Last updated:** YYYY-MM-DD
**Phase:** <phase>
**Current gate:** Gate N — <name>
**Overall status:** <one paragraph>

## What works now

- ...

## Current architecture

<small diagram or concise bullets>

## Completed milestones

| Gate | Status | Evidence |
| --- | --- | --- |
| 0 | PASSED | PR #... |

Detailed old evidence: docs/project/history/<file>.md

## Known blockers / risks

1. ...

## Next action

**Gate N — ...:** <one concrete next task>
~~~

### 13.3 PLAN.md gate starter

~~~md
## Gate N — <name>

**Status:** NOT_STARTED

Purpose:

- ...

Build:

- ...

Non-goals:

- ...

Acceptance:

- ...
~~~

### 13.4 DECISIONS.md entry

~~~md
## D-001 — <short title>

**Date:** YYYY-MM-DD
**Status:** Accepted

**Decision**

...

**Why**

...

**Consequences**

- ...

**Revisit when**

...
~~~

### 13.5 LESSONS.md entry

~~~md
## L-001 — <short reusable lesson>

**Date:** YYYY-MM-DD

**Symptom / context**

...

**Cause**

...

**Fix**

...

**Prevention**

...
~~~

### 13.6 Active issue starter

~~~md
## Goal

...

## Scope

- ...

## Non-goals

- ...

## Acceptance

- [ ] ...

## Important discoveries

Only durable implementation discoveries.

## Blocker

None / ...

## Evidence

PR / CI / artifacts.
~~~

### 13.7 PR handoff starter

~~~md
## Goal

What gate/subtask does this PR complete?

## Changes

- ...

## Tests / evidence

- [ ] memory consistency
- [ ] lint
- [ ] typecheck
- [ ] unit tests
- [ ] relevant integration/acceptance tests

## Project-memory update

- [ ] STATE reflects current truth
- [ ] PLAN updated if status changed
- [ ] DECISIONS updated only if needed
- [ ] LESSONS updated only if needed
- [ ] old detail archived instead of bloating STATE

## Fresh-context handoff

**Current gate:**
**What now works:**
**Known blocker:**
**Next action:**

## Risk

...
~~~

---

## 14. What not to build

Do not build a separate memory product unless repository evidence proves this system is insufficient.

Avoid by default:

- vector databases for project state;
- embeddings over every chat;
- auto-generated diaries;
- multiple current-state documents;
- a knowledge graph duplicating Git;
- storing chain-of-thought;
- copying full CI logs into Markdown;
- requiring old conversations for handoff.

These systems add another synchronization problem and can become a competing source of truth.

Search and retrieval tools may help navigate Git later, but they should not replace Git as the canonical memory.

---

## 15. Porting this system to another project

To adopt this protocol:

1. copy this file;
2. create AGENTS.md using the starter template;
3. create STATE.md with the real current truth;
4. create PLAN.md with only meaningful future milestones;
5. create TEST_STRATEGY.md;
6. create empty DECISIONS.md and LESSONS.md ledgers;
7. create HANDOFF_PROTOCOL.md or point it directly to this specification;
8. create history/;
9. add the PR template;
10. add a deterministic memory checker;
11. make normal CI run the memory checker;
12. create one active issue for the current gate.

Do not import historical chat transcripts as project memory.

Start with verified current truth and add durable context only as needed.

---

## 16. Success test for the memory system

Periodically perform a cold-start test:

Give a capable contributor access to only the repository and ask them to answer:

- What are we building?
- What works?
- What is not built?
- What is the current gate?
- What are the constraints?
- What evidence proves previous work?
- What is the next action?
- Which historical files do they actually need?

If the contributor can answer correctly without old chat context, the memory system is working.

If not, improve the hot-memory documents or their ordering rather than adding more memory volume.

---

## 17. Governing rule

The memory system exists to make correct engineering continuation cheap.

Its quality is measured by:

- recovery accuracy;
- low context load;
- low duplication;
- low drift;
- clear evidence;
- unambiguous next action.

Not by how much information it stores.
