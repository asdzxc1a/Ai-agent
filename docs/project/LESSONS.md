# Lessons / Mistakes Ledger

Append reusable lessons, not ordinary progress. Preserve entry substance; identifier-only legacy repairs may add a letter suffix when an old duplicate ID must be disambiguated.

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


---

## L-005 — Prefer ecosystem-compatible package-manager versions over newest-major novelty

**Date:** 2026-09-18

**Symptom**

pnpm 12 generated a multi-document `pnpm-lock.yaml`. The workspace itself installed successfully, but GitHub/Dependabot ecosystem tooling has active compatibility problems with that lockfile shape and can misread the dependency graph.

**Cause**

Choosing the newest package-manager major based only on package availability rather than checking the surrounding CI/security-tool ecosystem.

**Fix**

Pin pnpm `10.34.5` for Gate 0. It produces the conventional single-document lockfile while retaining modern pnpm behavior.

**Prevention**

When changing foundational tooling, evaluate compatibility with GitHub dependency graph, Dependabot/security scanners, lockfile consumers, and CI—not just local install success.

---

## L-006 — Keep peer dependencies strict and explicit

**Date:** 2026-09-18

**Symptom**

The pnpm 10 bootstrap failed because Vitest 5 requires Vite as a peer dependency and Vite was not declared explicitly.

**Cause**

The first bootstrap happened under a toolchain that auto-installed the peer transitively, hiding the undeclared dependency.

**Fix**

Keep `strict-peer-dependencies=true`, keep `auto-install-peers=false`, and declare `vite@8.3.0` directly.

**Prevention**

Treat strict peer-dependency failures as useful contract checks. Do not silence them globally to make CI green.


---

## L-007 — Configure runtime environments centrally, not per fixture

**Date:** 2026-09-18

**Symptom**

ESLint rejected the Node-based fixture server because `process` and `console` were not defined for generic `.mjs` files.

**Cause**

The lint configuration treated repository JavaScript as environment-neutral even though utility/fixture scripts intentionally run under Node.js.

**Fix**

Define Node script globals centrally in `eslint.config.js` for repository `.js`/`.mjs` files.

**Prevention**

When a runtime is an architectural choice, encode it once in tooling rather than adding inline lint exceptions to each script.

---

## L-008 — Installed type packages do not imply compiler inclusion under strict TypeScript

**Date:** 2026-09-18

**Symptom**

TypeScript could not resolve `process`, `node:fs/promises`, `node:path`, `fetch`, or `Response` even after `@types/node` was installed.

**Cause**

The strict TS configuration did not explicitly include Node types.

**Fix**

Add `"types": ["node"]` to the shared TypeScript compiler options.

**Prevention**

Treat runtime typings as an explicit compiler contract. Do not rely on automatic ambient-type discovery.

---

## L-009 — Validate external infrastructure before writing integration logic

**Date:** 2026-09-18

**Symptom**

A moving container tag could make browser tests non-reproducible or fail for reasons unrelated to our code.

**Cause**

Upstream Steel publishes its Docker workflow primarily through the moving `:latest` tag.

**Fix**

Resolve the image once, boot/health-check it, and pin the resulting immutable digest before writing the browser acceptance test.

**Prevention**

For critical external runtime images, pin by digest and record the tested digest in repository state.


---

## L-007A — Runtime-aware lint and type environments must be explicit

**Date:** 2026-09-18

**Symptom**

The first Gate 1 quality run failed because the Node fixture script was linted without Node globals, and TypeScript code using Node APIs needed the Node type environment explicitly enabled.

**Cause**

The repository-level lint/type configuration assumed TypeScript library code and did not yet describe executable Node scripts.

**Fix**

Declare Node globals for repository `.js/.mjs` scripts and set `types: ["node"]` in the shared TypeScript config with a Node-24-compatible `@types/node` pin.

**Prevention**

Whenever a new runtime class is introduced (Node script, browser, worker, edge runtime), encode that runtime explicitly in lint/type configuration rather than disabling safety rules.


---

## L-008A — Third-party optional providers can create contradictory peer contracts

