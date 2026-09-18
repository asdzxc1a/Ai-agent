# Lessons / Mistakes Ledger

Append only. Record reusable lessons, not ordinary progress.

Format:

- **Symptom**
- **Cause**
- **Fix**
- **Prevention**

## L-001 — Do not integrate all three foundations at once

**Date:** 2026-09-18

**Symptom**

The project appears to require understanding Stagehand, Steel, E2B, Firecracker, CDP, agent orchestration, and production infrastructure before anything works.

**Cause**

Thinking in terms of "combine three repositories" instead of "connect three layers through contracts."

**Fix**

First prove Stagehand→Steel locally. Add E2B only after that path is stable.

**Prevention**

The plan uses hard gates; E2B begins at Gate 9.

---

## L-002 — Do not fork upstream code without evidence

**Date:** 2026-09-18

**Symptom**

Maintenance scope explodes and upstream fixes become hard to absorb.

**Cause**

Treating source availability as a reason to own the source.

**Fix**

Use packages/services/APIs behind our adapters.

**Prevention**

Fork only after a measured blocker is documented in `DECISIONS.md`.

---

## L-003 — Live websites are poor primary tests

**Date:** 2026-09-18

**Symptom**

A test fails for reasons unrelated to our code: layout changes, geolocation, consent UI, rate limits, A/B tests.

**Cause**

Using production websites as deterministic test fixtures.

**Fix**

Build local websites for browser behaviors and keep a small separate live-web nightly suite.

**Prevention**

No gate depends only on a third-party live site.

---

## L-004 — Project memory can become a second broken product

**Date:** 2026-09-18

**Symptom**

Fresh agents spend more time reading stale docs than understanding the current implementation.

**Cause**

Duplicating state across many files and keeping full session diaries.

**Fix**

One small mutable `STATE.md`; plan for future work; append-only decisions/lessons; tests as evidence.

**Prevention**

Do not duplicate facts. Keep current state concise.
