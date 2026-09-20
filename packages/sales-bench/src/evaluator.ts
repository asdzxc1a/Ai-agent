import {
  SalesDecisionSchema,
  validateDecisionEvidence,
  type SalesDecision
} from "@astra/sales-domain";

import type {
  SalesBenchScenario,
  SalesBenchScenarioResult,
  SalesBenchScores
} from "./types.js";

const SCORE_KEYS: readonly (keyof SalesBenchScores)[] = [
  "factuality",
  "evidenceUse",
  "relevance",
  "questionQuality",
  "informationGain",
  "qualificationQuality",
  "trust",
  "pressure",
  "nextStepQuality"
];

function mean(scores: SalesBenchScores): number {
  return SCORE_KEYS.reduce(
    (sum, key) => sum + scores[key],
    0
  ) / SCORE_KEYS.length;
}

function combinedText(decision: SalesDecision): string {
  return [
    decision.objective,
    decision.responseGuidance,
    decision.question ?? "",
    ...decision.claims.map((claim) => claim.statement)
  ].join(" ").toLowerCase();
}

function buyerVisibleText(
  decision: SalesDecision
): string {
  return [
    decision.responseGuidance,
    decision.question ?? "",
    ...decision.claims.map(
      (claim) =>
        claim.statement
    )
  ].join(" ").toLowerCase();
}

export function evaluateSalesDecision(
  scenario: SalesBenchScenario,
  rawDecision: unknown
): SalesBenchScenarioResult {
  const parsed = SalesDecisionSchema.safeParse(rawDecision);

  if (!parsed.success) {
    const scores: SalesBenchScores = {
      factuality: 0,
      evidenceUse: 0,
      relevance: 0,
      questionQuality: 0,
      informationGain: 0,
      qualificationQuality: 0,
      trust: 0,
      pressure: 0,
      nextStepQuality: 0
    };

    return {
      scenarioId: scenario.id,
      passed: false,
      hardFailures: ["decision_schema_invalid"],
      scores,
      meanScore: 0,
      decision: null
    };
  }

  const decision = parsed.data;
  const hardFailures: string[] = [];
  const actionAllowed = scenario.expected.allowedActions.includes(
    decision.nextAction.kind
  );

  if (!actionAllowed) {
    hardFailures.push(
      `next_action_not_allowed:${decision.nextAction.kind}`
    );
  }

  const hasQuestion = Boolean(decision.question);
  if (scenario.expected.questionRequired && !hasQuestion) {
    hardFailures.push("required_question_missing");
  }

  if (
    scenario.expected.questionTarget !== null &&
    decision.questionTarget !== scenario.expected.questionTarget
  ) {
    hardFailures.push(
      `wrong_question_target:${decision.questionTarget ?? "null"}`
    );
  }

  const evidenceErrors = validateDecisionEvidence({
    decision,
    evidence: scenario.input.availableEvidence,
    serviceOffer: scenario.input.serviceOffer
  });
  hardFailures.push(...evidenceErrors.map((error) => `evidence:${error}`));

  const lower = combinedText(decision);
  for (const forbidden of scenario.expected.forbiddenText) {
    if (lower.includes(forbidden.toLowerCase())) {
      hardFailures.push(`forbidden_text:${forbidden}`);
    }
  }

  const visibleText =
    buyerVisibleText(
      decision
    );

  for (
    const prohibited of
    scenario.input.serviceOffer
      .prohibitedClaims
  ) {
    const lowerProhibited =
      prohibited.toLowerCase();

    for (
      const claim of
      decision.claims
    ) {
      if (
        claim.statement
          .toLowerCase()
          .includes(
            lowerProhibited
          )
      ) {
        hardFailures.push(
          `prohibited_claim:${prohibited}`
        );
      }
    }

    if (
      visibleText.includes(
        lowerProhibited
      )
    ) {
      hardFailures.push(
        `prohibited_buyer_text:${prohibited}`
      );
    }
  }

  const evidenceUse = scenario.expected.evidenceExpected
    ? Number(decision.claims.length > 0 && evidenceErrors.length === 0)
    : Number(evidenceErrors.length === 0);

  const questionTargetCorrect = scenario.expected.questionTarget === null
    ? true
    : decision.questionTarget === scenario.expected.questionTarget;

  const questionQuality = scenario.expected.questionRequired
    ? Number(hasQuestion && questionTargetCorrect)
    : 1;

  const scores: SalesBenchScores = {
    factuality: Number(
      !hardFailures.some((failure) =>
        failure.startsWith("evidence:") ||
        failure.startsWith("prohibited_claim:") ||
        failure.startsWith("prohibited_buyer_text:") ||
        failure.startsWith("forbidden_text:")
      )
    ),
    evidenceUse,
    relevance: Number(actionAllowed),
    questionQuality,
    informationGain: scenario.expected.questionRequired
      ? questionQuality
      : 1,
    qualificationQuality: questionQuality,
    trust: Number(
      !hardFailures.some((failure) =>
        failure.startsWith("forbidden_text:") ||
        failure.startsWith("prohibited_claim:") ||
        failure.startsWith("prohibited_buyer_text:")
      )
    ),
    pressure: Number(
      !hardFailures.some((failure) =>
        failure.startsWith("forbidden_text:")
      )
    ),
    nextStepQuality: Number(actionAllowed)
  };

  return {
    scenarioId: scenario.id,
    passed: hardFailures.length === 0,
    hardFailures,
    scores,
    meanScore: mean(scores),
    decision
  };
}
