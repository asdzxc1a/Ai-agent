import {
  PROSPECT_RESEARCH_REQUESTED_FIELDS,
  ProspectResearchCostMeasurementsSchema,
  ProspectResearchDeliveryCostEvidenceSchema,
  ProspectResearchDeliveryCostPlanSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  type ProspectResearchAstraHumanTime,
  type ProspectResearchCostMeasurements,
  type ProspectResearchDeliveryCostEvidence,
  type ProspectResearchDeliveryCostPlan,
  type ProspectResearchDeliveryCostRate,
  type ProspectResearchAttempt,
  type ProspectResearchHumanBaseline,
  type ProspectResearchRequestedField,
  type ProspectResearchSample,
  type ProspectResearchSampleOutcome
} from "./schema.js";
import {
  sameApprovedResearchTarget
} from "./validation.js";

export interface ProspectResearchSampleMetrics {
  targetCount: number;
  outcomeCount: number;
  usableBriefRate: number;
  unsupportedMaterialClaims: number;
  medianHumanTimeReductionFraction:
    number | null;
  medianAstraHumanPreparationMinutes:
    number | null;
  requestedFieldCoverageRate:
    number;
  unauthorizedActions: number;
  maxDeliveryCostUsdPerBrief:
    number | null;
}

export interface ProspectResearchSampleEvaluation {
  complete: boolean;
  passed: boolean | null;
  metrics:
    ProspectResearchSampleMetrics;
  failures: string[];
}

function median(
  values: readonly number[]
): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted =
    [...values].sort(
      (left, right) =>
        left - right
    );
  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 1
  ) {
    return sorted[middle]!;
  }

  return (
    (
      sorted[middle - 1]! +
      sorted[middle]!
    ) / 2
  );
}

export function totalAstraHumanPreparationMinutes(
  time:
    ProspectResearchAstraHumanTime
): number {
  return (
    time.targetSetupMinutes +
    time
      .evidenceMappingAndAuditMinutes +
    time
      .correctionAndFinalizationMinutes +
    time.failureTriageMinutes +
    time.otherMinutes
  );
}


function attemptRunId(
  attempt:
    ProspectResearchAttempt
): string | null {
  return attempt.status ===
    "COMPLETED"
    ? attempt.report.runId
    : attempt.runId;
}

function costMeasurementsFromAttempt(
  attempt:
    ProspectResearchAttempt
): ProspectResearchCostMeasurements {
  const runDurationMs =
    attempt.runDurationMs;

  if (
    runDurationMs ===
      undefined
  ) {
    throw new Error(
      "Gate 13 delivery cost accounting requires server-derived run duration on the durable attempt."
    );
  }

  return ProspectResearchCostMeasurementsSchema
    .parse({
      modelUsage:
        attempt.modelUsage ===
          undefined
          ? null
          : {
              promptTokens:
                attempt.modelUsage
                  .promptTokens,
              completionTokens:
                attempt.modelUsage
                  .completionTokens,
              reasoningTokens:
                attempt.modelUsage
                  .reasoningTokens,
              cachedInputTokens:
                attempt.modelUsage
                  .cachedInputTokens
            },
      runDurationMs
    });
}

function costMeterQuantity(
  rate:
    ProspectResearchDeliveryCostRate,
  measurements:
    ProspectResearchCostMeasurements
): number {
  switch (rate.meter) {
    case "FIXED_PER_RUN":
      return 1;
    case "RUN_DURATION_MS":
      return measurements
        .runDurationMs;
    case "PROMPT_TOKENS":
    case "COMPLETION_TOKENS":
    case "REASONING_TOKENS":
    case "CACHED_INPUT_TOKENS": {
      const usage =
        measurements.modelUsage;

      if (usage === null) {
        throw new Error(
          "delivery cost plan requires model usage that was not captured: " +
            rate.meter
        );
      }

      switch (rate.meter) {
        case "PROMPT_TOKENS":
          return usage
            .promptTokens;
        case "COMPLETION_TOKENS":
          return usage
            .completionTokens;
        case "REASONING_TOKENS":
          return usage
            .reasoningTokens;
        case "CACHED_INPUT_TOKENS":
          return usage
            .cachedInputTokens;
      }
    }
  }

  throw new Error(
    "Unsupported delivery cost meter: " +
      String(
        rate.meter
      )
  );
}

