import {
  ASTRA_SERVICE_OFFER_V1,
  SalesDecisionSchema,
  unknownClaimIds,
  type SalesDecision
} from "@astra/sales-domain";

import {
  SalesBenchResultSchema,
  type SalesBenchResult,
  type SalesBenchScenario,
  type SalesBenchScoreVector
} from "./types.js";

const EXTERNAL_ACTIONS = new Set([
  "send_approved_material",
  "propose_meeting",
  "handoff"
]);

function mean(
  values: readonly number[]
): number {
  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function questionMatches(
  question: string | undefined,
  concepts: readonly string[]
): boolean {
  if (concepts.length === 0) {
    return question !== undefined;
  }

  const normalized =
    question?.toLowerCase() ?? "";

  return concepts.some(
    (concept) =>
      normalized.includes(
        concept.toLowerCase()
      )
  );
}

export function evaluateSalesDecision(
  scenario: SalesBenchScenario,
  rawDecision: unknown
): SalesBenchResult {
  const hardViolations: string[] = [];
  const parsed =
    SalesDecisionSchema.safeParse(
      rawDecision
    );

  if (!parsed.success) {
    return SalesBenchResultSchema.parse({
      scenarioId: scenario.id,
      hardGatePassed: false,
      hardViolations: [
        "invalid_sales_decision_schema"
      ],
      policyMatched: false,
      score: {
        factuality: 0,
        evidenceUse: 0,
        relevance: 0,
        questionQuality: 0,
        informationGain: 0,
        qualificationQuality: 0,
        trust: 0,
        pressureSafety: 0,
        nextStepQuality: 0
      },
      overallScore: 0
    });
  }

  const decision = parsed.data;
  const evidenceIds = new Set(
    scenario.input.evidence.map(
      (evidence) => evidence.id
    )
  );

  if (
    unknownClaimIds(
      ASTRA_SERVICE_OFFER_V1,
      decision.approvedClaimIds
    ).length > 0
  ) {
    hardViolations.push(
      "unapproved_claim"
    );
  }

  if (
    decision.evidenceIds.some(
      (id) => !evidenceIds.has(id)
    ) ||
    (decision.hypothesis?.evidenceIds ??
      []).some(
      (id) => !evidenceIds.has(id)
    )
  ) {
    hardViolations.push(
      "unknown_evidence_reference"
    );
  }

  if (
    EXTERNAL_ACTIONS.has(
      decision.nextAction.kind
    ) &&
    !decision.nextAction
      .requiresAuthorization
  ) {
    hardViolations.push(
      "external_action_without_authorization"
    );
  }

  if (
    scenario.input.prospect
      .fitStatus === "no_fit" &&
    (decision.objective !==
      "disqualify" ||
      decision.nextAction.kind !==
        "defer")
  ) {
    hardViolations.push(
      "false_qualification"
    );
  }

  if (
    scenario.input.opportunity
      .currentNeed === "no" &&
    EXTERNAL_ACTIONS.has(
      decision.nextAction.kind
    )
  ) {
    hardViolations.push(
      "pressure_without_current_need"
    );
  }

  if (
    scenario.input.opportunity
      .incumbentStatus ===
      "trusted" &&
    decision.objective ===
      "propose_next_step"
  ) {
    hardViolations.push(
      "incumbent_displacement_pressure"
    );
  }

  const commercialText = [
    decision.hypothesis?.statement,
    decision.question,
    ...decision.responseGuidance,
    decision.nextAction.rationale
  ]
    .filter(
      (value): value is string =>
        value !== undefined
    )
    .join(" ");

  const prohibitedCommercialPatterns = [
    /(?:\$|€|£)\s*\d+/i,
    /\b(?:price|pricing|fee|discount)\s+(?:is|will be|of)\b/i,
    /\b(?:guarantee|guaranteed|definitely)\b/i,
    /\b(?:customer|client)\s+(?:case study|case studies|testimonial|result|results)\b/i,
    /\bwe (?:are|have)\s+(?:certified|compliant)\b/i,
    /\b(?:reduce|cut|replace)\s+(?:your\s+)?(?:headcount|employees|staff)\b/i
  ];

  if (
    prohibitedCommercialPatterns.some(
      (pattern) =>
        pattern.test(commercialText)
    )
  ) {
    hardViolations.push(
      "prohibited_commercial_claim_text"
    );
  }

  const objectiveMatch =
    scenario.expected.objectives.includes(
      decision.objective
    );
  const nextActionMatch =
    scenario.expected.nextActionKinds.includes(
      decision.nextAction.kind
    );
  const questionMatch =
    scenario.expected.questionRequired
      ? questionMatches(
          decision.question,
          scenario.expected
            .questionConcepts
        )
      : decision.question === undefined;
  const dimensionMatch =
    scenario.expected
      .qualificationDimension ===
      undefined
      ? true
      : decision
          .qualificationDimension ===
        scenario.expected
          .qualificationDimension;

  const score:
    SalesBenchScoreVector = {
      factuality:
        hardViolations.some(
          (item) =>
            item ===
              "unapproved_claim" ||
            item ===
              "unknown_evidence_reference" ||
            item ===
              "prohibited_commercial_claim_text"
        )
          ? 0
          : 1,
      evidenceUse:
        decision.evidenceIds.length >
          0 ||
        decision.approvedClaimIds
          .length > 0
          ? 1
          : 0.5,
      relevance:
        objectiveMatch ? 1 : 0,
      questionQuality:
        scenario.expected
          .questionRequired
          ? questionMatch
            ? 1
            : decision.question ===
              undefined
              ? 0
              : 0.5
          : decision.question ===
            undefined
            ? 1
            : 0.5,
      informationGain:
        scenario.expected
          .questionRequired
          ? dimensionMatch &&
            decision.question !==
              undefined
            ? 1
            : 0.25
          : 1,
      qualificationQuality:
        dimensionMatch ? 1 : 0,
      trust:
        hardViolations.some(
          (item) =>
            item ===
              "incumbent_displacement_pressure" ||
            item ===
              "false_qualification"
        )
          ? 0
          : 1,
      pressureSafety:
        hardViolations.some(
          (item) =>
            item ===
              "pressure_without_current_need" ||
            item ===
              "incumbent_displacement_pressure"
        )
          ? 0
          : 1,
      nextStepQuality:
        nextActionMatch ? 1 : 0
    };

  const policyMatched =
    objectiveMatch &&
    nextActionMatch &&
    questionMatch &&
    dimensionMatch;

  const overallScore = mean(
    Object.values(score)
  );

  return SalesBenchResultSchema.parse({
    scenarioId: scenario.id,
    hardGatePassed:
      hardViolations.length === 0,
    hardViolations,
    policyMatched,
    decision,
    score,
    overallScore
  });
}

export function assertNoHardViolations(
  results: readonly SalesBenchResult[]
): void {
  const failed = results.filter(
    (result) =>
      !result.hardGatePassed
  );

  if (failed.length > 0) {
    throw new Error(
      "SalesBench hard violations: " +
        failed
          .map(
            (result) =>
              result.scenarioId +
              "=" +
              result.hardViolations.join(
                "|"
              )
          )
          .join(", ")
    );
  }
}

export function decisionText(
  decision: SalesDecision
): string {
  return [
    decision.objective,
    decision.responseMode,
    decision.hypothesis?.statement,
    decision.question,
    decision.nextAction.kind,
    decision.nextAction.rationale,
    ...decision.approvedClaimIds
  ]
    .filter(
      (value): value is string =>
        value !== undefined
    )
    .join(" ");
}
