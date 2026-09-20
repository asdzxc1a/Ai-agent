import type {
  AgentUsageMeter
} from "@astra/agent-runtime";
import type {
  AgentLoopBlockedReason,
  AgentLoopFailureReason,
  AgentLoopExecutionLimits
} from "@astra/agent-loop";
import type {
  CreateRunRequest,
  RunFailureCode
} from "@astra/contracts";

export interface RunExecutionBudget {
  maxActions?: number;
  maxDurationMs?: number;
  maxModelTokens?: number;
  maxModelCostUsd?: number;
  repeatedActionLimit?: number;
}

export interface NormalizedRunExecutionBudget {
  maxActions: number;
  maxDurationMs: number;
  repeatedActionLimit: number;
  maxModelTokens?: number;
  maxModelCostUsd?: number;
}

export interface CompletionVerificationInput {
  request: CreateRunRequest;
  result: unknown;
  signal: AbortSignal;
}

export interface CompletionVerificationResult {
  verified: boolean;
  message: string;
}

export interface RunCompletionVerifier {
  verify(
    input: CompletionVerificationInput
  ):
    | CompletionVerificationResult
    | Promise<CompletionVerificationResult>;
}

export type RunUsageMeterFactory = (
  runId: string
) => AgentUsageMeter;

export interface RunUsageLimitFailure {
  code:
    | "MODEL_TOKEN_BUDGET_EXCEEDED"
    | "MODEL_COST_BUDGET_EXCEEDED";
  message: string;
}

const DEFAULT_MAX_ACTIONS = 20;
const DEFAULT_MAX_DURATION_MS =
  120_000;
const DEFAULT_REPEATED_ACTION_LIMIT = 3;

function positiveInteger(
  value: number,
  name: string
): number {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RangeError(
      name + " must be a positive integer."
    );
  }

  return value;
}

function positiveNumber(
  value: number,
  name: string
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new RangeError(
      name + " must be a positive finite number."
    );
  }

  return value;
}

export function normalizeRunExecutionBudget(
  input: RunExecutionBudget | undefined
): NormalizedRunExecutionBudget {
  const maxActions =
    positiveInteger(
      input?.maxActions ??
        DEFAULT_MAX_ACTIONS,
      "Run maxActions"
    );
  const maxDurationMs =
    positiveInteger(
      input?.maxDurationMs ??
        DEFAULT_MAX_DURATION_MS,
      "Run maxDurationMs"
    );
  const repeatedActionLimit =
    positiveInteger(
      input?.repeatedActionLimit ??
        DEFAULT_REPEATED_ACTION_LIMIT,
      "Run repeatedActionLimit"
    );

  if (
    input?.maxModelTokens !== undefined
  ) {
    positiveInteger(
      input.maxModelTokens,
      "Run maxModelTokens"
    );
  }

  if (
    input?.maxModelCostUsd !== undefined
  ) {
    positiveNumber(
      input.maxModelCostUsd,
      "Run maxModelCostUsd"
    );
  }

  return {
    maxActions,
    maxDurationMs,
    repeatedActionLimit,
    ...(input?.maxModelTokens === undefined
      ? {}
      : {
          maxModelTokens:
            input.maxModelTokens
        }),
    ...(input?.maxModelCostUsd === undefined
      ? {}
      : {
          maxModelCostUsd:
            input.maxModelCostUsd
        })
  };
}

export function toAgentLoopLimits(
  budget: NormalizedRunExecutionBudget
): AgentLoopExecutionLimits {
  return {
    maxActions: budget.maxActions,
    repeatedActionLimit:
      budget.repeatedActionLimit,
    ...(budget.maxModelTokens === undefined
      ? {}
      : {
          maxModelTokens:
            budget.maxModelTokens
        }),
    ...(budget.maxModelCostUsd === undefined
      ? {}
      : {
          maxModelCostUsd:
            budget.maxModelCostUsd
        })
  };
}

function record(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function constOutputCompletionVerifier(
  request: CreateRunRequest
): RunCompletionVerifier | undefined {
  const schema = request.outputSchema;

  if (schema === undefined) {
    return undefined;
  }

  const required =
    schema.required ?? [];

  if (required.length === 0) {
    return undefined;
  }

  const expected = new Map<
    string,
    string | number | boolean
  >();

  for (const name of required) {
    const property =
      schema.properties[name];

    if (
      property === undefined ||
      property.const === undefined
    ) {
      return undefined;
    }

    expected.set(
      name,
      property.const
    );
  }

  return {
    verify({ result }) {
      if (!record(result)) {
        return {
          verified: false,
          message:
            "Completion result is not an object."
        };
      }

      for (const [name, value] of expected) {
        if (result[name] !== value) {
          return {
            verified: false,
            message:
              "Completion result did not match expected property " +
              name +
              "."
          };
        }
      }

      return {
        verified: true,
        message:
          "Completion result matched all required constant expectations."
      };
    }
  };
}

export async function usageLimitFailure(
  meter: AgentUsageMeter | undefined,
  budget: NormalizedRunExecutionBudget
): Promise<RunUsageLimitFailure | undefined> {
  if (meter === undefined) {
    return undefined;
  }

  const usage = await meter.snapshot();

  if (
    !Number.isFinite(usage.modelTokens) ||
    usage.modelTokens < 0 ||
    !Number.isFinite(usage.modelCostUsd) ||
    usage.modelCostUsd < 0
  ) {
    throw new RangeError(
      "Agent usage snapshots require non-negative finite modelTokens and modelCostUsd."
    );
  }

  if (
    budget.maxModelTokens !== undefined &&
    usage.modelTokens >
      budget.maxModelTokens
  ) {
    return {
      code:
        "MODEL_TOKEN_BUDGET_EXCEEDED",
      message:
        "Model token budget exceeded: " +
        String(usage.modelTokens) +
        " > " +
        String(budget.maxModelTokens) +
        "."
    };
  }

  if (
    budget.maxModelCostUsd !== undefined &&
    usage.modelCostUsd >
      budget.maxModelCostUsd
  ) {
    return {
      code:
        "MODEL_COST_BUDGET_EXCEEDED",
      message:
        "Model cost budget exceeded: " +
        String(usage.modelCostUsd) +
        " > " +
        String(budget.maxModelCostUsd) +
        "."
    };
  }

  return undefined;
}

export function loopFailureCode(
  reason: AgentLoopFailureReason
): RunFailureCode {
  switch (reason) {
    case "STEP_LIMIT_EXCEEDED":
    case "MODEL_TOKEN_BUDGET_EXCEEDED":
    case "MODEL_COST_BUDGET_EXCEEDED":
    case "LOOP_DETECTED":
      return reason;
    default:
      return "AGENT_LOOP_FAILED";
  }
}

export function loopBlockedCode(
  reason: AgentLoopBlockedReason
): RunFailureCode {
  switch (reason) {
    case "IRREVERSIBLE_EFFECT_UNKNOWN":
    case "IRREVERSIBLE_EFFECT_COMMITTED":
      return reason;
    case "POLICY_BLOCKED":
      return "AGENT_BLOCKED";
  }
}