function billedUnits(
  quantity: number,
  rate:
    ProspectResearchDeliveryCostRate
): number {
  const raw =
    quantity /
    rate.unitsPerBillingUnit;

  return rate.rounding ===
    "CEIL"
    ? Math.ceil(raw)
    : raw;
}

export function calculateProspectResearchDeliveryCost(
  planInput:
    ProspectResearchDeliveryCostPlan,
  measurementsInput:
    ProspectResearchCostMeasurements,
  runId: string
): ProspectResearchDeliveryCostEvidence {
  const plan =
    ProspectResearchDeliveryCostPlanSchema
      .parse(planInput);
  const measurements =
    ProspectResearchCostMeasurementsSchema
      .parse(
        measurementsInput
      );
  const components =
    plan.rates.map(
      (rate) => {
        const measuredQuantity =
          costMeterQuantity(
            rate,
            measurements
          );
        const units =
          billedUnits(
            measuredQuantity,
            rate
          );

        return {
          rateId:
            rate.id,
          category:
            rate.category,
          label:
            rate.label,
          meter:
            rate.meter,
          unitsPerBillingUnit:
            rate.unitsPerBillingUnit,
          usdPerBillingUnit:
            rate.usdPerBillingUnit,
          rounding:
            rate.rounding,
          sourceDescription:
            rate.sourceDescription,
          sourceUrl:
            rate.sourceUrl,
          sourceAsOfDate:
            rate.sourceAsOfDate,
          measuredQuantity,
          billedUnits:
            units,
          amountUsd:
            units *
            rate.usdPerBillingUnit
        };
      }
    );
  const totalUsd =
    components.reduce(
      (sum, component) =>
        sum +
        component.amountUsd,
      0
    );

  return ProspectResearchDeliveryCostEvidenceSchema
    .parse({
      version:
        plan.version,
      runId,
      components,
      totalUsd
    });
}

export function calculateProspectResearchDeliveryCostFromAttempt(
  plan:
    ProspectResearchDeliveryCostPlan,
  attempt:
    ProspectResearchAttempt
): ProspectResearchDeliveryCostEvidence {
  const runId =
    attemptRunId(
      attempt
    );

  if (
    runId === null
  ) {
    throw new Error(
      "Gate 13 measured attempt has no durable run ID for delivery cost accounting."
    );
  }

  return calculateProspectResearchDeliveryCost(
    plan,
    costMeasurementsFromAttempt(
      attempt
    ),
    runId
  );
}

function sameCostRateSnapshot(
  rate:
    ProspectResearchDeliveryCostRate,
  component:
    ProspectResearchDeliveryCostEvidence[
      "components"
    ][number]
): boolean {
  return (
    rate.id ===
      component.rateId &&
    rate.category ===
      component.category &&
    rate.label ===
      component.label &&
    rate.meter ===
      component.meter &&
    rate.unitsPerBillingUnit ===
      component.unitsPerBillingUnit &&
    rate.usdPerBillingUnit ===
      component.usdPerBillingUnit &&
    rate.rounding ===
      component.rounding &&
    rate.sourceDescription ===
      component.sourceDescription &&
    rate.sourceUrl ===
      component.sourceUrl &&
    rate.sourceAsOfDate ===
      component.sourceAsOfDate
  );
}

function assertDeliveryCostEvidenceMatchesPlan(
  plan:
    ProspectResearchDeliveryCostPlan,
  evidence:
    ProspectResearchDeliveryCostEvidence
): void {
  if (
    evidence.version !==
      plan.version ||
    evidence.components.length !==
      plan.rates.length ||
    plan.rates.some(
      (rate) => {
        const component =
          evidence.components
            .find(
              (candidate) =>
                candidate.rateId ===
                rate.id
            );

        return (
          component ===
            undefined ||
          !sameCostRateSnapshot(
            rate,
            component
          )
        );
      }
    )
  ) {
    throw new Error(
      "Gate 13 delivery cost evidence differs from the frozen cost plan."
    );
  }

  for (
    const component of
    evidence.components
  ) {
    const rate =
      plan.rates.find(
        (candidate) =>
          candidate.id ===
          component.rateId
      );

    if (rate === undefined) {
      throw new Error(
        "Gate 13 delivery cost evidence contains an unknown frozen rate."
      );
    }

    const expectedUnits =
      billedUnits(
        component
          .measuredQuantity,
        rate
      );
    const expectedAmount =
      expectedUnits *
      rate.usdPerBillingUnit;

    if (
      Math.abs(
        expectedUnits -
        component.billedUnits
      ) >
        1e-9 ||
      Math.abs(
        expectedAmount -
        component.amountUsd
      ) >
        1e-9
    ) {
      throw new Error(
        "Gate 13 delivery cost component does not match its frozen rate calculation: " +
          component.rateId
      );
    }
  }
}

