import {
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  type ProspectResearchAstraHumanTime,
  type ProspectResearchAttempt,
  type ProspectResearchHumanBaseline,
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
