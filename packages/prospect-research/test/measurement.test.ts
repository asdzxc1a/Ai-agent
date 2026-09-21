import {
  describe,
  expect,
  it
} from "vitest";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchHumanBaselineSchema,
  ProspectResearchAttemptSchema,
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
        "gate13-measured-research-v7",
      purpose,
      cohortDefinition:
        purpose ===
          "CALIBRATION"
          ? "Cross-region calibration set used to test the workflow and measurement mechanics; not a Gate 13 pass/fail sample."
          : "Chosen industrial/logistics niche acceptance cohort with comparable operating complexity.",
      selectionMethod:
        purpose ===
          "CALIBRATION"
          ? "Purposefully selected stress cases across two markets."
          : "Complete frozen public universe; no discretionary company sampling.",
      selectionUniverse:
        purpose ===
          "CALIBRATION"
          ? null
          : {
              id:
                "universe.acceptance",
              sourceName:
                "Deterministic acceptance fixture universe",
              sourceUrl:
                "https://example.test/acceptance-universe.csv",
              methodologyUrl:
                "https://example.test/acceptance-methodology",
              sourceAsOfDate:
                "2026-09-19",
              sourceDeclaredCount:
                targetCount,
              candidateTargetIds:
                Array.from(
                  {
                    length:
                      targetCount
                  },
                  (_value, index) =>
                    "target." +
                    String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )
                ),
              selectionStrategy:
                "COMPLETE_UNIVERSE",
              selectionSeed:
                null
            },
      marketScope:
        purpose ===
          "CALIBRATION"
          ? "CROSS_MARKET"
          : "SINGLE_MARKET",
      marketDescription:
        purpose ===
          "CALIBRATION"
          ? "United States and China"
          : "United States",
      humanBaselineMode:
        purpose ===
          "CALIBRATION"
          ? "SCOPE_MATCHED"
          : "NORMAL_TOOLS",
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
      reviewRubricVersion:
        "gate13-brief-review-v1",
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
  baselineRecordedAt?: string;
  baselineMinutes?: number;
  setupMinutes?: number;
  evidenceAuditMinutes?: number;
  correctionMinutes?: number;
  failureTriageMinutes?: number;
  otherMinutes?: number;
  costUsd?: number;
  materialClaimsReviewed?: number;
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
      baselineId:
        "baseline." +
        String(
          input.targetIndex
        ).padStart(2, "0"),
      reviewRubricVersion:
        "gate13-brief-review-v1",
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
        input.baselineRecordedAt ??
        "2026-09-20T11:30:00.000Z",
      materialClaimsReviewed:
        input
          .materialClaimsReviewed ??
        (
          notProduced
            ? 0
            : 3
        ),
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
      astraHumanTime: {
        targetSetupMinutes:
          input.setupMinutes ??
          1,
        evidenceMappingAndAuditMinutes:
          input.evidenceAuditMinutes ??
          4,
        correctionAndFinalizationMinutes:
          input.correctionMinutes ??
          3,
        failureTriageMinutes:
          input.failureTriageMinutes ??
          0,
        otherMinutes:
          input.otherMinutes ??
          0,
        measurementMethod:
          "STOPWATCH",
        otherDescription:
          (input.otherMinutes ?? 0) >
            0
            ? "Other measured operator work."
            : null
      },
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

function baseline(input: {
  sampleId: string;
  targetIndex: number;
  source?:
    | "FIXED_CAP"
    | "MEASURED_HUMAN";
  recordedAt?: string;
  minutes?: number;
}) {
  const suffix =
    String(
      input.targetIndex
    ).padStart(2, "0");

  return ProspectResearchHumanBaselineSchema
    .parse({
      id:
        "baseline." +
        suffix,
      sampleId:
        input.sampleId,
      targetId:
        "target." +
        suffix,
      source:
        input.source ??
        "MEASURED_HUMAN",
      preparedBy:
        "human.researcher",
      humanPreparationMinutes:
        input.minutes ??
        20,
      toolingDescription:
        "Normal human research tools for the declared sample baseline.",
      notes: null,
      recordedAt:
        input.recordedAt ??
        "2026-09-20T11:30:00.000Z"
    });
}