function assertDeliveryCostEvidenceMatchesAttempt(
  plan:
    ProspectResearchDeliveryCostPlan,
  attempt:
    ProspectResearchAttempt,
  evidence:
    ProspectResearchDeliveryCostEvidence
): void {
  const expected =
    calculateProspectResearchDeliveryCostFromAttempt(
      plan,
      attempt
    );

  if (
    Math.abs(
      expected.totalUsd -
      evidence.totalUsd
    ) >
      1e-9 ||
    expected.components.length !==
      evidence.components.length
  ) {
    throw new Error(
      "Gate 13 delivery cost evidence differs from durable attempt measurements."
    );
  }

  for (
    const expectedComponent of
    expected.components
  ) {
    const actual =
      evidence.components
        .find(
          (component) =>
            component.rateId ===
              expectedComponent
                .rateId
        );

    if (
      actual ===
        undefined ||
      Math.abs(
        actual.measuredQuantity -
        expectedComponent
          .measuredQuantity
      ) >
        1e-9 ||
      Math.abs(
        actual.billedUnits -
        expectedComponent
          .billedUnits
      ) >
        1e-9 ||
      Math.abs(
        actual.amountUsd -
        expectedComponent
          .amountUsd
      ) >
        1e-9
    ) {
      throw new Error(
        "Gate 13 delivery cost evidence differs from durable attempt measurements."
      );
    }
  }
}

export function requiredMaterialClaimAuditCount(
  attempt:
    ProspectResearchAttempt
): number {
  return attempt.status ===
    "COMPLETED"
    ? attempt.report
        .evidence.length
    : 0;
}

export interface ProspectResearchRequestedFieldCoverage {
  requestedFields:
    readonly ProspectResearchRequestedField[];
  coveredFields:
    readonly ProspectResearchRequestedField[];
}

function completedFieldCovered(
  attempt:
    Extract<
      ProspectResearchAttempt,
      {
        status: "COMPLETED";
      }
    >,
  field:
    ProspectResearchRequestedField
): boolean {
  const unknownFields =
    new Set(
      attempt.report
        .unknowns.map(
          (unknown) =>
            unknown.field
        )
    );

  if (
    unknownFields.has(
      field
    )
  ) {
    return true;
  }

  switch (field) {
    case "companyName":
      return (
        attempt.report
          .prospect
          .companyName !==
          null
      );
    case "companySummary":
      return (
        attempt.report
          .companySummary
          .length >
          0
      );
    case "transformationOpportunities":
      return (
        attempt.report
          .transformationOpportunities
          .length >
          0
      );
    case "buyingSignals":
      return (
        attempt.report
          .buyingSignals
          .length >
          0
      );
  }

  const unsupported:
    never = field;

  throw new Error(
    "Unsupported requested research field: " +
      String(
        unsupported
      )
  );
}

export function deriveProspectResearchRequestedFieldCoverage(
  sample:
    ProspectResearchSample,
  attempt:
    ProspectResearchAttempt
): ProspectResearchRequestedFieldCoverage {
  const requestedFields =
    sample.requestedFields ??
    [];

  if (
    sample.purpose ===
      "ACCEPTANCE" &&
    (
      requestedFields.length !==
        PROSPECT_RESEARCH_REQUESTED_FIELDS
          .length ||
      PROSPECT_RESEARCH_REQUESTED_FIELDS
        .some(
          (field) =>
            !requestedFields.includes(
              field
            )
        )
    )
  ) {
    throw new Error(
      "Gate 13 acceptance sample is missing the exact frozen requested-field set."
    );
  }

  if (
    attempt.status ===
      "FAILED"
  ) {
    return {
      requestedFields,
      coveredFields: []
    };
  }

  return {
    requestedFields,
    coveredFields:
      requestedFields.filter(
        (field) =>
          completedFieldCovered(
            attempt,
            field
          )
      )
  };
}

