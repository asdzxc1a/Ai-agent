import {
  readFile
} from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  ProspectResearchAttemptSchema,
  ProspectResearchHumanBaselineSchema
} from "@astra/prospect-research";

import {
  GATE13_APPROVAL_MANIFEST_PATH,
  buildGate13ApprovalBatchFromManifest
} from "../src/approval.js";
import {
  GATE13_UNIVERSE_PATH,
  buildGate13AcceptanceSample,
  buildGate13HumanBaselineInput,
  buildGate13SampleOutcome,
  parseGate13OutcomeReview
} from "../src/experiment.js";

const approvedAt =
  "2026-09-21T12:00:00.000Z";
const frozenAt =
  "2026-09-21T12:01:00.000Z";

async function fixtures() {
  const [
    manifestText,
    universeText
  ] =
    await Promise.all([
      readFile(
        GATE13_APPROVAL_MANIFEST_PATH,
        "utf8"
      ),
      readFile(
        GATE13_UNIVERSE_PATH,
        "utf8"
      )
    ]);

  const batch =
    buildGate13ApprovalBatchFromManifest({
      manifestText,
      batchId:
        "g13.batch.operator-test",
      approvedBy:
        "operator@example",
      approvedAt
    });

  return {
    manifestText,
    universeText,
    batch
  };
}

