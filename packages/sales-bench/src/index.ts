export {
  evaluateSalesDecision,
  assertNoHardViolations,
  decisionText
} from "./evaluator.js";

export {
  SALESBENCH_SCENARIOS,
  salesBenchScenarioIds
} from "./scenarios.js";

export {
  decisionForScenario,
  runBaselineSalesBench,
  runPinnedModelSalesBench,
  scenarioFingerprint,
  serializeSalesBenchReport
} from "./runner.js";

export {
  HardRuleSchema,
  PinnedModelDescriptorSchema,
  SALESBENCH_VERSION,
  SalesBenchCategorySchema,
  SalesBenchExpectedSchema,
  SalesBenchResultSchema,
  SalesBenchScenarioSchema,
  SalesBenchScoreVectorSchema
} from "./types.js";

export type {
  SalesBenchAggregate,
  SalesBenchReport,
  SalesReasoner
} from "./runner.js";

export type {
  PinnedModelDescriptor,
  SalesBenchResult,
  SalesBenchScenario,
  SalesBenchScoreVector
} from "./types.js";
