import type {
  GoalState,
  RunStatus
} from "./run-status.js";

export type OutputPropertySchema =
  | {
      type: "string";
      const?: string;
    }
  | {
      type: "number";
      const?: number;
    }
  | {
      type: "boolean";
      const?: boolean;
    };

export interface ObjectOutputSchema {
  type: "object";
  properties:
    Record<string, OutputPropertySchema>;
  required?: string[];
  additionalProperties?: false;
}

export interface CreateRunRequest {
  url: string;
  goal: string;
  outputSchema?: ObjectOutputSchema;
}

export interface CreateRunAccepted {
  runId: string;
  status: RunStatus;
}

export type RunTerminalReasonCode =
  | "GOAL_VERIFIED"
  | "COMPLETION_REJECTED"
  | "NO_ACTION_FOUND"
  | "ACTION_FAILED"
  | "AGENT_BLOCKED"
  | "AGENT_LOOP_FAILED"
  | "POLICY_FAILED"
  | "POLICY_BLOCKED"
  | "INVALID_AGENT_DECISION"
  | "INVALID_ACTION_SELECTION"
  | "ACTION_EFFECT_UNKNOWN"
  | "ACTION_EFFECT_COMMITTED"
  | "STEP_LIMIT_EXCEEDED"
  | "MODEL_TOKEN_BUDGET_EXCEEDED"
  | "MODEL_COST_BUDGET_EXCEEDED"
  | "LOOP_DETECTED"
  | "EXECUTION_TIMEOUT"
  | "CANCELLED"
  | "EXECUTION_FAILED"
  | "CLEANUP_FAILED";

export interface RunTerminalReason {
  code: RunTerminalReasonCode;
  message: string;
}

export type RunFailureCode =
  Exclude<
    RunTerminalReasonCode,
    "GOAL_VERIFIED"
  >;

export interface RunFailure {
  code: RunFailureCode;
  message: string;
}

export interface RunSnapshot {
  id: string;
  status: RunStatus;
  goalState: GoalState;
  createdAt: string;
  updatedAt: string;
  terminalReason?:
    RunTerminalReason;
  result?: unknown;
  error?: RunFailure;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_OUTPUT_SCHEMA"
  | "RUN_NOT_FOUND"
  | "ARTIFACT_NOT_FOUND"
  | "CANCELLATION_UNAVAILABLE"
  | "METHOD_NOT_ALLOWED"
  | "REQUEST_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