export function validateProspectResearchSampleOutcomeContext(
  sampleInput:
    ProspectResearchSample,
  attempt:
    ProspectResearchAttempt,
  baseline:
    ProspectResearchHumanBaseline,
  outcomeInput:
    ProspectResearchSampleOutcome
): ProspectResearchSampleOutcome {
  const sample =
    ProspectResearchSampleSchema
      .parse(sampleInput);
  const outcome =
    ProspectResearchSampleOutcomeSchema
      .parse(outcomeInput);
  const frozenTarget =
    sample.targets.find(
      (target) =>
        target.id ===
        outcome.targetId
    );

  if (
    outcome.reviewRubricVersion !==
      sample.reviewRubricVersion
  ) {
    throw new Error(
      "Measured research outcome review rubric differs from the frozen sample."
    );
  }

  if (
    baseline.id !==
      outcome.baselineId ||
    baseline.sampleId !==
      sample.id ||
    baseline.targetId !==
      outcome.targetId
  ) {
    throw new Error(
      "Measured research outcome does not match the durable human baseline."
    );
  }

  if (
    baseline.source !==
      outcome.baselineSource ||
    baseline.recordedAt !==
      outcome.baselineMeasuredAt ||
    baseline.humanPreparationMinutes !==
      outcome.baselineHumanPreparationMinutes
  ) {
    throw new Error(
      "Measured research outcome human-baseline snapshot differs from durable baseline truth."
    );
  }

  if (
    outcome.sampleId !==
    sample.id
  ) {
    throw new Error(
      "Measured research outcome references the wrong frozen sample."
    );
  }

  if (
    frozenTarget === undefined
  ) {
    throw new Error(
      "Measured research outcome target is outside the frozen sample."
    );
  }

  if (
    attempt.id !==
    outcome.attemptId ||
    attempt.status !==
    outcome.attemptStatus
  ) {
    throw new Error(
      "Measured research outcome does not match the durable research attempt."
    );
  }

  if (
    attempt.target.id !==
      outcome.targetId ||
    !sameApprovedResearchTarget(
      frozenTarget,
      attempt.target
    )
  ) {
    throw new Error(
      "Measured research outcome attempt target differs from the frozen sample."
    );
  }


  const requiredAuditCount =
    requiredMaterialClaimAuditCount(
      attempt
    );

  if (
    outcome
      .materialClaimsReviewed !==
      requiredAuditCount
  ) {
    throw new Error(
      "Measured research outcome materialClaimsReviewed must equal the durable observed-evidence audit count: " +
        requiredAuditCount
    );
  }

  if (
    sample.purpose ===
      "ACCEPTANCE"
  ) {
    const coverage =
      deriveProspectResearchRequestedFieldCoverage(
        sample,
        attempt
      );
    const coveredIds =
      outcome
        .requestedFieldsCoveredIds;

    if (
      coveredIds ===
        undefined ||
      outcome
        .requestedFieldsTotal !==
        coverage
          .requestedFields
          .length ||
      outcome
        .requestedFieldsCovered !==
        coverage
          .coveredFields
          .length ||
      coveredIds.length !==
        coverage
          .coveredFields
          .length ||
      coverage
        .coveredFields
        .some(
          (field) =>
            !coveredIds.includes(
              field
            )
        )
    ) {
      throw new Error(
        "Gate 13 requested-field coverage must match the frozen field set and durable research attempt."
      );
    }
  }

  if (
    sample.purpose ===
      "ACCEPTANCE"
  ) {
    if (
      attempt.runDurationMs ===
        undefined ||
      attempt.unauthorizedActions ===
        undefined
    ) {
      throw new Error(
        "Gate 13 acceptance attempt is missing server-derived run measurements."
      );
    }

    if (
      outcome.endToEndDurationMs !==
        attempt.runDurationMs ||
      outcome.unauthorizedActions !==
        attempt.unauthorizedActions
    ) {
      throw new Error(
        "Gate 13 outcome run duration/action audit differs from durable attempt truth."
      );
    }
  }

  if (
    sample.purpose ===
      "ACCEPTANCE"
  ) {
    const plan =
      sample.deliveryCostPlan;
    const evidence =
      outcome.deliveryCostEvidence;
    const runId =
      attemptRunId(
        attempt
      );

    if (
      plan === undefined ||
      evidence === undefined
    ) {
      throw new Error(
        "Gate 13 acceptance outcomes require frozen, source-attributed delivery cost evidence."
      );
    }

    if (
      runId === null ||
      evidence.runId !==
        runId
    ) {
      throw new Error(
        "Gate 13 delivery cost evidence must reference the durable research run."
      );
    }

    assertDeliveryCostEvidenceMatchesPlan(
      plan,
      evidence
    );
    assertDeliveryCostEvidenceMatchesAttempt(
      plan,
      attempt,
      evidence
    );

    if (
      Math.abs(
        outcome.deliveryCostUsd -
        evidence.totalUsd
      ) >
        1e-9
    ) {
      throw new Error(
        "Gate 13 delivery cost total differs from source-attributed cost evidence."
      );
    }
  }

  if (
    sample.purpose ===
      "ACCEPTANCE" &&
    baseline.source !==
      "MEASURED_HUMAN"
  ) {
    throw new Error(
      "Gate 13 acceptance outcomes require a measured human baseline."
    );
  }

  if (
    sample.purpose ===
      "ACCEPTANCE" &&
    Date.parse(
      baseline.recordedAt
    ) >
      Date.parse(
        attempt.startedAt
      )
  ) {
    throw new Error(
      "Gate 13 acceptance human baseline must be measured before the Astra attempt starts."
    );
  }

  return outcome;
}

