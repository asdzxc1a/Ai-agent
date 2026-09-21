import {
  PROSPECT_RESEARCH_REQUESTED_FIELDS,
  ProspectResearchDeliveryCostPlanSchema,
  ProspectResearchExecutionProfileSchema,
  type ProspectResearchDeliveryCostPlan,
  type ProspectResearchExecutionProfile
} from "@astra/prospect-research";

import {
  assertGate13ExecutionProfileMatches
} from "./execution-profile.js";

export type Gate13PreflightTransition =
  | "PERSIST_ATOMIC_APPROVAL_BATCH"
  | "FREEZE_ACCEPTANCE_SAMPLE"
  | "RECORD_MEASURED_HUMAN_BASELINES"
  | "RUN_REVIEW_REMAINING_TARGETS"
  | "EVALUATE_COMPLETE_COHORT";

export interface Gate13PreflightState {
  approvalBatchPresent: boolean;
  sampleFrozen: boolean;
  targetCount: number;
  baselineCount: number;
  outcomeCount: number;
}

export interface Gate13PreflightReadiness {
  nextTransition:
    Gate13PreflightTransition;
  canFreezeSample: boolean;
  allBaselinesRecorded: boolean;
  allOutcomesRecorded: boolean;
  blockers: string[];
}

export interface Gate13PreparedManifest {
  id: string;
  sha256: string;
  status: "NOT_APPROVED";
  targetIds: readonly string[];
}

export interface Gate13PreparedUniverse {
  id: string;
  targetIds: readonly string[];
}

export interface Gate13AcceptanceInputPreparation {
  manifest:
    Gate13PreparedManifest;
  universe:
    Gate13PreparedUniverse;
  expectedExecutionProfile:
    ProspectResearchExecutionProfile;
  actualExecutionProfile:
    ProspectResearchExecutionProfile;
  deliveryCostPlan:
    ProspectResearchDeliveryCostPlan;
  maxDeliveryCostUsdPerBrief: number;
  costCeilingRationale: string;
  humanBaselineDescription: string;
}

export interface Gate13AcceptanceInputPreflight {
  status:
    "PREPARED_NOT_AUTHORIZED";
  manifestId: string;
  manifestSha256: string;
  universeId: string;
  targetCount: number;
  requestedFields:
    readonly string[];
  maxDeliveryCostUsdPerBrief:
    number;
  costRateCount: number;
  costCategories:
    string[];
  executionProfile:
    ProspectResearchExecutionProfile;
}

function assertExactMembership(
  expected:
    readonly string[],
  actual:
    readonly string[]
): void {
  if (
    expected.length !==
      actual.length ||
    new Set(expected).size !==
      expected.length ||
    new Set(actual).size !==
      actual.length ||
    expected.some(
      (id) =>
        !actual.includes(id)
    )
  ) {
    throw new Error(
      "Gate 13 preflight manifest and frozen universe membership differ."
    );
  }
}

function nonblank(
  value: string,
  label: string,
  max: number
): string {
  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > max
  ) {
    throw new Error(
      label +
        " must be non-empty and no longer than " +
        String(max) +
        " characters."
    );
  }

  return normalized;
}