describe(
  "Gate 13 measured operator helpers",
  () => {
    it(
      "builds the frozen 43-target acceptance sample only from the canonical approval batch",
      async () => {
        const fixture =
          await fixtures();
        const sample =
          buildGate13AcceptanceSample({
            ...fixture,
            approvalBatch:
              fixture.batch,
            sampleId:
              "g13.sample.acceptance",
            frozenBy:
              "operator@example",
            frozenAt,
            maxDeliveryCostUsdPerBrief:
              12.5,
            costCeilingRationale:
              "Pre-frozen business ceiling.",
            humanBaselineDescription:
              "A skilled B2B researcher uses normal research tools and records measured preparation time before Astra starts."
          });

        expect(
          sample.purpose
        ).toBe(
          "ACCEPTANCE"
        );
        expect(
          sample.targets
        ).toHaveLength(43);
        expect(
          new Set(
            sample.targets.map(
              (target) =>
                target.id
            )
          ).size
        ).toBe(43);
        expect(
          sample.selectionUniverse
            ?.selectionStrategy
        ).toBe(
          "COMPLETE_UNIVERSE"
        );
        expect(
          sample.marketScope
        ).toBe(
          "SINGLE_MARKET"
        );
        expect(
          sample.humanBaselineMode
        ).toBe(
          "NORMAL_TOOLS"
        );
        expect(
          sample.criteria
        ).toEqual({
          maxUnsupportedMaterialClaims:
            0,
          minUsableBriefRate:
            0.9,
          minMedianHumanTimeReductionFraction:
            0.5,
          requireNoUnauthorizedActions:
            true,
          maxDeliveryCostUsdPerBrief:
            12.5
        });
      }
    );

    it(
      "rejects a stored approval batch whose target payload no longer matches the canonical manifest",
      async () => {
        const fixture =
          await fixtures();
        const first =
          fixture.batch
            .targets[0]!;

        expect(() =>
          buildGate13AcceptanceSample({
            manifestText:
              fixture
                .manifestText,
            universeText:
              fixture
                .universeText,
            approvalBatch: {
              ...fixture.batch,
              targets: [
                {
                  ...first,
                  startUrl:
                    "https://www.up.com/"
                },
                ...fixture.batch
                  .targets
                  .slice(1)
              ]
            },
            sampleId:
              "g13.sample.acceptance",
            frozenBy:
              "operator@example",
            frozenAt,
            maxDeliveryCostUsdPerBrief:
              12.5,
            costCeilingRationale:
              "Pre-frozen business ceiling.",
            humanBaselineDescription:
              "Measured human workflow."
          })
        ).toThrow(
          "canonical manifest-derived target"
        );
      }
    );

    it(
      "constructs acceptance baselines as measured-human records with deterministic identity",
      () => {
        const baseline =
          buildGate13HumanBaselineInput({
            sampleId:
              "g13.sample.acceptance",
            targetId:
              "g13.us.transport.unp",
            preparedBy:
              "researcher@example",
            humanPreparationMinutes:
              18.25,
            toolingDescription:
              "Normal browser, search, filings, and note-taking tools.",
            notes:
              null
          });
        const repeated =
          buildGate13HumanBaselineInput({
            sampleId:
              "g13.sample.acceptance",
            targetId:
              "g13.us.transport.unp",
            preparedBy:
              "researcher@example",
            humanPreparationMinutes:
              18.25,
            toolingDescription:
              "Normal browser, search, filings, and note-taking tools.",
            notes:
              null
          });

        expect(
          baseline.source
        ).toBe(
          "MEASURED_HUMAN"
        );
        expect(
          baseline.id
        ).toBe(
          repeated.id
        );
      }
    );

    it(
      "derives outcome provenance and disposition from durable sample, baseline, attempt, and review evidence",
      async () => {
        const fixture =
          await fixtures();
        const sample =
          buildGate13AcceptanceSample({
            ...fixture,
            approvalBatch:
              fixture.batch,
            sampleId:
              "g13.sample.acceptance",
            frozenBy:
              "operator@example",
            frozenAt,
            maxDeliveryCostUsdPerBrief:
              12.5,
            costCeilingRationale:
              "Pre-frozen business ceiling.",
            humanBaselineDescription:
              "Measured human workflow."
          });
        const target =
          sample.targets[0]!;
        const baselineInput =
          buildGate13HumanBaselineInput({
            sampleId:
              sample.id,
            targetId:
              target.id,
            preparedBy:
              "researcher@example",
            humanPreparationMinutes:
              20,
            toolingDescription:
              "Normal tools.",
            notes:
              null
          });
        const baseline =
          ProspectResearchHumanBaselineSchema
            .parse({
              ...baselineInput,
              recordedAt:
                "2026-09-21T12:02:00.000Z"
            });
        const attempt =
          ProspectResearchAttemptSchema
            .parse({
              id:
                "run.failed.example",
              target,
              startedAt:
                "2026-09-21T12:03:00.000Z",
              createdAt:
                "2026-09-21T12:04:00.000Z",
              status:
                "FAILED",
              runId:
                "run.failed.example",
              failure: {
                kind:
                  "LIVE_RESEARCH_FAILURE",
                code:
                  "ACCESS_BLOCKED",
                message:
                  "Public page blocked automated access."
              }
            });
        const review =
          parseGate13OutcomeReview(
            JSON.stringify({
              reviewedBy:
                "reviewer@example",
              reviewMode:
                "UNBLINDED",
              materialClaimsReviewed:
                0,
              unsupportedMaterialClaims:
                0,
              corrections: {
                minor:
                  0,
                major:
                  0,
                critical:
                  0
              },
              requestedFieldsTotal:
                4,
              requestedFieldsCovered:
                0,
              astraHumanTime: {
                targetSetupMinutes:
                  1,
                evidenceMappingAndAuditMinutes:
                  0,
                correctionAndFinalizationMinutes:
                  0,
                failureTriageMinutes:
                  2,
                otherMinutes:
                  0,
                measurementMethod:
                  "STOPWATCH",
                otherDescription:
                  null
              },
              endToEndDurationMs:
                45000,
              deliveryCostUsd:
                0.4,
              unauthorizedActions:
                0,
              notes:
                "Blocked target retained in denominator."
            })
          );
        const outcome =
          buildGate13SampleOutcome({
            sample,
            attempt,
            baseline,
            review,
            reviewedAt:
              "2026-09-21T12:05:00.000Z"
          });

        expect(
          outcome
            .briefDisposition
        ).toBe(
          "not_produced"
        );
        expect(
          outcome.baselineId
        ).toBe(
          baseline.id
        );
        expect(
          outcome.baselineSource
        ).toBe(
          "MEASURED_HUMAN"
        );
        expect(
          outcome
            .baselineMeasuredAt
        ).toBe(
          baseline.recordedAt
        );
        expect(
          outcome
            .baselineHumanPreparationMinutes
        ).toBe(20);
      }
    );
  }
);
