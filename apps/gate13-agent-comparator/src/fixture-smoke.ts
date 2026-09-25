import {
  chmod,
  mkdtemp
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join,
  resolve
} from "node:path";

import {
  ComparatorFileStore,
  ComparatorProtocolSchema,
  runComparatorFirstAttempt
} from "@astra/agent-comparator";

import {
  CodexBrowserSkillWorker
} from "./codex-browser-worker.js";

const root =
  await mkdtemp(
    join(
      tmpdir(),
      "astra-agent-comparator-fixture-"
    )
  );
const fixtureBsk =
  resolve(
    process.cwd(),
    "apps/gate13-agent-comparator/test/fixtures/fake-bsk.mjs"
  );
await chmod(
  fixtureBsk,
  0o700
);
const protocol =
  ComparatorProtocolSchema
    .parse({
      version:
        "gate13-agent-comparator-v1",
      status:
        "PREPARED_NOT_AUTHORIZED",
      purpose:
        "AGENT_COMPARISON",
      comparator:
        "GENERAL_PURPOSE_BROWSER_AGENT",
      measurement:
        "MEASURED_AGENT",
      humanBaseline:
        "NOT_MEASURED",
      humanReview:
        "NOT_PERFORMED",
      sourceManifest: {
        id:
          "fixture-manifest",
        sha256:
          "c".repeat(64),
        targetCount: 43
      },
      requestedFields: [
        "companyName",
        "companySummary",
        "transformationOpportunities",
        "buyingSignals"
      ],
      browser: {
        interactionMode:
          "BROWSER_UI_AND_RENDERED_TEXT",
        skill:
          "BrowserSkill",
        cliVersion:
          "0.3.1",
        daemonVersion:
          "0.3.1",
        daemonProtocolVersion:
          "1.3",
        daemonWsPort:
          52800,
        extensionVersion:
          "0.3.1",
        chromeMajorVersion:
          153,
        browserProduct:
          "CHROME_FOR_TESTING",
        browserBuildVersion:
          "153.0.8010.52",
        credentialStore:
          "MOCK_KEYCHAIN",
        systemKeychainAccess:
          "FORBIDDEN",
        requiredBrowserLabel:
          "astra-agent-comparator",
        isolation:
          "DEDICATED_UNSIGNED_IN_PROFILE",
        enforcement:
          "CONNECTION_BOUND_PROXY_AND_GUARDED_BSK",
        allowedSearchDomains: [
          "duckduckgo.com"
        ],
        evidencePolicy:
          "OFFICIAL_APPROVED_DOMAIN_ONLY"
      },
      agent: {
        harness:
          "CODEX_CLI",
        harnessVersion:
          "0.154.0",
        model:
          "gpt-5.6-sol",
        promptSha256:
          "b".repeat(64),
        freshContextPerTarget:
          true,
        serialExecution:
          true
      },
      review: {
        version:
          "gate13-agent-comparator-model-review-v1",
        mode:
          "BLINDED_MODEL_REVIEW",
        blindInput:
          "BRIEF_AND_EVIDENCE_ONLY",
        harness:
          "CODEX_CLI",
        harnessVersion:
          "0.154.0",
        model:
          "gpt-5.6-luna",
        promptSha256:
          "d".repeat(64),
        humanReviewMinutes:
          null
      },
      costAccounting: {
        version:
          "gate13-agent-comparator-reference-cost-v1",
        accounting:
          "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL",
        file:
          "fixture-cost-plan.json",
        sha256:
          "e".repeat(64)
      },
      execution: {
        maxElapsedMs:
          120_000,
        retainFirstAttempt:
          true,
        retries: 0,
        humanHelp:
          false,
        sideEffectPolicy:
          "READ_ONLY_BROWSER_RESEARCH"
      }
    });
const store =
  new ComparatorFileStore(
    root
  );

await store.authorize({
  protocolVersion:
    protocol.version,
  protocolSha256:
    "a".repeat(64),
  manifestSha256:
    "c".repeat(64),
  targetCount: 43,
  authorizedBy:
    "fixture-smoke"
});

const prompt =
  [
    "This is a local deterministic fixture, not a real company.",
    "Use only the BrowserSkill CLI commands permitted by the runner.",
    "Start a session with --browser astra-agent-comparator.",
    "Navigate directly to https://fixture.test/about and observe it.",
    "Do not use public search in this fixture.",
    "Use the observed fixture page as the only evidence source.",
    "Stop the BrowserSkill session before returning JSON.",
    "Return evidence-backed values for all four requested fields.",
    "modelUsage must be null."
  ].join(
    "\n"
  );
const worker =
  new CodexBrowserSkillWorker({
    storeRoot:
      root,
    frozenPrompt:
      prompt,
    resultSchemaPath:
      resolve(
        process.cwd(),
        "docs/project/data/gate13-agent-comparator-v1-result.schema.json"
      ),
    mcpServerPath:
      resolve(
        process.cwd(),
        "apps/gate13-agent-comparator/dist/mcp-browser-server.js"
      ),
    realBskPath:
      fixtureBsk
  });
const attempt =
  await runComparatorFirstAttempt({
    store,
    worker,
    protocol,
    protocolSha256:
      "a".repeat(64),
    promptSha256:
      "b".repeat(64),
    manifestSha256:
      "c".repeat(64),
    target: {
      id:
        "fixture.transit",
      companyName:
        "Fixture Transit",
      startUrl:
        "https://fixture.test/about",
      approvedDomains: [
        "fixture.test"
      ]
    },
    agentIdentity: {
      harness:
        "codex-cli",
      harnessVersion:
        "0.154.0",
      model:
        "gpt-5.6-sol",
      browserSkillCliVersion:
        "0.3.1-fixture",
      browserSkillExtensionVersion:
        "0.3.1-fixture",
      browserVersion:
        "153-fixture",
      browserLabel:
        "astra-agent-comparator"
    }
  });

if (
  attempt.status !==
    "COMPLETED" ||
  attempt.workerResult ===
    null ||
  attempt.workerResult
    .evidence.length ===
    0 ||
  attempt.workerResult
    .modelUsage ===
    null
) {
  throw new Error(
    "Comparator fixture smoke did not complete with evidence and runner-owned usage: " +
      JSON.stringify(
        attempt,
        null,
        2
      )
  );
}

process.stdout.write(
  JSON.stringify(
    {
      status:
        "PASS",
      attemptId:
        attempt.attemptId,
      elapsedMs:
        attempt.elapsedMs,
      evidenceCount:
        attempt.workerResult
          ?.evidence.length ??
        0,
      humanBaselineMinutes:
        attempt.humanBaselineMinutes,
      humanReviewMinutes:
        attempt.humanReviewMinutes,
      reviewType:
        attempt.reviewType,
      storeRoot:
        root
    },
    null,
    2
  ) +
    "\n"
);