export function gate13AcceptanceInputPreflight(
  input:
    Gate13AcceptanceInputPreparation
): Gate13AcceptanceInputPreflight {
  if (
    input.manifest.status !==
      "NOT_APPROVED"
  ) {
    throw new Error(
      "Gate 13 candidate manifest must remain NOT_APPROVED before the authorization transition."
    );
  }

  assertExactMembership(
    input.universe.targetIds,
    input.manifest.targetIds
  );

  if (
    input.manifest.targetIds.length !==
      43
  ) {
    throw new Error(
      "Gate 13 acceptance preflight requires exactly 43 canonical targets."
    );
  }

  const expectedProfile =
    ProspectResearchExecutionProfileSchema
      .parse(
        input
          .expectedExecutionProfile
      );
  const actualProfile =
    ProspectResearchExecutionProfileSchema
      .parse(
        input
          .actualExecutionProfile
      );

  assertGate13ExecutionProfileMatches(
    expectedProfile,
    actualProfile
  );

  const plan =
    ProspectResearchDeliveryCostPlanSchema
      .parse(
        input.deliveryCostPlan
      );
  const categories =
    [
      ...new Set(
        plan.rates.map(
          (rate) =>
            rate.category
        )
      )
    ];

  if (
    !categories.includes(
      "MODEL"
    ) ||
    !categories.includes(
      "BROWSER_PROVIDER"
    )
  ) {
    throw new Error(
      "Gate 13 acceptance cost plan requires MODEL and BROWSER_PROVIDER categories."
    );
  }

  if (
    !Number.isFinite(
      input
        .maxDeliveryCostUsdPerBrief
    ) ||
    input
      .maxDeliveryCostUsdPerBrief <=
      0
  ) {
    throw new Error(
      "Gate 13 acceptance cost ceiling must be a positive finite number."
    );
  }

  nonblank(
    input.costCeilingRationale,
    "Gate 13 cost ceiling rationale",
    2000
  );
  nonblank(
    input.humanBaselineDescription,
    "Gate 13 human baseline description",
    4000
  );

  return {
    status:
      "PREPARED_NOT_AUTHORIZED",
    manifestId:
      input.manifest.id,
    manifestSha256:
      input.manifest.sha256,
    universeId:
      input.universe.id,
    targetCount:
      input.manifest
        .targetIds.length,
    requestedFields: [
      ...PROSPECT_RESEARCH_REQUESTED_FIELDS
    ],
    maxDeliveryCostUsdPerBrief:
      input
        .maxDeliveryCostUsdPerBrief,
    costRateCount:
      plan.rates.length,
    costCategories:
      categories.sort(),
    executionProfile:
      actualProfile
  };
}

export function gate13PreflightReadiness(
  input:
    Gate13PreflightState
): Gate13PreflightReadiness {
  if (
    !Number.isInteger(
      input.targetCount
    ) ||
    input.targetCount <= 0 ||
    !Number.isInteger(
      input.baselineCount
    ) ||
    input.baselineCount < 0 ||
    input.baselineCount >
      input.targetCount ||
    !Number.isInteger(
      input.outcomeCount
    ) ||
    input.outcomeCount < 0 ||
    input.outcomeCount >
      input.targetCount ||
    input.outcomeCount >
      input.baselineCount ||
    (
      !input.sampleFrozen &&
      (
        input.baselineCount !==
          0 ||
        input.outcomeCount !==
          0
      )
    )
  ) {
    throw new Error(
      "Gate 13 preflight counts are invalid."
    );
  }

  if (!input.sampleFrozen) {
    if (
      !input
        .approvalBatchPresent
    ) {
      return {
        nextTransition:
          "PERSIST_ATOMIC_APPROVAL_BATCH",
        canFreezeSample:
          false,
        allBaselinesRecorded:
          false,
        allOutcomesRecorded:
          false,
        blockers: [
          "No durable atomic approval batch is present for the proposed acceptance sample. Candidate metadata is not authorization."
        ]
      };
    }

    return {
      nextTransition:
        "FREEZE_ACCEPTANCE_SAMPLE",
      canFreezeSample:
        true,
      allBaselinesRecorded:
        false,
      allOutcomesRecorded:
        false,
      blockers: []
    };
  }

  if (
    input.baselineCount <
      input.targetCount
  ) {
    return {
      nextTransition:
        "RECORD_MEASURED_HUMAN_BASELINES",
      canFreezeSample:
        false,
      allBaselinesRecorded:
        false,
      allOutcomesRecorded:
        false,
      blockers: [
        "Measured-human baselines are incomplete: " +
          String(
            input.baselineCount
          ) +
          "/" +
          String(
            input.targetCount
          ) +
          "."
      ]
    };
  }

  if (
    input.outcomeCount <
      input.targetCount
  ) {
    return {
      nextTransition:
        "RUN_REVIEW_REMAINING_TARGETS",
      canFreezeSample:
        false,
      allBaselinesRecorded:
        true,
      allOutcomesRecorded:
        false,
      blockers: [
        "Reviewed outcomes are incomplete: " +
          String(
            input.outcomeCount
          ) +
          "/" +
          String(
            input.targetCount
          ) +
          "."
      ]
    };
  }

  return {
    nextTransition:
      "EVALUATE_COMPLETE_COHORT",
    canFreezeSample:
      false,
    allBaselinesRecorded:
      true,
    allOutcomesRecorded:
      true,
    blockers: []
  };
}
