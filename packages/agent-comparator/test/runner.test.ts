import {
  mkdtemp
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";

import {
  describe,
  expect,
  test
} from "vitest";

import {
  ComparatorProtocolSchema
} from "../src/schema.js";
import {
  ComparatorFileStore
} from "../src/store.js";
import {
  runComparatorFirstAttempt
} from "../src/runner.js";

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
        maxElapsedMs: 25,
        retainFirstAttempt:
          true,
        retries: 0,
        humanHelp:
          false,
        sideEffectPolicy:
          "READ_ONLY_BROWSER_RESEARCH"
      }
    });

const identity = {
  harness:
    "codex-cli",
  harnessVersion:
    "fixture",
  model:
    "gpt-5.6-sol",
  browserSkillCliVersion:
    "fixture",
  browserSkillExtensionVersion:
    "fixture",
  browserVersion:
    "fixture",
  browserLabel:
    "astra-agent-comparator"
};

async function authorizedStore() {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "astra-comparator-run-"
      )
    );
  const store =
    new ComparatorFileStore(
      root
    );

  await store.authorize({
    protocolVersion:
      "gate13-agent-comparator-v1",
    protocolSha256:
      "a".repeat(64),
    manifestSha256:
      "c".repeat(64),
    targetCount: 43,
    authorizedBy:
      "fixture"
  });

  return store;
}

describe(
  "runComparatorFirstAttempt",
  () => {
    test(
      "persists evidence-backed first-attempt output with human measurements null",
      async () => {
        const store =
          await authorizedStore();
        const attempt =
          await runComparatorFirstAttempt({
            store,
            protocol,
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            target: {
              id:
                "fixture.target",
              companyName:
                "Fixture Co",
              startUrl:
                "https://fixture.test/about",
              approvedDomains: [
                "fixture.test"
              ]
            },
            agentIdentity:
              identity,
            worker: {
              async research() {
                return {
                  brief: {
                    companyName: {
                      value:
                        "Fixture Co",
                      unknown:
                        false,
                      evidenceIndexes: [
                        0
                      ]
                    },
                    companySummary: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    },
                    transformationOpportunities: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    },
                    buyingSignals: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    }
                  },
                  evidence: [
                    {
                      fieldId:
                        "companyName",
                      statement:
                        "The page identifies Fixture Co.",
                      url:
                        "https://fixture.test/about",
                      pageTitle:
                        "Fixture",
                      screenshotPath:
                        null
                    }
                  ],
                  visitedUrls: [
                    "https://duckduckgo.com/?q=site%3Afixture.test",
                    "https://fixture.test/about"
                  ],
                  terminalNote:
                    "Finished fixture research.",
                  modelUsage:
                    null
                };
              }
            }
          });

        expect(
          attempt.status
        ).toBe(
          "COMPLETED"
        );
        expect(
          attempt.humanBaselineMinutes
        ).toBeNull();
        expect(
          attempt.humanReviewMinutes
        ).toBeNull();
        expect(
          attempt.reviewType
        ).toBe(
          "NOT_REVIEWED"
        );

        await expect(
          store.reserve({
            targetId:
              "fixture.target",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              identity
          })
        ).rejects.toMatchObject({
          code:
            "EEXIST"
        });
      }
    );

    test(
      "rejects third-party evidence while allowing search discovery to be visited",
      async () => {
        const store =
          await authorizedStore();
        const attempt =
          await runComparatorFirstAttempt({
            store,
            protocol,
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            target: {
              id:
                "fixture.outside",
              companyName:
                "Fixture Co",
              startUrl:
                "https://fixture.test/about",
              approvedDomains: [
                "fixture.test"
              ]
            },
            agentIdentity:
              identity,
            worker: {
              async research() {
                return {
                  brief: {
                    companyName: {
                      value:
                        "Fixture Co",
                      unknown:
                        false,
                      evidenceIndexes: [
                        0
                      ]
                    },
                    companySummary: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    },
                    transformationOpportunities: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    },
                    buyingSignals: {
                      value:
                        null,
                      unknown:
                        true,
                      evidenceIndexes: []
                    }
                  },
                  evidence: [
                    {
                      fieldId:
                        "companyName",
                      statement:
                        "Third-party claim.",
                      url:
                        "https://third-party.test/article",
                      pageTitle:
                        "Third party",
                      screenshotPath:
                        null
                    }
                  ],
                  visitedUrls: [
                    "https://duckduckgo.com/?q=fixture",
                    "https://third-party.test/article"
                  ],
                  terminalNote:
                    "Finished.",
                  modelUsage:
                    null
                };
              }
            }
          });

        expect(
          attempt.status
        ).toBe(
          "FAILED"
        );
        expect(
          attempt.failureReason
        ).toContain(
          "outside the target's approved official domains"
        );
      }
    );

    test(
      "times out a worker that ignores cancellation and preserves the first attempt",
      async () => {
        const store =
          await authorizedStore();
        const attempt =
          await runComparatorFirstAttempt({
            store,
            protocol,
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            target: {
              id:
                "fixture.hang",
              companyName:
                "Fixture Co",
              startUrl:
                "https://fixture.test/about",
              approvedDomains: [
                "fixture.test"
              ]
            },
            agentIdentity:
              identity,
            worker: {
              research() {
                return new Promise(
                  () => {}
                );
              }
            }
          });

        expect(
          attempt.status
        ).toBe(
          "TIMED_OUT"
        );
        expect(
          await store.getAttempt(
            "fixture.hang"
          )
        ).toMatchObject({
          attemptId:
            attempt.attemptId,
          status:
            "TIMED_OUT"
        });
      }
    );
  }
);
