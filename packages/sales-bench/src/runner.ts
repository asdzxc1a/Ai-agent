import { createHash } from "node:crypto";

import {
  baselineConsultativePolicy,
  type SalesDecision
} from "@astra/sales-domain";

import {
  evaluateSalesDecision
} from "./evaluator.js";
import {
  SALESBENCH_SCENARIOS
} from "./scenarios.js";
import {
  PinnedModelDescriptorSchema,
  SALESBENCH_VERSION,
  type PinnedModelDescriptor,
  type SalesBenchResult,
  type SalesBenchScenario,
  type SalesBenchScoreVector
} from "./types.js";

export interface SalesReasoner {
  decide(
    input:
      SalesBenchScenario["input"]
  ): Promise<unknown>;
}

export interface SalesBenchAggregate {
  total: number;
  hardGatePassed: number;
  hardGateFailed: number;
  policyMatched: number;
  policyMatchRate: number;
  meanOverallScore: number;
  meanScore:
    SalesBenchScoreVector;
}

export interface SalesBenchReport {
  schemaVersion: "salesbench.report.v1";
  benchmarkVersion:
    typeof SALESBENCH_VERSION;
  scenarioFingerprint: string;
  lane:
    | "deterministic_policy"
    | "pinned_model";
  policyVersion: string;
  model?: PinnedModelDescriptor;
  aggregate: SalesBenchAggregate;
  results: SalesBenchResult[];
}

function mean(
  values: readonly number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

export function scenarioFingerprint(
  scenarios:
    readonly SalesBenchScenario[] =
      SALESBENCH_SCENARIOS
): string {
  const payload = scenarios.map(
    (scenario) => ({
      id: scenario.id,
      version: scenario.version,
      category: scenario.category,
      expected: scenario.expected,
      hardRules:
        scenario.hardRules
    })
  );

  return createHash("sha256")
    .update(
      JSON.stringify(payload)
    )
    .digest("hex");
}

function aggregate(
  results:
    readonly SalesBenchResult[]
): SalesBenchAggregate {
  const scoreKeys = [
    "factuality",
    "evidenceUse",
    "relevance",
    "questionQuality",
    "informationGain",
    "qualificationQuality",
    "trust",
    "pressureSafety",
    "nextStepQuality"
  ] as const;

  const meanScore =
    Object.fromEntries(
      scoreKeys.map(
        (key) => [
          key,
          mean(
            results.map(
              (result) =>
                result.score[key]
            )
          )
        ]
      )
    ) as SalesBenchScoreVector;

  const policyMatched =
    results.filter(
      (result) =>
        result.policyMatched
    ).length;
  const hardGatePassed =
    results.filter(
      (result) =>
        result.hardGatePassed
    ).length;

  return {
    total: results.length,
    hardGatePassed,
    hardGateFailed:
      results.length -
      hardGatePassed,
    policyMatched,
    policyMatchRate:
      results.length === 0
        ? 0
        : policyMatched /
          results.length,
    meanOverallScore: mean(
      results.map(
        (result) =>
          result.overallScore
      )
    ),
    meanScore
  };
}

export function runBaselineSalesBench(
  scenarios:
    readonly SalesBenchScenario[] =
      SALESBENCH_SCENARIOS
): SalesBenchReport {
  const results = scenarios.map(
    (scenario) => {
      const decision =
        baselineConsultativePolicy(
          scenario.input
        );

      return evaluateSalesDecision(
        scenario,
        decision
      );
    }
  );

  return {
    schemaVersion:
      "salesbench.report.v1",
    benchmarkVersion:
      SALESBENCH_VERSION,
    scenarioFingerprint:
      scenarioFingerprint(scenarios),
    lane: "deterministic_policy",
    policyVersion:
      "baseline-consultative-v1",
    aggregate: aggregate(results),
    results
  };
}

function validatePinnedDescriptor(
  raw:
    PinnedModelDescriptor
): PinnedModelDescriptor {
  const descriptor =
    PinnedModelDescriptorSchema.parse(
      raw
    );
  const movingAliases =
    /^(latest|default|auto|stable)$/i;

  if (
    movingAliases.test(
      descriptor.revision
    ) ||
    movingAliases.test(
      descriptor.model
    )
  ) {
    throw new Error(
      "Pinned model lane requires an exact model and revision; moving aliases are forbidden."
    );
  }

  return descriptor;
}

export async function runPinnedModelSalesBench(
  reasoner: SalesReasoner,
  descriptor:
    PinnedModelDescriptor,
  scenarios:
    readonly SalesBenchScenario[] =
      SALESBENCH_SCENARIOS
): Promise<SalesBenchReport> {
  const pinned =
    validatePinnedDescriptor(
      descriptor
    );
  const results:
    SalesBenchResult[] = [];

  for (const scenario of scenarios) {
    let rawDecision: unknown;

    try {
      rawDecision =
        await reasoner.decide(
          scenario.input
        );
    } catch {
      rawDecision = undefined;
    }

    results.push(
      evaluateSalesDecision(
        scenario,
        rawDecision
      )
    );
  }

  return {
    schemaVersion:
      "salesbench.report.v1",
    benchmarkVersion:
      SALESBENCH_VERSION,
    scenarioFingerprint:
      scenarioFingerprint(scenarios),
    lane: "pinned_model",
    policyVersion:
      pinned.policyVersion,
    model: pinned,
    aggregate: aggregate(results),
    results
  };
}

export function serializeSalesBenchReport(
  report: SalesBenchReport
): string {
  return (
    JSON.stringify(
      report,
      null,
      2
    ) + "\n"
  );
}

export function decisionForScenario(
  scenario: SalesBenchScenario
): SalesDecision {
  return baselineConsultativePolicy(
    scenario.input
  );
}
