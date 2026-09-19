import type {
  ConsultativePolicyInput,
  NextActionKind,
  QualificationDimensionKey,
  SalesDecision
} from "@astra/sales-domain";

export interface SalesBenchExpectation {
  allowedActions: readonly NextActionKind[];
  questionRequired: boolean;
  questionTarget: QualificationDimensionKey | null;
  evidenceExpected: boolean;
  forbiddenText: readonly string[];
}

export interface SalesBenchScenario {
  id: string;
  version: number;
  category: string;
  description: string;
  input: ConsultativePolicyInput;
  expected: SalesBenchExpectation;
}

export interface SalesBenchCandidate {
  id: string;
  kind: "deterministic" | "model";
  policyVersion: string;
  modelId: string | null;
  decide(input: ConsultativePolicyInput): Promise<SalesDecision> | SalesDecision;
}

export interface SalesBenchScores {
  factuality: number;
  evidenceUse: number;
  relevance: number;
  questionQuality: number;
  informationGain: number;
  qualificationQuality: number;
  trust: number;
  pressure: number;
  nextStepQuality: number;
}

export interface SalesBenchScenarioResult {
  scenarioId: string;
  passed: boolean;
  hardFailures: string[];
  scores: SalesBenchScores;
  meanScore: number;
  decision: SalesDecision | null;
}

export interface SalesBenchReport {
  benchmarkId: "astra-salesbench-v1";
  benchmarkVersion: 1;
  candidate: {
    id: string;
    kind: SalesBenchCandidate["kind"];
    policyVersion: string;
    modelId: string | null;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    meanScore: number;
  };
  results: SalesBenchScenarioResult[];
}
