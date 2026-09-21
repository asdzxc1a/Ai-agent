import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildGate13ExecutionProfile
} from "../src/execution-profile.js";
import {
  gate13AcceptanceInputPreflight,
  gate13PreflightReadiness
} from "../src/preflight.js";

const stagehandPackageText =
  JSON.stringify({
    dependencies: {
      "@browserbasehq/stagehand":
        "3.7.0"
    }
  });
const steelImagePinText =
  "ghcr.io/steel-dev/steel-browser@sha256:" +
  "a".repeat(64);

function executionProfile() {
  return buildGate13ExecutionProfile({
    modelName:
      "fixture/model-v1",
    modelBaseUrl:
      "http://127.0.0.1:4010/v1",
    steelBaseUrl:
      "http://127.0.0.1:3000",
    stagehandPackageText,
    steelImagePinText
  });
}

function targetIds() {
  return Array.from(
    {
      length: 43
    },
    (_value, index) =>
      "g13.target." +
      String(
        index + 1
      ).padStart(
        2,
        "0"
      )
  );
}

function costPlan() {
  return {
    version:
      "gate13-delivery-cost-v1" as const,
    methodologyDescription:
      "Fixture source-attributed model and self-hosted browser allocation.",
    rates: [
      {
        id:
          "cost.model",
        category:
          "MODEL" as const,
        label:
          "Fixture model",
        meter:
          "FIXED_PER_RUN" as const,
        unitsPerBillingUnit:
          1,
        usdPerBillingUnit:
          1,
        rounding:
          "NONE" as const,
        sourceDescription:
          "Fixture model allocation.",
        sourceUrl:
          "https://example.test/model",
        sourceAsOfDate:
          "2026-09-21"
      },
      {
        id:
          "cost.browser",
        category:
          "BROWSER_PROVIDER" as const,
        label:
          "Fixture browser",
        meter:
          "FIXED_PER_RUN" as const,
        unitsPerBillingUnit:
          1,
        usdPerBillingUnit:
          0.5,
        rounding:
          "NONE" as const,
        sourceDescription:
          "Fixture self-hosted browser allocation.",
        sourceUrl:
          "https://example.test/browser",
        sourceAsOfDate:
          "2026-09-21"
      }
    ]
  };
}

function preparation() {
  const ids =
    targetIds();
  const profile =
    executionProfile();

  return {
    manifest: {
      id:
        "g13-us-transportation-approval-candidates-2026-09-20",
      sha256:
        "9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109",
      status:
        "NOT_APPROVED" as const,
      targetIds:
        ids
    },
    universe: {
      id:
        "g13-us-transportation-iyt-2026-09-17",
      targetIds:
        ids
    },
    expectedExecutionProfile:
      profile,
    actualExecutionProfile:
      profile,
    deliveryCostPlan:
      costPlan(),
    maxDeliveryCostUsdPerBrief:
      12.5,
    costCeilingRationale:
      "Business and engineering delivery-cost ceiling frozen before results.",
    humanBaselineDescription:
      "A skilled human researcher uses the existing normal research workflow and normal tools.",
    preflightAt:
      "2026-09-21T12:00:00.000Z"
  };
}

