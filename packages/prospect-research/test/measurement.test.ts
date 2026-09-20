import {
  describe,
  expect,
  it
} from "vitest";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  evaluateProspectResearchSample,
  validateProspectResearchSampleOutcomeContext,
  type FailedProspectResearchAttempt
} from "../src/index.js";

const approvedAt =
  "2026-09-20T12:00:00.000Z";
const frozenAt =
  "2026-09-20T12:10:00.000Z";

function target(
  index: number
) {
  const suffix =
    String(index)
      .padStart(2, "0");

  return ApprovedResearchTargetSchema
    .parse({
      id:
        "target." + suffix,
      domain:
        "example.com",
      startUrl:
        "https://example.com/",
      approvedDomains: [
        "example.com"
      ],
      companyNameHint:
        "Example Systems " +
        suffix,
      icpContext:
        "Industrial operations calibration fixture.",
      approval: {
        id:
          "approval." +
          suffix,
        scope:
          "public_research_only",
        approvedBy:
          "operator",
        approvedAt
      }
    });
}

function sample(
  purpose:
    | "CALIBRATION"
    | "ACCEPTANCE",
  targetCount: number
) {
  return ProspectResearchSampleSchema
    .parse({
      id:
        purpose ===
          "CALIBRATION"
          ? "sample.calibration"
          : "sample.acceptance",
      status:
        "FROZEN",
      protocolVersion:
        "gate13-measured-research-v2",
      purpose,
      cohortDefinition:
        purpose ===
          "CALIBRATION"
          ? "Cross-region calibration set used to test the workflow and measurement mechanics; not a Gate 13 pass/fail sample."
          : "Chosen industrial/logistics niche acceptance cohort with comparable operating complexity.",
      targets:
        Array.from(
          {
            length:
              targetCount
          },
          (_value, index) =>
            target(
              index + 1
            )
        ),
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
      costCeilingRationale:
        "Pre-registered engineering/business ceiling for this sample.",
      humanBaselineDescription:
        "A human researcher completes the same brief from the same approved scope using the baseline policy declared for the sample.",
      comparisonBaselineDescription:
        null,
      frozenBy:
        "operator",
      frozenAt
    });
}

function outcome(input: {
  sampleId: string;
  targetIndex: number;
  attemptStatus?:
    | "COMPLETED"
    | "FAILED";
  briefDisposition?:
    | "accepted"
    | "minor_edit"
    | "major_edit"
    | "rejected"
    | "not_produced";
  baselineSource?:
    | "FIXED_CAP"
    | "MEASURED_HUMAN";
  baselineMinutes?: number;
  reviewMinutes?: number;
  costUsd?: number;
}) {
  const targetId =
    "target." +
    String(
      input.targetIndex
    ).padStart(2, "0");
  const attemptStatus =
    input.attemptStatus ??
    "COMPLETED";
  const briefDisposition =
    input.briefDisposition ??
    (
      attemptStatus ===
        "FAILED"
        ? "not_produced"
        : "accepted"
    );
  const notProduced =
    briefDisposition ===
      "not_produced";

  return ProspectResearchSampleOutcomeSchema
    .parse({
      id:
        "outcome." +
        String(
          input.targetIndex
        ).padStart(2, "0"),
      sampleId:
        input.sampleId,
      targetId,
      attemptId:
        "run." +
        String(
          input.targetIndex
        ).padStart(2, "0"),
      attemptStatus,
      briefDisposition,
      reviewedBy:
        "reviewer",
      reviewedAt:
        "2026-09-20T13:00:00.000Z",
      reviewMode:
        "BLIND",
      baselineSource:
        input.baselineSource ??
        "MEASURED_HUMAN",
      baselineMeasuredAt:
        "2026-09-20T11:30:00.000Z",
      materialClaimsReviewed:
        notProduced
          ? 0
          : 3,
      unsupportedMaterialClaims:
        0,
      corrections: {
        minor:
          briefDisposition ===
            "minor_edit"
            ? 1
            : 0,
        major:
          briefDisposition ===
            "major_edit"
            ? 1
            : 0,
        critical: 0
      },
      requestedFieldsTotal:
        4,
      requestedFieldsCovered:
        notProduced
          ? 0
          : 4,
      baselineHumanPreparationMinutes:
        input.baselineMinutes ??
        20,
      astraHumanReviewMinutes:
        input.reviewMinutes ??
        8,
      endToEndDurationMs:
        5_000,
      deliveryCostUsd:
        input.costUsd ??
        4,
      unauthorizedActions:
        0,
      notes: null
    });
}

