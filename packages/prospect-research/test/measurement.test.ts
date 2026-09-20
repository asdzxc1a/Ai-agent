import {
  describe,
  expect,
  it
} from "vitest";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  evaluateProspectResearchSample
} from "../src/index.js";

const approvedAt =
  "2026-09-20T12:00:00.000Z";
const frozenAt =
  "2026-09-20T12:10:00.000Z";

function target(
  id: string
) {
  return ApprovedResearchTargetSchema
    .parse({
      id,
      domain: "example.com",
      startUrl:
        "https://example.com/",
      approvedDomains: [
        "example.com"
      ],
      companyNameHint:
        "Example Systems",
      icpContext: null,
      approval: {
        id:
          "approval." + id,
        scope:
          "public_research_only",
        approvedBy:
          "operator",
        approvedAt
      }
    });
}

function sample() {
  return ProspectResearchSampleSchema
    .parse({
      id: "sample.measurement",
      status: "FROZEN",
      protocolVersion:
        "gate13-measured-research-v1",
      targets: [
        target("target.one"),
        target("target.two")
      ],
      criteria: {
        maxUnsupportedMaterialClaims:
          0,
        minUsableBriefRate:
          0.9,
        minMedianHumanTimeReductionFraction:
          0.5,
        requireNoUnauthorizedActions:
          true,
        maxDeliveryCostUsdPerBrief:
          10
      },
      humanBaselineDescription:
        "Operator researches the same approved page and drafts the same brief manually.",
      comparisonBaselineDescription:
        null,
      frozenBy:
        "operator",
      frozenAt
    });
}

function outcome(input: {
  id: string;
  targetId: string;
  attemptId: string;
  briefDisposition:
    | "accepted"
    | "minor_edit"
    | "major_edit"
    | "rejected"
    | "not_produced";
  attemptStatus:
    | "COMPLETED"
    | "FAILED";
  baselineMinutes?: number;
  reviewMinutes?: number;
  costUsd?: number;
}) {
  const notProduced =
    input.briefDisposition ===
      "not_produced";

  return ProspectResearchSampleOutcomeSchema
    .parse({
      id: input.id,
      sampleId:
        "sample.measurement",
      targetId:
        input.targetId,
      attemptId:
        input.attemptId,
      attemptStatus:
        input.attemptStatus,
      briefDisposition:
        input.briefDisposition,
      reviewedBy:
        "operator",
      reviewedAt:
        "2026-09-20T12:30:00.000Z",
      materialClaimsReviewed:
        notProduced ? 0 : 3,
      unsupportedMaterialClaims:
        0,
      corrections: {
        minor:
          input.briefDisposition ===
            "minor_edit"
            ? 1
            : 0,
        major:
          input.briefDisposition ===
            "major_edit"
            ? 1
            : 0,
        critical: 0
      },
      requestedFieldsTotal: 4,
      requestedFieldsCovered:
        notProduced ? 0 : 4,
      baselineHumanPreparationMinutes:
        input.baselineMinutes ??
        20,
      astraHumanReviewMinutes:
        input.reviewMinutes ??
        8,
      endToEndDurationMs:
        5_000,
      deliveryCostUsd:
        input.costUsd ?? 4,
      unauthorizedActions: 0,
      notes: null
    });
}

describe(
  "Gate 13 measured research sample",
  () => {
    it(
      "cannot pass before every frozen target has exactly one outcome",
      () => {
        const evaluation =
          evaluateProspectResearchSample(
            sample(),
            [
              outcome({
                id:
                  "outcome.one",
                targetId:
                  "target.one",
                attemptId:
                  "run.one",
                attemptStatus:
                  "COMPLETED",
                briefDisposition:
                  "accepted"
              })
            ]
          );

        expect(
          evaluation.complete
        ).toBe(false);
        expect(
          evaluation.passed
        ).toBeNull();
        expect(
          evaluation.metrics
            .outcomeCount
        ).toBe(1);
      }
    );

    it(
      "passes only after the frozen criteria are satisfied across the complete cohort",
      () => {
        const evaluation =
          evaluateProspectResearchSample(
            sample(),
            [
              outcome({
                id:
                  "outcome.one",
                targetId:
                  "target.one",
                attemptId:
                  "run.one",
                attemptStatus:
                  "COMPLETED",
                briefDisposition:
                  "accepted",
                baselineMinutes:
                  20,
                reviewMinutes: 8,
                costUsd: 4
              }),
              outcome({
                id:
                  "outcome.two",
                targetId:
                  "target.two",
                attemptId:
                  "run.two",
                attemptStatus:
                  "COMPLETED",
                briefDisposition:
                  "minor_edit",
                baselineMinutes:
                  30,
                reviewMinutes: 12,
                costUsd: 6
              })
            ]
          );

        expect(evaluation)
          .toMatchObject({
            complete: true,
            passed: true,
            metrics: {
              targetCount: 2,
              outcomeCount: 2,
              usableBriefRate: 1,
              unsupportedMaterialClaims:
                0,
              medianHumanTimeReductionFraction:
                0.6,
              requestedFieldCoverageRate:
                1,
              unauthorizedActions:
                0,
              maxDeliveryCostUsdPerBrief:
                6
            },
            failures: []
          });
      }
    );

    it(
      "keeps failed live attempts in the denominator and refuses weakened audit thresholds",
      () => {
        const evaluation =
          evaluateProspectResearchSample(
            sample(),
            [
              outcome({
                id:
                  "outcome.one",
                targetId:
                  "target.one",
                attemptId:
                  "run.one",
                attemptStatus:
                  "COMPLETED",
                briefDisposition:
                  "accepted"
              }),
              outcome({
                id:
                  "outcome.two",
                targetId:
                  "target.two",
                attemptId:
                  "run.two",
                attemptStatus:
                  "FAILED",
                briefDisposition:
                  "not_produced"
              })
            ]
          );

        expect(
          evaluation.complete
        ).toBe(true);
        expect(
          evaluation.passed
        ).toBe(false);
        expect(
          evaluation.metrics
            .usableBriefRate
        ).toBe(0.5);
        expect(
          evaluation.failures
        ).toContain(
          "usable brief rate is below the frozen threshold"
        );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...sample(),
              criteria: {
                ...sample()
                  .criteria,
                minUsableBriefRate:
                  0.89
              }
            })
        ).toThrow();

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...sample(),
              criteria: {
                ...sample()
                  .criteria,
                minMedianHumanTimeReductionFraction:
                  0.49
              }
            })
        ).toThrow();
      }
    );
  }
);
