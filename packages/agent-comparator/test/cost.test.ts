import {
  describe,
  expect,
  test
} from "vitest";

import {
  calculateComparatorReferenceCost,
  ComparatorReferenceCostPlanSchema,
  summarizeComparatorReferenceCosts
} from "../src/cost.js";

const plan =
  ComparatorReferenceCostPlanSchema
    .parse({
      version:
        "gate13-agent-comparator-reference-cost-v1",
      accounting:
        "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL",
      sourceAsOfDate:
        "2026-09-24",
      rates: {
        generatorInputUsdPerMillion:
          10,
        generatorOutputUsdPerMillion:
          30,
        reviewerInputUsdPerMillion:
          0.5,
        reviewerOutputUsdPerMillion:
          1.8,
        browserComputeUsdPerHour:
          0.3328
      },
      sources: [
        {
          label:
            "fixture",
          url:
            "https://example.com/pricing",
          note:
            "fixture"
        }
      ]
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

const attempt = {
  protocolVersion:
    "gate13-agent-comparator-v1" as const,
  attemptId:
    "attempt.cost",
  targetId:
    "fixture.cost",
  status:
    "COMPLETED" as const,
  startedAt:
    "2026-09-24T10:00:00.000Z",
  finishedAt:
    "2026-09-24T10:30:00.000Z",
  elapsedMs:
    30 * 60 * 1000,
  failureReason:
    null,
  workerResult: {
    brief: {
      companyName: {
        value:
          "Fixture",
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
          "companyName" as const,
        statement:
          "Fixture",
        url:
          "https://fixture.test/",
        pageTitle:
          "Fixture",
        screenshotPath:
          null
      }
    ],
    visitedUrls: [
      "https://fixture.test/"
    ],
    terminalNote:
      "complete",
    modelUsage: {
      source:
        "CODEX_JSONL" as const,
      inputTokens:
        500_000,
      cachedInputTokens:
        100_000,
      cacheWriteInputTokens:
        0,
      outputTokens:
        50_000,
      reasoningOutputTokens:
        5_000
    }
  },
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

const review = {
  version:
    "gate13-agent-comparator-model-review-v1" as const,
  reviewType:
    "MODEL_REVIEWED" as const,
  blindInput:
    "BRIEF_AND_EVIDENCE_ONLY" as const,
  attemptId:
    attempt.attemptId,
  targetId:
    attempt.targetId,
  attemptSha256:
    "a".repeat(64),
  protocolSha256:
    "b".repeat(64),
  reviewPromptSha256:
    "c".repeat(64),
  reviewedAt:
    "2026-09-24T10:31:00.000Z",
  reviewerIdentity: {
    harness:
      "codex-cli" as const,
    harnessVersion:
      "fixture",
    model:
      "gpt-5.6-luna"
  },
  findings: [
    {
      fieldId:
        "companyName" as const,
      verdict:
        "SUPPORTED_BY_PROVIDED_EVIDENCE" as const,
      material:
        false,
      rationale:
        "Supported."
    },
    {
      fieldId:
        "companySummary" as const,
      verdict:
        "UNKNOWN_ACCEPTABLE" as const,
      material:
        false,
      rationale:
        "Unknown."
    },
    {
      fieldId:
        "transformationOpportunities" as const,
      verdict:
        "UNKNOWN_ACCEPTABLE" as const,
      material:
        false,
      rationale:
        "Unknown."
    },
    {
      fieldId:
        "buyingSignals" as const,
      verdict:
        "UNKNOWN_ACCEPTABLE" as const,
      material:
        false,
      rationale:
        "Unknown."
    }
  ],
  correctionSeverity:
    "NONE" as const,
  usability:
    "USABLE_AS_IS" as const,
  reviewNote:
    "fixture",
  modelUsage: {
    source:
      "CODEX_JSONL" as const,
    inputTokens:
      20_000,
    cachedInputTokens:
      0,
    cacheWriteInputTokens:
      0,
    outputTokens:
      2_000,
    reasoningOutputTokens:
      100
  },
  humanReviewMinutes:
    null
};

describe(
  "comparator reference-cost accounting",
  () => {
    test(
      "uses frozen conservative API-equivalent rates without claiming actual billing",
      () => {
        const cost =
          calculateComparatorReferenceCost(
            plan,
            attempt,
            review
          );

        expect(
          cost.generatorModelUsd
        ).toBeCloseTo(
          6.5,
          8
        );
        expect(
          cost.reviewerModelUsd
        ).toBeCloseTo(
          0.0136,
          8
        );
        expect(
          cost.browserComputeUsd
        ).toBeCloseTo(
          0.1664,
          8
        );
        expect(
          cost.totalKnownUsd
        ).toBeCloseTo(
          6.68,
          8
        );
        expect(
          cost.accounting
        ).toBe(
          "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL"
        );
        expect(
          cost.complete
        ).toBe(true);
      }
    );

    test(
      "keeps completed-attempt cost incomplete until the frozen model review exists",
      () => {
        const cost =
          calculateComparatorReferenceCost(
            plan,
            attempt
          );

        expect(
          cost.complete
        ).toBe(false);
        expect(
          cost.reviewerModelUsd
        ).toBeNull();
      }
    );

    test(
      "summarizes known reference cost while preserving missing-usage identities",
      () => {
        const summary =
          summarizeComparatorReferenceCosts({
            plan,
            attempts: [
              attempt
            ],
            reviews: [
              review
            ]
          });

        expect(
          summary
        ).toMatchObject({
          attemptedCount: 1,
          completeCostCount: 1,
          generatorUsageMissingTargetIds: [],
          reviewerUsageMissingTargetIds: []
        });
        expect(
          summary.totalKnownUsd
        ).toBeCloseTo(
          6.68,
          8
        );
      }
    );
  }
);