export function evaluateProspectResearchSample(
  sampleInput:
    ProspectResearchSample,
  outcomeInputs:
    readonly ProspectResearchSampleOutcome[]
): ProspectResearchSampleEvaluation {
  const sample =
    ProspectResearchSampleSchema
      .parse(sampleInput);
  const outcomes =
    outcomeInputs.map(
      (outcome) =>
        ProspectResearchSampleOutcomeSchema
          .parse(outcome)
    );
  const targetIds =
    new Set(
      sample.targets.map(
        (target) => target.id
      )
    );
  const outcomeTargetIds =
    outcomes.map(
      (outcome) =>
        outcome.targetId
    );
  const failures: string[] = [];

  if (
    new Set(
      outcomeTargetIds
    ).size !==
      outcomeTargetIds.length
  ) {
    failures.push(
      "sample contains multiple outcomes for one frozen target"
    );
  }

  const outside =
    outcomes.find(
      (outcome) =>
        outcome.sampleId !==
          sample.id ||
        !targetIds.has(
          outcome.targetId
        )
    );

  if (outside !== undefined) {
    failures.push(
      "sample outcome references a different sample or target outside the frozen cohort"
    );
  }

  if (
    sample.purpose ===
      "ACCEPTANCE"
  ) {
    const requestedFields =
      sample.requestedFields!;

    for (
      const outcome of
      outcomes
    ) {
      const coveredIds =
        outcome
          .requestedFieldsCoveredIds;

      if (
        outcome
          .requestedFieldsTotal !==
          requestedFields.length ||
        coveredIds ===
          undefined ||
        outcome
          .requestedFieldsCovered !==
          coveredIds.length ||
        coveredIds.some(
          (field) =>
            !requestedFields.includes(
              field
            )
        )
      ) {
        failures.push(
          "acceptance outcome requested-field coverage differs from the frozen field ledger"
        );
        break;
      }
    }
  }

  if (
    sample.purpose ===
      "ACCEPTANCE"
  ) {
    const plan =
      sample.deliveryCostPlan!;

    for (
      const outcome of
      outcomes
    ) {
      const evidence =
        outcome.deliveryCostEvidence;

      if (evidence === undefined) {
        failures.push(
          "acceptance outcome is missing source-attributed delivery cost evidence"
        );
        break;
      }

      try {
        assertDeliveryCostEvidenceMatchesPlan(
          plan,
          evidence
        );

        if (
          Math.abs(
            outcome.deliveryCostUsd -
            evidence.totalUsd
          ) >
            1e-9
        ) {
          throw new Error(
            "delivery cost total mismatch"
          );
        }
      } catch {
        failures.push(
          "acceptance outcome delivery cost evidence differs from the frozen plan"
        );
        break;
      }
    }
  }

  const complete =
    failures.length === 0 &&
    outcomes.length ===
      sample.targets.length &&
    sample.targets.every(
      (target) =>
        outcomes.some(
          (outcome) =>
            outcome.targetId ===
            target.id
        )
    );
  const usable =
    outcomes.filter(
      (outcome) =>
        outcome
          .briefDisposition ===
          "accepted" ||
        outcome
          .briefDisposition ===
          "minor_edit"
    ).length;
  const unsupported =
    outcomes.reduce(
      (sum, outcome) =>
        sum +
        outcome
          .unsupportedMaterialClaims,
      0
    );
  const unauthorized =
    outcomes.reduce(
      (sum, outcome) =>
        sum +
        outcome
          .unauthorizedActions,
      0
    );
  const totalRequested =
    outcomes.reduce(
      (sum, outcome) =>
        sum +
        outcome
          .requestedFieldsTotal,
      0
    );
  const totalCovered =
    outcomes.reduce(
      (sum, outcome) =>
        sum +
        outcome
          .requestedFieldsCovered,
      0
    );
  const astraHumanMinutes =
    outcomes.map(
      (outcome) =>
        totalAstraHumanPreparationMinutes(
          outcome.astraHumanTime
        )
    );
  const timeReductions =
    outcomes.map(
      (outcome, index) =>
        (
          outcome
            .baselineHumanPreparationMinutes -
          astraHumanMinutes[index]!
        ) /
        outcome
          .baselineHumanPreparationMinutes
    );
  const maxCost =
    outcomes.length === 0
      ? null
      : Math.max(
          ...outcomes.map(
            (outcome) =>
              outcome
                .deliveryCostUsd
          )
        );
  const metrics:
    ProspectResearchSampleMetrics = {
      targetCount:
        sample.targets.length,
      outcomeCount:
        outcomes.length,
      usableBriefRate:
        sample.targets.length === 0
          ? 0
          : usable /
            sample.targets.length,
      unsupportedMaterialClaims:
        unsupported,
      medianHumanTimeReductionFraction:
        median(
          timeReductions
        ),
      medianAstraHumanPreparationMinutes:
        median(
          astraHumanMinutes
        ),
      requestedFieldCoverageRate:
        totalRequested === 0
          ? 0
          : totalCovered /
            totalRequested,
      unauthorizedActions:
        unauthorized,
      maxDeliveryCostUsdPerBrief:
        maxCost
    };

  if (!complete) {
    return {
      complete: false,
      passed: null,
      metrics,
      failures
    };
  }

  if (
    sample.purpose ===
    "CALIBRATION"
  ) {
    return {
      complete: true,
      passed: null,
      metrics,
      failures: []
    };
  }

  if (
    unsupported >
    sample.criteria
      .maxUnsupportedMaterialClaims
  ) {
    failures.push(
      "unsupported material claim threshold exceeded"
    );
  }

  if (
    metrics.usableBriefRate <
    sample.criteria
      .minUsableBriefRate
  ) {
    failures.push(
      "usable brief rate is below the frozen threshold"
    );
  }

  if (
    metrics
      .medianHumanTimeReductionFraction ===
      null ||
    metrics
      .medianHumanTimeReductionFraction <
      sample.criteria
        .minMedianHumanTimeReductionFraction
  ) {
    failures.push(
      "median human time reduction is below the frozen threshold"
    );
  }

  if (
    sample.criteria
      .requireNoUnauthorizedActions &&
    unauthorized !== 0
  ) {
    failures.push(
      "unauthorized action count is non-zero"
    );
  }

  if (
    maxCost === null ||
    maxCost >
      sample.criteria
        .maxDeliveryCostUsdPerBrief
  ) {
    failures.push(
      "delivery cost exceeds the frozen per-brief threshold"
    );
  }

  return {
    complete: true,
    passed:
      failures.length === 0,
    metrics,
    failures
  };
}
