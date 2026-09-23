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

---

## L-018 — Repeating one fixture proves integration reliability, not general agent capability

**Date:** 2026-09-19

**Symptom / context**

The project had strong 10/10 Stagehand→Steel evidence, but every iteration exercised the same simple-button behavior and the semantic acceptance used a deterministic fixture LLM.

**Cause**

Reliability of one integration path can look like breadth of agent capability when the repetition count is emphasized without the task distribution and model configuration.

**Fix**

Separate contract/infrastructure evaluation from model-backed capability evaluation. Build versioned tasks across materially different browser difficulties, measure the current engine before improving it, and reserve success-rate targets for a later qualification gate.

**Prevention**

Every benchmark claim must state what varied: task distribution, model/configuration, attempts, and evaluator. Never use repeated execution of one scripted fixture as evidence that a general web agent is reliable.

---

## L-019 — Do not mistake enabling infrastructure for the product

**Date:** 2026-09-19

**Symptom**

A roadmap can keep expanding browser/runtime capability because the infrastructure is measurable and technically interesting, while the actual user-value loop remains undefined.

**Cause**

The first seven gates correctly de-risked browser sessions, semantic interaction, durability, streaming, and artifacts. After those gates passed, the project still described the browser platform itself as the north star instead of asking what job Astra should own for the company.

**Fix**

Keep passed infrastructure as reusable substrate, preserve D-021's capability-first evaluation discipline, then rewrite future gates around one product outcome: Astra researches prospects, conducts consultative selling for our AI-native company/workforce transformation service, earns authorized next actions, records outcomes, and produces evidence-backed proof.

**Prevention**

After a foundation milestone, require the next roadmap gate to name a user/business outcome and a measurable capability gap. Do not add another infrastructure layer merely because it is available. Product mission may change; verified foundation evidence should not be discarded.

---

## L-020 — Recovery must be explicit; durable loop progress must be sanitized

**Date:** 2026-09-19

**Symptom / context**

A multi-step agent can encounter provider/action failures that may or may not be safe to recover from, while raw action/provider/model payloads may contain arguments, transient diagnostics, or other data that should not become durable progress records.

**Cause**

Inferring recovery from arbitrary failures conflates provider behavior with owned control policy. Persisting raw loop payloads similarly makes provider-specific details part of Astra's durable contract and can leak data that is not needed for diagnosis.

**Fix**

Require the policy to choose `onFailure: CONTINUE | FAIL` for every action. Persist compact owned summaries for observations, decisions, actions, and results; omit action arguments and provider failure text from durable loop-progress payloads.

**Prevention**

Treat recovery as a typed policy decision, never as an automatic reaction to a caught exception. Keep durable loop telemetry allowlisted and provider-neutral rather than serializing raw provider/model objects.


---

## L-021 — Abort must outlive telemetry; bounded execution cannot depend on cooperative providers

**Date:** 2026-09-19

**Symptom / context**

A cancellation request or timeout can arrive while provider/model work is still pending. Telemetry persistence can also fail at exactly that moment, and a model policy may ignore an abort signal entirely.

**Cause**

If abort propagation happens only after a progress event is persisted, or if Astra merely passes a signal without racing the owned async boundary, failed telemetry or a non-cooperative provider can leave execution running beyond its budget.

**Fix**

Abort active work in a `finally` path independent of cancellation-request telemetry, and race owned loop/provider calls against the run abort signal. Keep cleanup in the durable run lifecycle `finally` path.

**Prevention**

Cancellation, timeout, and cleanup are control-plane invariants. Observability must never be a prerequisite for stopping work, and providers should not be trusted to enforce Astra's execution deadline on their own.

---

## L-022 — Capture navigation evidence after a settle condition, not immediately after the click

**Date:** 2026-09-19

**Symptom / context**

The first Gate 10 Stagehand integration run completed the three-action research goal but missed the first per-action screenshot. Steel returned HTTP 500 for a screenshot issued about 14 ms after a link navigation, while later screenshots succeeded.

**Cause**

Action completion and destination-page readiness are different conditions. Capturing immediately when the click promise returns races browser navigation.

**Fix**

Defer a navigation action's screenshot until the next successful observe has proved the destination page is usable. For a terminal action with no next observe, capture after the loop returns. Add a deterministic regression whose browser rejects screenshots between action completion and the next observation.

**Prevention**

Use semantic settle/observation conditions for evidence capture around navigation. Do not hide deterministic evidence races with arbitrary sleeps or blind screenshot retries.


---

## L-023 — Preserve frozen benchmark failures; fix the harness, not the scorecard

**Date:** 2026-09-19

**Symptom / context**

