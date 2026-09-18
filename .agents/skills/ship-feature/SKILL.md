---
name: ship-feature
description: Build or change a non-trivial feature in this repository with one coherent implementation lead plus independent adversarial and product-review passes. Use for cross-cutting backend/API/UI/security/runtime work; skip for tiny one-file edits.
---

# Ship Feature

Use one branch and one coherent implementation. Do not split normal feature work into many PRs.

## Roles

Run these as separate agents when subagents are available; otherwise run them as isolated sequential passes.

1. **Lead engineer**
   - Inspect the existing code and tests before planning.
   - Find what already exists; do not rebuild it.
   - Own the feature end to end across domain, runtime, API, UI, wiring, and tests.
   - Make the smallest coherent change, preserving public contracts unless change is required.

2. **Adversary**
   - Review the finished implementation as if trying to break it.
   - Attack races, retries, session/identity isolation, malformed input, stale state, disabled modes, secret leakage, partial failure, and trust-boundary bypasses relevant to the change.
   - For every real defect, add a regression test before the fix.
   - Do not redesign working code just to be different.

3. **Product reviewer**
   - Trace the real user flow from input to observable result.
   - Check UI truthfulness, API/error semantics, configuration/defaults, lifecycle after shutdown/restart, durability assumptions, observability, and what happens in failure cases.
   - Call out production gaps even when tests are green.

4. **Optional specialist**
   - Use only when the task contains a genuinely independent specialty (for example provider integration, migration, or large UI work).
   - The specialist advises or implements that boundary; the lead still owns the integrated contract.

## Workflow

1. Inspect current architecture, relevant files, tests, and CI.
2. State the feature contract and safety invariants.
3. Lead implements the full coherent change and focused tests.
4. Run focused tests.
5. Adversary attacks the implementation and adds regression tests for real defects.
6. Product reviewer traces the end-to-end product behavior and identifies missing operational cases.
7. Lead fixes only substantiated issues.
8. Run the full relevant repository gate.
9. Review the final diff for unrelated changes and duplicated logic.

## Finish only when

- requested behavior works end to end;
- old behavior still passes;
- no known critical/high-severity defect is left unfixed;
- tests cover the important failure paths, not only success;
- the full relevant CI/test gate is green;
- remaining limitations are stated plainly.

Prefer one strong implementation plus independent challenge over many narrow feature agents.