function completedAttempt(
  targetIndex: number
) {
  const approved =
    target(
      targetIndex
    );
  const suffix =
    String(
      targetIndex
    ).padStart(2, "0");
  const runId =
    "run." +
    suffix;
  const firstEvidenceId =
    "evidence." +
    suffix +
    ".one";
  const secondEvidenceId =
    "evidence." +
    suffix +
    ".two";
  const researchedAt =
    "2026-09-20T12:05:00.000Z";

  return ProspectResearchAttemptSchema
    .parse({
      id:
        runId,
      target:
        approved,
      startedAt:
        "2026-09-20T12:00:00.000Z",
      createdAt:
        researchedAt,
      status:
        "COMPLETED",
      report: {
        id:
          runId,
        runId,
        targetId:
          approved.id,
        researchedAt,
        prospect: {
          id:
            approved.id,
          domain:
            approved.domain,
          companyName:
            approved
              .companyNameHint,
          fit:
            "unknown",
          disqualifiers: [],
          evidenceIds: [
            firstEvidenceId,
            secondEvidenceId
          ],
          hypothesisIds: []
        },
        companySummary: [
          {
            id:
              "claim." +
              suffix +
              ".one",
            kind:
              "observed_fact",
            statement:
              approved
                .companyNameHint!,
            evidenceIds: [
              firstEvidenceId
            ]
          },
          {
            id:
              "claim." +
              suffix +
              ".two",
            kind:
              "observed_fact",
            statement:
              "Example Systems operates a distributed service network.",
            evidenceIds: [
              secondEvidenceId
            ]
          }
        ],
        transformationOpportunities:
          [],
        buyingSignals: [],
        unknowns: [],
        evidence: [
          {
            id:
              firstEvidenceId,
            sourceUrl:
              approved.startUrl,
            observation:
              approved
                .companyNameHint!,
            capturedAt:
              researchedAt,
            uncertainty:
              "none",
            uncertaintyNote:
              null,
            artifactIds: [
              "artifact." +
              suffix +
              ".one"
            ],
            captureReceipts: [
              {
                artifactId:
                  "artifact." +
                  suffix +
                  ".one",
                captureVersion:
                  "page-evidence-v1",
                semanticSettled:
                  true,
                pageUrl:
                  approved.startUrl,
                capturedAt:
                  researchedAt,
                pageContentSha256:
                  "a".repeat(64),
                screenshotSha256:
                  "b".repeat(64)
              }
            ]
          },
          {
            id:
              secondEvidenceId,
            sourceUrl:
              approved.startUrl,
            observation:
              "Example Systems operates a distributed service network.",
            capturedAt:
              researchedAt,
            uncertainty:
              "none",
            uncertaintyNote:
              null,
            artifactIds: [
              "artifact." +
              suffix +
              ".two"
            ],
            captureReceipts: [
              {
                artifactId:
                  "artifact." +
                  suffix +
                  ".two",
                captureVersion:
                  "page-evidence-v1",
                semanticSettled:
                  true,
                pageUrl:
                  approved.startUrl,
                capturedAt:
                  researchedAt,
                pageContentSha256:
                  "c".repeat(64),
                screenshotSha256:
                  "d".repeat(64)
              }
            ]
          }
        ]
      }
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
              medianAstraHumanPreparationMinutes:
                8,
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
        const fixedCapBaseline =
          baseline({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            source:
              "FIXED_CAP"
          });
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
              "FIXED_CAP",
            baselineRecordedAt:
              fixedCapBaseline
                .recordedAt,
            baselineMinutes:
              fixedCapBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            fixedCapBaseline,
            fixedCap
          )
        ).toThrow(
          "require a measured human baseline"
        );

        const lateBaseline =
          baseline({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            recordedAt:
              "2026-09-20T12:01:00.000Z"
          });
        const lateOutcome =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            attemptStatus:
              "FAILED",
            briefDisposition:
              "not_produced",
            baselineRecordedAt:
              lateBaseline
                .recordedAt,
            baselineMinutes:
              lateBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            lateBaseline,
            lateOutcome
          )
        ).toThrow(
          "must be measured before the Astra attempt starts"
        );

        const validBaseline =
          baseline({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            recordedAt:
              "2026-09-20T11:59:00.000Z"
          });
        const validOutcome =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            attemptStatus:
              "FAILED",
            briefDisposition:
              "not_produced",
            baselineRecordedAt:
              validBaseline
                .recordedAt,
            baselineMinutes:
              validBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            validBaseline,
            validOutcome
          )
        ).not.toThrow();

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            validBaseline,
            {
              ...validOutcome,
              baselineHumanPreparationMinutes:
                99
            }
          )
        ).toThrow(
          "differs from durable baseline truth"
        );
      }
    );

    it(
      "requires the human audit count to cover every durable observed evidence item for completed attempts",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );
        const attempt =
          completedAttempt(1);
        const durableBaseline =
          baseline({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            recordedAt:
              "2026-09-20T11:59:00.000Z"
          });
        const incompleteAudit =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            materialClaimsReviewed:
              0,
            baselineRecordedAt:
              durableBaseline
                .recordedAt,
            baselineMinutes:
              durableBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            durableBaseline,
            incompleteAudit
          )
        ).toThrow(
          "must equal the durable observed-evidence audit count: 2"
        );

        const overCountedAudit =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            materialClaimsReviewed:
              3,
            baselineRecordedAt:
              durableBaseline
                .recordedAt,
            baselineMinutes:
              durableBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            durableBaseline,
            overCountedAudit
          )
        ).toThrow(
          "must equal the durable observed-evidence audit count: 2"
        );

        const completeAudit =
          outcome({
            sampleId:
              acceptance.id,
            targetIndex: 1,
            materialClaimsReviewed:
              2,
            baselineRecordedAt:
              durableBaseline
                .recordedAt,
            baselineMinutes:
              durableBaseline
                .humanPreparationMinutes
          });

        expect(() =>
          validateProspectResearchSampleOutcomeContext(
            acceptance,
            attempt,
            durableBaseline,
            completeAudit
          )
        ).not.toThrow();
      }
    );

    it(
      "rejects complete-universe acceptance when frozen membership is altered",
      () => {
        const acceptance =
          sample(
            "ACCEPTANCE",
            30
          );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptance,
              selectionUniverse: {
                ...acceptance
                  .selectionUniverse!,
                sourceDeclaredCount:
                  31,
                candidateTargetIds: [
                  ...acceptance
                    .selectionUniverse!
                    .candidateTargetIds,
                  "target.31"
                ]
              }
            })
        ).toThrow(
          "complete-universe selection requires the frozen sample to contain every candidate exactly once"
        );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptance,
              selectionUniverse: {
                ...acceptance
                  .selectionUniverse!,
                sourceAsOfDate:
                  "2026-09-21"
              }
            })
        ).toThrow(
          "selection universe source date must not be after sample freeze"
        );
      }
    );

    it(
      "derives brief disposition from the frozen correction-severity rubric",
      () => {
        const accepted =
          outcome({
            sampleId:
              "sample.acceptance",
            targetIndex: 1
          });

        expect(
          accepted.briefDisposition
        ).toBe("accepted");

        expect(() =>
          ProspectResearchSampleOutcomeSchema
            .parse({
              ...accepted,
              briefDisposition:
                "minor_edit",
              corrections: {
                minor: 0,
                major: 1,
                critical: 0
              }
            })
        ).toThrow(
          "brief disposition must match the frozen Gate 13 review rubric"
        );

        expect(() =>
          ProspectResearchSampleOutcomeSchema
            .parse({
              ...accepted,
              briefDisposition:
                "minor_edit",
              unsupportedMaterialClaims:
                1,
              corrections: {
                minor: 1,
                major: 0,
                critical: 0
              }
            })
        ).toThrow(
          "brief disposition must match the frozen Gate 13 review rubric"
        );

        const rejected =
          ProspectResearchSampleOutcomeSchema
            .parse({
              ...accepted,
              briefDisposition:
                "rejected",
              unsupportedMaterialClaims:
                1
            });

        expect(
          rejected.briefDisposition
        ).toBe("rejected");
      }
    );

    it(
      "uses total Astra-side human labor rather than a narrow review-time proxy",
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
                  index + 1,
                baselineMinutes:
                  20,
                setupMinutes: 2,
                evidenceAuditMinutes:
                  5,
                correctionMinutes:
                  5
              })
          );
        const evaluation =
          evaluateProspectResearchSample(
            acceptance,
            outcomes
          );

        expect(
          evaluation.metrics
            .medianAstraHumanPreparationMinutes
        ).toBe(12);
        expect(
          evaluation.metrics
            .medianHumanTimeReductionFraction
        ).toBeCloseTo(0.4);
        expect(
          evaluation.passed
        ).toBe(false);
        expect(
          evaluation.failures
        ).toContain(
          "median human time reduction is below the frozen threshold"
        );
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
              marketScope:
                "CROSS_MARKET"
            })
        ).toThrow(
          "acceptance must use one market"
        );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptance,
              humanBaselineMode:
                "SCOPE_MATCHED"
            })
        ).toThrow(
          "must compare against the human workflow using its normal tools"
        );

        const acceptanceForThresholds =
          sample(
            "ACCEPTANCE",
            30
          );

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptanceForThresholds,
              criteria: {
                ...acceptanceForThresholds
                  .criteria,
                minUsableBriefRate:
                  0.89
              }
            })
        ).toThrow();

        expect(() =>
          ProspectResearchSampleSchema
            .parse({
              ...acceptanceForThresholds,
              criteria: {
                ...acceptanceForThresholds
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