The first frozen ResearchBench browser measurement passed 28/30, with both dynamic tasks false-completing. A later harness revision regressed to 27/30 when a duplicate `trigger` declaration prevented modal/dynamic fixture scripts from installing handlers.

**Cause**

Qualification harness defects can look like agent-capability failures. The dynamic trigger remained mounted after use in the first measurement, so the deterministic observer selected the consumed action again. A later script-scope cleanup accidentally declared the same binding twice.

**Fix**

Keep the frozen task definitions and evaluator expectations unchanged. Correct only the fixture/runner defect, classify and preserve each measured failure, rerun the same frozen suite, and add structural tests that validate task/page/expected-state consistency.

**Prevention**

Never improve a benchmark score by rewriting a failing measured task or expected answer. Separate benchmark ground truth, candidate code, and qualification harness so a defect can be localized and corrected without moving the goalposts.


---

## L-024 — Provider session IDs are not isolation proof

**Date:** 2026-09-19

**Symptom / context**

The first Gate 12 pinned Stagehand→Steel provider run kept ResearchBench at 30/30 but failed state isolation: a second Steel session on the same self-hosted endpoint could read cookie/localStorage written by the first.

**Cause**

The pinned self-hosted Steel service reused one Chrome profile across its session lifecycle. Distinct API/session IDs described browser lifecycle, not an independent storage/process isolation boundary.

**Fix**

Keep the owned sandbox contract unchanged, treat one self-hosted Steel endpoint as single-tenant, reject concurrent sessions on that endpoint, prove simultaneous isolation with separate pinned Steel provider processes/endpoints, and scrub visited-origin browser state before sequential endpoint reuse. Add direct provider-container checks for filesystem, process, and loopback-port separation.

**Prevention**

Never infer tenant or sandbox isolation from resource IDs, SDK abstractions, or provider terminology. Test the exact protected state and process/network boundary on the exact pinned provider configuration.

---

## L-025 — Security tests should prove blocked effects, not promise shape

**Date:** 2026-09-19

**Symptom / context**

Navigation to an allowed fixture that redirected toward a blocked target could resolve even though Stagehand's context policy prevented the redirected request from reaching the target.

**Cause**

Browser navigation APIs do not guarantee that a blocked redirect surfaces as a rejected `goto()` promise. Treating rejection shape as the security invariant confused provider/API behavior with the actual network effect.

**Fix**

Keep direct-navigation preflight for typed failures, but test redirect protection with a reachable disallowed sentinel and assert the sentinel receives zero requests.

**Prevention**

For safety boundaries, assert that the prohibited effect did not happen. Promise rejection, response status, and diagnostics may support the test, but they are not substitutes for effect-level evidence.

---

## L-026 — Cleanup commands must use the provider-supported CDP target

**Date:** 2026-09-19

**Symptom / context**

An attempted sequential browser-state scrub sent `Storage.clearDataForOrigin` through Stagehand's root browser connection. The pinned provider returned CDP `-32603 Internal error`, turning every otherwise-successful sandboxed research run into `CLEANUP_FAILED`.

**Cause**

A valid CDP method still has a target/session scope. Using the wrong connection surface can fail even when the command itself is correct.

**Fix**

Send origin-storage cleanup through Stagehand's supported `page.sendCDP(...)` target session, keep cookie cleanup through the context API, and keep cleanup fail-closed before the endpoint is considered safe for sequential reuse.

**Prevention**

Treat CDP method scope as part of the adapter contract. Test cleanup against the exact pinned provider rather than assuming a command accepted by one CDP connection type works on another.


---

## L-027 — DNS validation is not connection binding

**Date:** 2026-09-22

**Symptom / context**

Gate 12 re-resolved allowed hosts and rejected unsafe/private DNS answers, but an audit showed the checked address was not carried into Chromium's actual connection. An attacker-controlled approved hostname could therefore return a public address during Astra's check and a blocked address when the browser resolved it again.

**Cause**

The safety decision and the TCP connection were owned by different resolvers at different times. Returning only `void` from an allow/deny check discarded the exact safe address that justified the decision.

**Fix**

Make the network policy return the validated target/address set and route untrusted browser traffic through an owned connection-bound proxy that dials a validated literal address while preserving hostname/SNI identity. Keep request interception as defense in depth.

**Prevention**

For SSRF/DNS-rebinding boundaries, test the prohibited network effect and bind the actual socket destination to the policy decision. A domain allowlist or pre-connect DNS lookup by itself is not connection-level enforcement.

---

## L-028 — Best-effort evidence must have its own abort/deadline boundary

**Date:** 2026-09-22

**Symptom / context**

A deterministic audit browser whose screenshot promise never resolved left a run permanently `RUNNING` even after the configured run wall-clock timeout had fired; agent/browser cleanup never ran.

