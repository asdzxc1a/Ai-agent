import type { RunStatus } from "./run-status.js";

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
  properties: Record<string, OutputPropertySchema>;
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

export type RunFailureCode =
  | "NO_ACTION_FOUND"
  | "ACTION_FAILED"
  | "EXECUTION_FAILED"
  | "CLEANUP_FAILED";

export interface RunFailure {
  code: RunFailureCode;
  message: string;
}

export interface RunSnapshot {
  id: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: RunFailure;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_OUTPUT_SCHEMA"
  | "RUN_NOT_FOUND"
  | "ARTIFACT_NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "REQUEST_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
