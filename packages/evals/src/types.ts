export const EVAL_REPORT_SCHEMA_VERSION = 1 as const;
export const EVAL_FIXTURE_VERSION = "gate8-v1";

export type EvalLane =
  | "contract"
  | "capability";

export type EvalActionMethod =
  | "click"
  | "fill"
  | "select"
  | "frame-click"
  | "click-new-page";

export interface EvalActionSpec {
  selector: string;
  description: string;
  method: EvalActionMethod;
  arguments?: string[];
}

export interface EvalExpectedState {
  type: "state";
  value: Record<string, unknown>;
}

export interface EvalTask {
  id: string;
  version: number;
  category: string;
  startUrl: string;
  goal: string;
  expected: EvalExpectedState;
  maxSteps: number;
  timeoutMs: number;
  contractActions: EvalActionSpec[];
}

export type EvalRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface EvalObservation {
  runId: string;
  runStatus: EvalRunStatus;
  finalState?: unknown;
  stepCount: number;
  durationMs: number;
  artifactComplete: boolean;
  failureCode?: string;
  actionFailures: number;
  loopCount: number;
}

export type EvalFailureCategory =
  | "NONE"
  | "RUN_FAILED"
  | "NO_FINAL_STATE"
  | "STATE_MISMATCH"
  | "STEP_LIMIT_EXCEEDED"
  | "HARNESS_ERROR";

export interface EvalTaskResult {
  taskId: string;
  taskVersion: number;
  category: string;
  success: boolean;
  falseCompleted: boolean;
  failureCategory: EvalFailureCategory;
  runId: string;
  runStatus: EvalRunStatus;
  stepCount: number;
  durationMs: number;
  artifactComplete: boolean;
  actionFailures: number;
  loopCount: number;
  failureCode?: string;
  finalState?: unknown;
}

export interface EvalModelMetadata {
  provider: string;
  model: string;
  configuration?: Record<
    string,
    string | number | boolean
  >;
}

export interface EvalBenchmarkMetadata {
  lane: EvalLane;
  fixtureVersion: string;
  gitCommit: string;
  generatedAt: string;
  model: EvalModelMetadata;
}

export interface EvalBenchmarkAggregate {
  total: number;
  passed: number;
  failed: number;
  falseCompleted: number;
  successRate: number;
  medianSteps: number;
  medianDurationMs: number;
}

export interface EvalBenchmarkReport {
  schemaVersion: typeof EVAL_REPORT_SCHEMA_VERSION;
  metadata: EvalBenchmarkMetadata;
  aggregate: EvalBenchmarkAggregate;
  tasks: EvalTaskResult[];
}

export interface EvalLaneRunner {
  readonly lane: EvalLane;
  runTask(task: EvalTask): Promise<EvalObservation>;
}
