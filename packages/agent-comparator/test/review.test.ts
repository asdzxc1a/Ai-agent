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
  comparatorAttemptSha256,
  summarizeComparatorCohort
} from "../src/review.js";
import {
  ComparatorFileStore
} from "../src/store.js";

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

function workerResult() {
  return {
    brief: {
      companyName: {
        value:
          "Fixture Transit",
        unknown:
          false,
        evidenceIndexes: [
          0
        ]
      },
      companySummary: {
        value:
          "Regional freight carrier.",
        unknown:
          false,
        evidenceIndexes: [
          1
        ]
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
          "companyName" as const,
        statement:
          "The page identifies Fixture Transit.",
        url:
          "https://fixture.test/about",
        pageTitle:
          "Fixture",
        screenshotPath:
          null
      },
      {
        fieldId:
          "companySummary" as const,
        statement:
          "Fixture Transit is a regional freight carrier.",
        url:
          "https://fixture.test/about",
        pageTitle:
          "Fixture",
        screenshotPath:
          null
      }
    ],
    visitedUrls: [
      "https://fixture.test/about"
    ],
    terminalNote:
      "Fixture complete.",
    modelUsage: {
      source:
        "CODEX_JSONL" as const,
      inputTokens:
        1_000,
      cachedInputTokens:
        500,
      cacheWriteInputTokens:
        0,
      outputTokens:
        100,
      reasoningOutputTokens:
        10
    }
  };
}

describe(
  "comparator model review",
  () => {
    test(
      "persists one immutable blinded model review bound to the terminal attempt digest",
      async () => {
        const root =
          await mkdtemp(
            join(
              tmpdir(),
              "astra-review-"
            )
          );
        const store =
          new ComparatorFileStore(
            root,
            () =>
              new Date(
                "2026-09-24T12:00:00.000Z"
              )
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
        const reservation =
          await store.reserve({
            targetId:
              "fixture.review",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              identity
          });
        const attempt =
          await store.finalize({
            protocolVersion:
              "gate13-agent-comparator-v1",
            attemptId:
              reservation.attemptId,
            targetId:
              "fixture.review",
            status:
              "COMPLETED",
            startedAt:
              reservation.reservedAt,
            finishedAt:
              "2026-09-24T12:01:00.000Z",
            elapsedMs:
              60_000,
            failureReason:
              null,
            workerResult:
              workerResult(),
            humanBaselineMinutes:
              null,
            humanReviewMinutes:
              null,
            reviewType:
              "NOT_REVIEWED",
            operatorInterventions:
              0,
            agentIdentity:
              identity
          });
        const review =
          await store.saveModelReview({
            attemptId:
              attempt.attemptId,
            targetId:
              attempt.targetId,
            protocolSha256:
              "a".repeat(64),
            reviewPromptSha256:
              "d".repeat(64),
            reviewerIdentity: {
              harness:
                "codex-cli",
              harnessVersion:
                "fixture",
              model:
                "gpt-5.6-luna"
            },
            review: {
              findings: [
                {
                  fieldId:
                    "companyName",
                  verdict:
                    "SUPPORTED_BY_PROVIDED_EVIDENCE",
                  material:
                    false,
                  rationale:
                    "Directly supported."
                },
                {
                  fieldId:
                    "companySummary",
                  verdict:
                    "SUPPORTED_BY_PROVIDED_EVIDENCE",
                  material:
                    false,
                  rationale:
                    "Directly supported."
                },
                {
                  fieldId:
                    "transformationOpportunities",
                  verdict:
                    "UNKNOWN_ACCEPTABLE",
                  material:
                    false,
                  rationale:
                    "Explicit unknown."
                },
                {
                  fieldId:
                    "buyingSignals",
                  verdict:
                    "UNKNOWN_ACCEPTABLE",
                  material:
                    false,
                  rationale:
                    "Explicit unknown."
                }
              ],
              correctionSeverity:
                "NONE",
              usability:
                "USABLE_AS_IS",
              reviewNote:
                "Fixture review.",
              modelUsage:
                null
            },
            modelUsage: {
              source:
                "CODEX_JSONL",
              inputTokens:
                200,
              cachedInputTokens:
                100,
              cacheWriteInputTokens:
                0,
              outputTokens:
                40,
              reasoningOutputTokens:
                5
            }
          });

        expect(
          review.reviewType
        ).toBe(
          "MODEL_REVIEWED"
        );
        expect(
          review.humanReviewMinutes
        ).toBeNull();
        expect(
          review.attemptSha256
        ).toBe(
          comparatorAttemptSha256(
            attempt
          )
        );
        await expect(
          store.getModelReview(
            "fixture.review"
          )
        ).resolves.toEqual(
          review
        );
        await expect(
          store.saveModelReview({
            attemptId:
              attempt.attemptId,
            targetId:
              attempt.targetId,
            protocolSha256:
              "a".repeat(64),
            reviewPromptSha256:
              "d".repeat(64),
            reviewerIdentity:
              review.reviewerIdentity,
            review: {
              findings:
                review.findings,
              correctionSeverity:
                review.correctionSeverity,
              usability:
                review.usability,
              reviewNote:
                "Duplicate.",
              modelUsage:
                null
            },
            modelUsage:
              review.modelUsage
          })
        ).rejects.toMatchObject({
          code:
            "EEXIST"
        });
      }
    );

    test(
      "produces a descriptive cohort summary without turning model review into a Gate 13 verdict",
      () => {
        const attempt = {
          protocolVersion:
            "gate13-agent-comparator-v1" as const,
          attemptId:
            "attempt.fixture",
          targetId:
            "fixture.review",
          status:
            "COMPLETED" as const,
          startedAt:
            "2026-09-24T12:00:00.000Z",
          finishedAt:
            "2026-09-24T12:01:00.000Z",
          elapsedMs:
            60_000,
          failureReason:
            null,
          workerResult:
            workerResult(),
          humanBaselineMinutes:
            null,
          humanReviewMinutes:
            null,
          reviewType:
            "NOT_REVIEWED" as const,
          operatorInterventions:
            0,
          agentIdentity:
            identity
        };
        const summary =
          summarizeComparatorCohort({
            targetIds: [
              "fixture.review",
              "fixture.missing"
            ],
            attempts: [
              attempt
            ],
            reviews: []
          });

        expect(
          summary
        ).toMatchObject({
          verdict:
            "DESCRIPTIVE_ONLY",
          targetCount: 2,
          attemptedCount: 1,
          completedCount: 1,
          modelReviewedCount: 0,
          reviewPendingCount: 1,
          remainingTargetCount: 1,
          supportedValueFieldCount: 2,
          explicitUnknownFieldCount: 2,
          totalRequestedFieldSlots: 4,
          medianCompletedElapsedMs:
            60_000,
          totalInputTokens:
            1_000,
          totalOutputTokens:
            100
        });
      }
    );
  }
);