**Cause**

The main execution operations were abort-raced, but screenshot/page-evidence/artifact persistence was awaited as best-effort observability without its own deadline. Triggering the run AbortSignal could not settle a provider promise that ignored cancellation.

**Fix**

Give artifact work an independent bounded deadline, pass the run AbortSignal through the owned screenshot contract into Steel fetch, race page evidence/screenshot persistence against abort/deadline, and immediately re-check the run signal after active-path evidence capture.

**Prevention**

Observability cannot be a prerequisite for termination. Every optional diagnostics/evidence/provider operation that sits inside a durable lifecycle must either cooperate with cancellation or be raced by an owned deadline so cleanup and terminal persistence remain reachable.

---

## L-029 — Authority timestamps belong to the persistence boundary

**Date:** 2026-09-23

**Symptom / context**

Gate 13 had already moved sample freeze, measured-human baseline recording, and measured-attempt reservation chronology onto repository/database clocks, but the atomic approval batch still persisted the caller-supplied `approvedAt`. A direct repository caller could therefore forge when the formal real-company authorization supposedly happened.

**Cause**

The CLI generated a reasonable current timestamp, so the normal operator path looked safe, but the durable repository contract still treated caller chronology as authoritative.

**Fix**

Canonicalize the approval batch at persistence time. Assign one repository/database-owned instant, overwrite the batch `approvedAt` and every target `approval.approvedAt`, persist those canonical snapshots atomically, and return the persisted batch to the caller.

**Prevention**

Whenever a timestamp controls authorization, freeze/order semantics, uniqueness, or measured-experiment chronology, ask who owns the clock at the durable boundary. UI/CLI-generated “now” is presentation convenience, not authoritative chronology. Return the canonical persisted object so later state is constructed from durable truth rather than a stale draft.

---

## L-030 — Freeze the supported provider surface, not merely the newest model

**Date:** 2026-09-23

**Symptom / context**

A newer public model can look cheaper or more capable on a pricing page, but the first measured Gate 13 run is also testing a pinned Stagehand/AI-SDK/browser composition. Selecting a model outside that pinned adapter's qualified model surface would mix provider-integration novelty into the product-value experiment.

**Cause**

“Best model” and “best experimental choice” are not the same optimization problem. The latter must include adapter support, reproducibility, billing semantics, and the cost of contaminating a first-attempt acceptance cohort.

**Fix**

Choose the highest-capability model explicitly supported by the pinned adapter for the first acceptance, freeze its exact provider/model/base-URL identity, and use conservative cost accounting where usage fields overlap. Optimize to cheaper/newer models only after the value gate has honest evidence.

**Prevention**

Before freezing any model-backed acceptance profile, verify four things together: exact adapter support, exact model identity/endpoint, durable usage semantics, and source-dated pricing. Never let a “latest model” upgrade silently redefine a measured gate.

---

## L-031 — Separate useful experiments instead of falsifying a missing measurement

**Date:** 2026-09-23

**Symptom / context**

The first 43-target Gate 13 sample is authorized and frozen, but measured-human baselines remain 0/43. An agent can perform comparable browser research immediately, which creates pressure to treat agent elapsed time as a substitute for human preparation minutes.

**Cause**

The workflow shape looks similar even though the measured quantity is different. Agent elapsed time is not observed human labor, and zero is not a valid encoding for an unmeasured human quantity.

**Fix**

Create a separate agent-comparison protocol and storage boundary. Keep human measurements `null / NOT_MEASURED`, preserve the original Gate 13 worklist unchanged, and label automated review as model review rather than human review.

**Prevention**

Before reusing a benchmark recorder or field, ask whether the new arm measures the same real-world quantity. If not, create a new experiment identity and leave unavailable measurements unavailable. Never optimize convenience by changing the meaning of the denominator.

---

## L-032 — Browser-profile isolation includes credential-store isolation

**Date:** 2026-09-23

**Symptom / context**

The dedicated Chrome for Testing comparator profile was separate from normal Chrome, yet macOS still presented a prompt for access to `Chromium Safe Storage` in the user's login Keychain.

**Cause**

A separate browser profile prevents reuse of normal browsing state, but Chromium's default platform credential-encryption path can still consult the system Keychain. Profile isolation alone is therefore not credential-store isolation.

**Fix**

Launch the comparator browser with `--use-mock-keychain` and `--password-store=basic`, disable sync/password-manager service behavior, freeze system Keychain access as forbidden in the protocol, and test those launch arguments.

**Prevention**

When building an isolated browser benchmark, audit not only cookies/profile directories and network egress but also the browser's OS credential/encryption backend. A browser that prompts for personal Keychain access is not a clean comparator environment.