describe(
  "Gate 13 acceptance input preflight",
  () => {
    it(
      "returns prepared-not-authorized without creating authorization state",
      () => {
        expect(
          gate13AcceptanceInputPreflight(
            preparation()
          )
        ).toMatchObject({
          status:
            "PREPARED_NOT_AUTHORIZED",
          targetCount: 43,
          requestedFields: [
            "companyName",
            "companySummary",
            "transformationOpportunities",
            "buyingSignals"
          ],
          costRateCount: 2,
          costCategories: [
            "BROWSER_PROVIDER",
            "MODEL"
          ],
          maxDeliveryCostUsdPerBrief:
            12.5
        });
      }
    );

    it(
      "rejects manifest/universe drift and execution-profile drift",
      () => {
        const membership =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...membership,
            universe: {
              ...membership
                .universe,
              targetIds:
                membership
                  .universe
                  .targetIds
                  .slice(
                    0,
                    42
                  )
            }
          })
        ).toThrow(
          "membership differ"
        );

        const profileDrift =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...profileDrift,
            actualExecutionProfile: {
              ...profileDrift
                .actualExecutionProfile,
              modelName:
                "fixture/other-model"
            }
          })
        ).toThrow(
          "modelName"
        );
      }
    );

    it(
      "rejects incomplete cost categories and unfrozen business inputs",
      () => {
        const missingBrowser =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...missingBrowser,
            deliveryCostPlan: {
              ...missingBrowser
                .deliveryCostPlan,
              rates: [
                missingBrowser
                  .deliveryCostPlan
                  .rates[0]!,
                {
                  ...missingBrowser
                    .deliveryCostPlan
                    .rates[0]!,
                  id:
                    "cost.model.second"
                }
              ]
            }
          })
        ).toThrow(
          "MODEL and BROWSER_PROVIDER"
        );

        const ceiling =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...ceiling,
            maxDeliveryCostUsdPerBrief:
              0
          })
        ).toThrow(
          "positive finite"
        );

        const rationale =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...rationale,
            costCeilingRationale:
              "   "
          })
        ).toThrow(
          "cost ceiling rationale"
        );

        const baseline =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...baseline,
            humanBaselineDescription:
              ""
          })
        ).toThrow(
          "human baseline description"
        );

        const futureRate =
          preparation();

        expect(() =>
          gate13AcceptanceInputPreflight({
            ...futureRate,
            deliveryCostPlan: {
              ...futureRate
                .deliveryCostPlan,
              rates:
                futureRate
                  .deliveryCostPlan
                  .rates.map(
                    (rate, index) =>
                      index === 0
                        ? {
                            ...rate,
                            sourceAsOfDate:
                              "2026-09-22"
                          }
                        : rate
                  )
            }
          })
        ).toThrow(
          "must not be after the preflight timestamp"
        );
      }
    );
  }
);

describe(
  "Gate 13 durable readiness preflight",
  () => {
    it(
      "keeps candidate metadata separate from authorization",
      () => {
        expect(
          gate13PreflightReadiness({
            approvalBatchPresent:
              false,
            sampleFrozen:
              false,
            targetCount: 43,
            baselineCount: 0,
            outcomeCount: 0
          })
        ).toMatchObject({
          nextTransition:
            "PERSIST_ATOMIC_APPROVAL_BATCH",
          canFreezeSample:
            false
        });
      }
    );

    it(
      "orders sample freeze, baselines, reviewed outcomes, then evaluation",
      () => {
        expect(
          gate13PreflightReadiness({
            approvalBatchPresent:
              true,
            sampleFrozen:
              false,
            targetCount: 43,
            baselineCount: 0,
            outcomeCount: 0
          }).nextTransition
        ).toBe(
          "FREEZE_ACCEPTANCE_SAMPLE"
        );

        expect(
          gate13PreflightReadiness({
            approvalBatchPresent:
              true,
            sampleFrozen:
              true,
            targetCount: 43,
            baselineCount: 42,
            outcomeCount: 0
          }).nextTransition
        ).toBe(
          "RECORD_MEASURED_HUMAN_BASELINES"
        );

        expect(
          gate13PreflightReadiness({
            approvalBatchPresent:
              true,
            sampleFrozen:
              true,
            targetCount: 43,
            baselineCount: 43,
            outcomeCount: 12
          }).nextTransition
        ).toBe(
          "RUN_REVIEW_REMAINING_TARGETS"
        );

        expect(
          gate13PreflightReadiness({
            approvalBatchPresent:
              true,
            sampleFrozen:
              true,
            targetCount: 43,
            baselineCount: 43,
            outcomeCount: 43
          }).nextTransition
        ).toBe(
          "EVALUATE_COMPLETE_COHORT"
        );
      }
    );

    it(
      "rejects impossible durable-state counts",
      () => {
        for (
          const state of [
            {
              approvalBatchPresent:
                true,
              sampleFrozen:
                true,
              targetCount: 43,
              baselineCount: 44,
              outcomeCount: 0
            },
            {
              approvalBatchPresent:
                true,
              sampleFrozen:
                true,
              targetCount: 43,
              baselineCount: 1,
              outcomeCount: 2
            },
            {
              approvalBatchPresent:
                true,
              sampleFrozen:
                false,
              targetCount: 43,
              baselineCount: 1,
              outcomeCount: 0
            },
            {
              approvalBatchPresent:
                false,
              sampleFrozen:
                true,
              targetCount: 43,
              baselineCount: 0,
              outcomeCount: 0
            }
          ]
        ) {
          expect(() =>
            gate13PreflightReadiness(
              state
            )
          ).toThrow(
            "preflight counts are invalid"
          );
        }
      }
    );
  }
);
