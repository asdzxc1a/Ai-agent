import type {
  SalesBenchCandidate,
  SalesBenchReport,
  SalesBenchScenario,
  SalesBenchScenarioResult,
  SalesBenchScores
} from "./types.js";
import { evaluateSalesDecision } from "./evaluator.js";
import { SALES_BENCH_V1 } from "./scenarios.js";

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

function zeroScores(): SalesBenchScores {
  return {
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
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function reportMean(results: readonly SalesBenchScenarioResult[]): number {
  if (results.length === 0) return 0;
  return round(
    results.reduce((sum, result) => sum + result.meanScore, 0) /
      results.length
  );
}

export async function runSalesBench(
  candidate: SalesBenchCandidate,
  scenarios: readonly SalesBenchScenario[] = SALES_BENCH_V1
): Promise<SalesBenchReport> {
  const results: SalesBenchScenarioResult[] = [];

  for (const scenario of scenarios) {
    try {
      const decision = await candidate.decide(scenario.input);
      results.push(evaluateSalesDecision(scenario, decision));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        scenarioId: scenario.id,
        passed: false,
        hardFailures: [`candidate_error:${message}`],
        scores: zeroScores(),
        meanScore: 0,
        decision: null
      });
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    benchmarkId: "astra-salesbench-v1",
    benchmarkVersion: 1,
    candidate: {
      id: candidate.id,
      kind: candidate.kind,
      policyVersion: candidate.policyVersion,
      modelId: candidate.modelId
    },
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: total === 0 ? 0 : round(passed / total),
      meanScore: reportMean(results)
    },
    results
  };
}

export function averageComponentScores(
  report: SalesBenchReport
): SalesBenchScores {
  if (report.results.length === 0) return zeroScores();

  const aggregate = zeroScores();
  for (const result of report.results) {
    for (const key of SCORE_KEYS) {
      aggregate[key] += result.scores[key];
    }
  }

  for (const key of SCORE_KEYS) {
    aggregate[key] = round(
      aggregate[key] / report.results.length
    );
  }

  return aggregate;
}
