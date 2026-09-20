import {
  evaluateResearchReport
} from "./evaluator.js";
import {
  RESEARCH_BENCH_V1
} from "./scenarios.js";

import type {
  ResearchBenchCandidate,
  ResearchBenchRunReport,
  ResearchBenchScenario,
  ResearchBenchScenarioResult,
  ResearchBenchTaskInput
} from "./types.js";

function round(
  value: number
): number {
  return (
    Math.round(
      value * 10_000
    ) / 10_000
  );
}

function taskInput(
  scenario: ResearchBenchScenario
): ResearchBenchTaskInput {
  return {
    id: scenario.id,
    tier: scenario.tier,
    category:
      scenario.category,
    companyName:
      scenario.companyName,
    goal: scenario.goal,
    requiredFields: [
      ...scenario.requiredFields
    ],
    startPage:
      scenario.startPage
  };
}

function failureResult(
  scenario:
    ResearchBenchScenario,
  error: unknown
): ResearchBenchScenarioResult {
  return {
    scenarioId: scenario.id,
    tier: scenario.tier,
    category:
      scenario.category,
    passed: false,
    falseCompleted: false,
    unsupportedClaimCount: 0,
    hardFailures: [
      "candidate_error:" +
        (
          error instanceof Error
            ? error.message
            : String(error)
        )
    ],
    report: null
  };
}

export async function runResearchBench(
  candidate: ResearchBenchCandidate,
  scenarios:
    readonly ResearchBenchScenario[] =
      RESEARCH_BENCH_V1
): Promise<ResearchBenchRunReport> {
  const results:
    ResearchBenchScenarioResult[] =
      [];

  for (const scenario of scenarios) {
    try {
      const report =
        await candidate.run(
          taskInput(scenario)
        );
      results.push(
        evaluateResearchReport(
          scenario,
          report
        )
      );
    } catch (error) {
      results.push(
        failureResult(
          scenario,
          error
        )
      );
    }
  }

  const passed =
    results.filter(
      (result) =>
        result.passed
    ).length;
  const core =
    results.filter(
      (result) =>
        result.tier ===
        "core"
    );
  const hard =
    results.filter(
      (result) =>
        result.tier ===
        "hard"
    );
  const corePassed =
    core.filter(
      (result) =>
        result.passed
    ).length;
  const hardPassed =
    hard.filter(
      (result) =>
        result.passed
    ).length;

  return {
    benchmarkId:
      "astra-researchbench-v1",
    benchmarkVersion: 1,
    candidate: {
      id: candidate.id,
      kind: candidate.kind,
      policyVersion:
        candidate.policyVersion,
      modelId:
        candidate.modelId
    },
    summary: {
      total: results.length,
      passed,
      failed:
        results.length -
        passed,
      passRate:
        results.length === 0
          ? 0
          : round(
              passed /
                results.length
            ),
      coreTotal: core.length,
      corePassed,
      corePassRate:
        core.length === 0
          ? 0
          : round(
              corePassed /
                core.length
            ),
      hardTotal: hard.length,
      hardPassed,
      hardPassRate:
        hard.length === 0
          ? 0
          : round(
              hardPassed /
                hard.length
            ),
      falseCompleted:
        results.filter(
          (result) =>
            result
              .falseCompleted
        ).length,
      unsupportedClaims:
        results.reduce(
          (sum, result) =>
            sum +
            result
              .unsupportedClaimCount,
          0
        )
    },
    results
  };
}
