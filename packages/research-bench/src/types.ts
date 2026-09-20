export const RESEARCH_BENCH_CATEGORIES = [
  "about_company",
  "product_service",
  "team_leadership",
  "careers_hiring",
  "press_news",
  "multi_page",
  "tables_cards_modals",
  "dynamic_content",
  "conflicting_information",
  "missing_information",
  "distractors",
  "stale_dates",
  "prompt_injection",
  "source_attribution",
  "unknown_uncertain"
] as const;

export type ResearchBenchCategory =
  typeof RESEARCH_BENCH_CATEGORIES[number];

export type ResearchBenchTier =
  | "core"
  | "hard";

export type ResearchBenchLayout =
  | "paragraph"
  | "table"
  | "cards"
  | "modal"
  | "dynamic";

export interface ResearchBenchPageFact {
  field: string;
  value: string;
  publishedAt?: string | undefined;
}

export interface ResearchBenchPage {
  id: string;
  title: string;
  layout: ResearchBenchLayout;
  facts: readonly ResearchBenchPageFact[];
  unknownFields?: readonly string[];
  nextPage?: string;
  distractorLinks?: readonly string[];
  injectionText?: string;
}

export interface ResearchBenchExpectedFact {
  field: string;
  value: string;
  sourcePage: string;
}

export interface ResearchBenchExpectation {
  facts: readonly ResearchBenchExpectedFact[];
  unknownFields: readonly string[];
}

export interface ResearchBenchScenario {
  id: string;
  version: 1;
  tier: ResearchBenchTier;
  category: ResearchBenchCategory;
  description: string;
  companyName: string;
  goal: string;
  requiredFields: readonly string[];
  startPage: string;
  pages: readonly ResearchBenchPage[];
  expected: ResearchBenchExpectation;
}

export interface ResearchBenchEvidence {
  id: string;
  sourceUrl: string;
  statement: string;
  field: string;
  value: string;
  publishedAt?: string | undefined;
}

export interface ResearchBenchFinding {
  field: string;
  value: string;
  evidenceIds: readonly string[];
}

export interface ResearchBenchUnknown {
  field: string;
  reason: string;
}

export interface ResearchBenchReport {
  scenarioId: string;
  status: "COMPLETED" | "BLOCKED" | "FAILED";
  companyName: string;
  findings: readonly ResearchBenchFinding[];
  unknowns: readonly ResearchBenchUnknown[];
  evidence: readonly ResearchBenchEvidence[];
}

export interface ResearchBenchTaskInput {
  id: string;
  tier: ResearchBenchTier;
  category: ResearchBenchCategory;
  companyName: string;
  goal: string;
  requiredFields: readonly string[];
  startPage: string;
}

export interface ResearchBenchCandidate {
  id: string;
  kind: "deterministic" | "model";
  policyVersion: string;
  modelId: string | null;
  run(
    task: ResearchBenchTaskInput
  ): Promise<unknown> | unknown;
}

export interface ResearchBenchScenarioResult {
  scenarioId: string;
  tier: ResearchBenchTier;
  category: ResearchBenchCategory;
  passed: boolean;
  falseCompleted: boolean;
  unsupportedClaimCount: number;
  hardFailures: string[];
  report: ResearchBenchReport | null;
}

export interface ResearchBenchReportSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  coreTotal: number;
  corePassed: number;
  corePassRate: number;
  hardTotal: number;
  hardPassed: number;
  hardPassRate: number;
  falseCompleted: number;
  unsupportedClaims: number;
}

export interface ResearchBenchRunReport {
  benchmarkId: "astra-researchbench-v1";
  benchmarkVersion: 1;
  candidate: {
    id: string;
    kind: ResearchBenchCandidate["kind"];
    policyVersion: string;
    modelId: string | null;
  };
  summary: ResearchBenchReportSummary;
  results: ResearchBenchScenarioResult[];
}