**Date:** 2026-09-18

**Symptom**

Strict pnpm install for Stagehand v3 failed in opposite directions: its Ollama adapter required Zod 4 while OpenAI 4.104.0 declared Zod 3.

**Cause**

Stagehand statically imports a broad provider layer. The framework itself supports both Zod 3 and Zod 4, but transitive provider packages do not all agree on the same peer range.

**Fix**

Keep strict peer checking globally. Pin Stagehand to the pre-refresh v3.7.0 compatibility release, use Zod 4.4.3 (supported by Stagehand and required by Ollama), and add one exact pnpm `peerDependencyRules.allowedVersions` exception for `openai@4.104.0>zod`. OpenAI's own package metadata marks Zod as an optional peer, and Gate 2 uses a custom LLMClient rather than OpenAI's Zod helper surface.

**Prevention**

For dependency conflicts, inspect upstream package manifests and runtime imports before weakening package-manager safety. Prefer a version pin plus a package-scoped, source-justified exception over global `strictPeerDependencies=false`.

---

## L-009A — Heavy browser CI should run once per merge candidate

**Date:** 2026-09-18

**Symptom**

Docker-backed browser workflows ran on both feature-branch pushes and pull requests, causing duplicate multi-hundred-megabyte image pulls and stale jobs occupying concurrency slots.

**Cause**

The heavy workflows used unrestricted `push` plus `pull_request` triggers.

**Fix**

Run heavy Steel/Stagehand browser workflows on pull requests, on pushes to `main`, or manually. Add path filters so documentation-only changes do not restart browser infrastructure tests. Keep lightweight normal CI on every push.

**Prevention**

Separate fast code-quality feedback from expensive environment/integration gates. Heavy tests should correspond to a merge candidate, not every intermediate documentation commit.


---

## L-010 — Source-workspace type resolution and test-runtime resolution are separate problems

**Date:** 2026-09-18

**Symptom**

Gate 3 initially typechecked against package exports that pointed to `dist`, which does not exist yet in a clean source checkout. After fixing TypeScript source resolution, Vitest still failed at runtime to resolve `@astra/browser-steel` before packages were built.

**Cause**

TypeScript and Vite/Vitest have separate module-resolution pipelines. Fixing one does not automatically configure the other.

**Fix**

Keep production package exports pointed at built `dist` artifacts. For repository development only:
- root `tsconfig.json` maps owned workspace package names to source entrypoints;
- the Stagehand Vitest config maps the same runtime dependencies to source entrypoints.

**Prevention**

Treat compile-time workspace resolution and test-runtime workspace resolution as separate contracts. Do not distort production package exports merely to make source-tree tests convenient.

---

## L-011 — Follow TypeScript 6 path-mapping migration instead of silencing deprecations

**Date:** 2026-09-18

**Symptom**

The first source-path fix used `baseUrl`; TypeScript 6 rejected it as deprecated. Removing it then exposed that path targets must be explicitly relative.

**Cause**

Applying older TypeScript path-mapping conventions to the TypeScript 6 toolchain.

**Fix**

Do not use deprecated `baseUrl`. Keep root `paths` targets explicitly relative, e.g. `./packages/browser-runtime/src/index.ts`.

**Prevention**

When compiler migrations surface deprecations, adopt the forward-compatible configuration instead of adding `ignoreDeprecations` unless migration is genuinely blocked.


---

## L-012 — Runtime validation output must be normalized to exact public contracts

**Date:** 2026-09-18

**Symptom**

Zod successfully validated the public output schema, but TypeScript rejected the parsed value under `exactOptionalPropertyTypes`: optional fields were represented as properties whose value could be `undefined`, while the public contract means the property is absent when omitted.

**Cause**

A runtime validator's inferred TypeScript shape is not always identical to the public domain model, especially under exact optional-property semantics.

**Fix**

Normalize validated schema objects at the API boundary. Omitted `const`, `required`, and `additionalProperties` fields are genuinely omitted before the value enters the domain/run layer.

**Prevention**