describe(
  "Gate 13 measured research sample",
  () => {
    it(
      "keeps a complete calibration cohort diagnostic-only",
      () => {
        const calibration =
          sample(
            "CALIBRATION",
            6
          );
        const outcomes =
          calibration.targets.map(
            (_target, index) =>
              outcome({
                sampleId:
                  calibration.id,
                targetIndex:
                  index + 1,
                baselineSource:
                  "FIXED_CAP"
              })
          );
        const evaluation =
          evaluateProspectResearchSample(
            calibration,
            outcomes
          );

        expect(
          evaluation.complete
        ).toBe(true);
        expect(
          evaluation.passed
        ).toBeNull();
        expect(
          evaluation.metrics
            .targetCount
        ).toBe(6);
        expect(
          evaluation.failures
        ).toEqual([]);
      }
    );

    it(
      "does not report an acceptance verdict before all 30 frozen targets have outcomes",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );
        const outcomes =
          acceptance.targets
            .slice(0, 29)
            .map(
              (_target, index) =>
                outcome({
                  sampleId:
                    acceptance.id,
                  targetIndex:
                    index + 1
                })
            );
        const evaluation =
          evaluateProspectResearchSample(
            acceptance,
            outcomes
          );

        expect(
          evaluation.complete
        ).toBe(false);
        expect(
          evaluation.passed
        ).toBeNull();
      }
    );

    it(
      "passes a complete 30-target acceptance cohort when every frozen criterion is satisfied",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );
        const outcomes =
          acceptance.targets.map(
            (_target, index) =>
              outcome({
                sampleId:
                  acceptance.id,
                targetIndex:
                  index + 1
              })
          );
        const evaluation =
          evaluateProspectResearchSample(
            acceptance,
            outcomes
          );

        expect(evaluation)
          .toMatchObject({
            complete: true,
            passed: true,
            metrics: {
              targetCount: 30,
              outcomeCount: 30,
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
                4
            },
            failures: []
          });
      }
    );

    it(
      "keeps failed attempts in the acceptance denominator and rejects a sub-90-percent usable cohort",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );
        const outcomes =
          acceptance.targets.map(
            (_target, index) =>
              index < 4
                ? outcome({
                    sampleId:
                      acceptance.id,
                    targetIndex:
                      index + 1,
                    attemptStatus:
                      "FAILED",
                    briefDisposition:
                      "not_produced"
                  })
                : outcome({
                    sampleId:
                      acceptance.id,
                    targetIndex:
                      index + 1
                  })
          );
        const evaluation =
          evaluateProspectResearchSample(
            acceptance,
            outcomes
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
        ).toBeCloseTo(
          26 / 30
        );
        expect(
          evaluation.failures
        ).toContain(
          "usable brief rate is below the frozen threshold"
        );
      }
    );

    it(
      "requires a measured human baseline recorded before the server-owned Astra start for acceptance",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );
        const attempt:
          FailedProspectResearchAttempt = {
            id:
              "run.01",
            target:
              target(1),
            startedAt:
              "2026-09-20T12:00:00.000Z",
            createdAt:
              "2026-09-20T12:05:00.000Z",
            status:
              "FAILED",
            runId:
              "run.01",
            failure: {
              kind:
                "LIVE_RESEARCH_FAILURE",
              code:
                "ACCESS_BLOCKED",
              message:
                "Fixture access block."
            }
          };
        const fixedCap =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            attemptStatus:
              "FAILED",
            briefDisposition:
              "not_produced",
            baselineSource:
              "FIXED_CAP"
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            fixedCap
          )
        ).toThrow(
          "require a measured human baseline"
        );

        const lateBaseline = {
          ...fixedCap,
          baselineSource:
            "MEASURED_HUMAN" as const,
          baselineMeasuredAt:
            "2026-09-20T12:01:00.000Z"
        };

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            lateBaseline
          )
        ).toThrow(
          "must be measured before the Astra attempt starts"
        );

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            {
              ...lateBaseline,
              baselineMeasuredAt:
                "2026-09-20T11:59:00.000Z"
            }
          )
        ).not.toThrow();
      }
    );

    it(
      "rejects undersized acceptance samples, oversized calibration samples, and weakened audit thresholds",
      () => {
        expect(() =>
          sample(
            "ACCEPTANCE",
            29
          )
        ).toThrow();

        expect(() =>
          sample(
            "CALIBRATION",
            11
          )
        ).toThrow();

        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptance,
              criteria: {
                ...acceptance
                  .criteria,
                minUsableBriefRate:
                  0.89
              }
            })
        ).toThrow();

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptance,
              criteria: {
                ...acceptance
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
