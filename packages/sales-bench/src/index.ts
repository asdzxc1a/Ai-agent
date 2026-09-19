export { BASELINE_0_CANDIDATE, createPinnedModelCandidate } from "./baseline.js";
export { evaluateSalesDecision } from "./evaluator.js";
export { averageComponentScores, runSalesBench } from "./runner.js";
export { SALES_BENCH_V1 } from "./scenarios.js";

export type {
  SalesBenchCandidate,
  SalesBenchExpectation,
  SalesBenchReport,
  SalesBenchScenario,
  SalesBenchScenarioResult,
  SalesBenchScores
} from "./types.js";