Treat validation output as untrusted transport shape until it has been normalized into the domain contract. Do not weaken `exactOptionalPropertyTypes` to make validator inference convenient.

---

## L-013 — Product acceptance should reuse proven infrastructure in one browser job

**Date:** 2026-09-18

**Symptom**

A separate API-browser workflow would require another large Steel image pull and duplicate browser provisioning.

**Cause**

Testing each layer in a separate CI environment is clean conceptually but expensive operationally.

**Fix**

Keep raw Steel as its own provider regression. In the Stagehand/Steel semantic workflow, reuse the same pinned Steel container and deterministic fixture for two sequential checks: the 10-session semantic regression, then the real HTTP API browser acceptance.

**Prevention**

When integration tests need the same expensive environment, isolate logical assertions but share the environment lifecycle when it does not reduce fault localization.


---

## L-014 — Integration test configs must isolate environment contracts

**Date:** 2026-09-18

**Symptom**

The first Gate 5 combined workflow failed during the Gate 4 API-browser step even though that browser test itself passed. Vitest also loaded `api-restart.integration.ts`, which immediately failed because `TEST_DATABASE_URL` was intentionally absent from the Gate 4 browser step.

**Cause**

The API-browser test config used a pattern broad enough to include a new integration suite with a different environment contract.

**Fix**

Give browser-only and restart/durability tests separate Vitest configs and commands. Gate 4 browser acceptance runs without a database; Gate 5 restart acceptance runs later with PostgreSQL explicitly configured.

**Prevention**

Treat each integration suite's required external services as part of its test contract. Test globs must not silently broaden when new integration files are added.

---

## L-015 — Persist lifecycle history before building streaming on top of it

**Date:** 2026-09-18

**Symptom**

It would be easy to implement SSE using only in-memory emitters and later discover that disconnected clients cannot replay missed progress.

**Cause**

Conflating real-time delivery with authoritative event storage.

**Fix**

Gate 5 persists ordered `run_events` and `run_steps` before Gate 6 introduces SSE. Terminal events are persisted before terminal run status is written.

**Prevention**

For durable workflows, make the append-only event log authoritative first; streaming should be a projection of stored events, not the source of truth.

---

## L-016 — Secret redaction must cover carriers, not only field names

**Date:** 2026-09-18

**Symptom**

A first-pass artifact redactor handled sensitive object keys and simple `token=value` strings, but unstructured diagnostics could still leak credentials through Authorization headers, cookie lines, quoted passwords containing spaces, PEM private-key bodies, URL userinfo passwords, or signature-like query parameters.

**Cause**

Browser diagnostics mix structured data with free-form strings. Key-based redaction alone does not cover the ways credentials are serialized inside those strings.

**Fix**

Redact both structure and carrier syntax before JSON artifact persistence: sensitive object keys, Authorization/Cookie/Set-Cookie line values, Bearer credentials, quoted sensitive key/value pairs, PEM private-key blocks, URL passwords, and sensitive query parameters. Use distinct fake secrets in tests and assert that none occur in the final artifact bytes or metadata.

**Prevention**

Threat-model diagnostic strings as potentially credential-bearing input. Security tests should scan the serialized artifact output, not merely inspect the pre-serialization object.


---
 
## L-017 — Hot project memory must be compressed before it becomes history

**Date:** 2026-09-19

**Symptom**

The current-state document accumulated detailed CI evidence for every completed gate, while decision and lesson ledgers developed duplicate identifiers. Fresh-context recovery still worked, but the amount of hot context and ambiguity were beginning to grow.

**Cause**

A memory system can become a second product if completed history is continuously appended to the same files that are supposed to answer current questions. Human/agent discipline alone also does not reliably prevent identifier collisions.

**Fix**

Keep one small current-state hub, move detailed completed evidence to cold history, use the active issue for working memory, preserve stable unique ledger IDs, and run a deterministic memory-structure check in normal validation.

**Prevention**

Treat memory quality as recovery quality rather than storage volume. Archive old detail, discard transient reasoning, and automate cheap structural invariants instead of building a more complex memory service.
