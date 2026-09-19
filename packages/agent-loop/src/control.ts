import type {
  AgentActionEffect,
  AgentActionResult,
  AgentUsageMeter,
  AgentUsageSnapshot
} from "@astra/agent-runtime";

import type {
  AgentLoopActionDecision,
  AgentLoopActionSummary,
  AgentLoopExecutionLimits,
  AgentLoopLimitReason,
  AgentLoopTrajectoryEntry
} from "./types.js";

const DEFAULT_MAX_ACTIONS = 20;
const DEFAULT_REPEATED_ACTION_LIMIT = 3;

export interface NormalizedAgentLoopLimits {
  maxActions: number;
  repeatedActionLimit: number;
  maxModelTokens?: number;
  maxModelCostUsd?: number;
}

export interface AgentLoopLimitFailure {
  reason: AgentLoopLimitReason;
  message: string;
}

function validatePositiveInteger(
  value: number,
  name: string
): void {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RangeError(
      name + " must be a positive integer."
    );
  }
}

function validatePositiveNumber(
  value: number,
  name: string
): void {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new RangeError(
      name + " must be a positive finite number."
    );
  }
}

export function normalizeAgentLoopLimits(
  input: AgentLoopExecutionLimits | undefined
): NormalizedAgentLoopLimits {
  const maxActions =
    input?.maxActions ??
    DEFAULT_MAX_ACTIONS;
  const repeatedActionLimit =
    input?.repeatedActionLimit ??
    DEFAULT_REPEATED_ACTION_LIMIT;

  validatePositiveInteger(
    maxActions,
    "Agent-loop maxActions"
  );
  validatePositiveInteger(
    repeatedActionLimit,
    "Agent-loop repeatedActionLimit"
  );

  if (
    input?.maxModelTokens !== undefined
  ) {
    validatePositiveInteger(
      input.maxModelTokens,
      "Agent-loop maxModelTokens"
    );
  }

  if (
    input?.maxModelCostUsd !== undefined
  ) {
    validatePositiveNumber(
      input.maxModelCostUsd,
      "Agent-loop maxModelCostUsd"
    );
  }

  return {
    maxActions,
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

function abortReason(
  signal: AbortSignal
): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
}

export function throwIfAborted(
  signal: AbortSignal | undefined
): void {
  if (signal?.aborted === true) {
    throw abortReason(signal);
  }
}

export async function abortable<T>(
  operation: () => Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (signal === undefined) {
    return operation();
  }

  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortReason(signal));
    };

    signal.addEventListener(
      "abort",
      onAbort,
      {
        once: true
      }
    );

    void operation().then(
      (value) => {
        signal.removeEventListener(
          "abort",
          onAbort
        );
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener(
          "abort",
          onAbort
        );
        reject(error);
      }
    );
  });
}

function normalizeUsage(
  usage: AgentUsageSnapshot
): AgentUsageSnapshot {
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

  return {
    modelTokens: usage.modelTokens,
    modelCostUsd: usage.modelCostUsd
  };
}

export async function usageLimitFailure(
  usageMeter: AgentUsageMeter | undefined,
  limits: NormalizedAgentLoopLimits
): Promise<AgentLoopLimitFailure | undefined> {
  if (usageMeter === undefined) {
    if (
      limits.maxModelTokens !== undefined ||
      limits.maxModelCostUsd !== undefined
    ) {
      throw new Error(
        "Agent-loop model budgets require an AgentUsageMeter."
      );
    }

    return undefined;
  }

  const usage = normalizeUsage(
    await usageMeter.snapshot()
  );

  if (
    limits.maxModelTokens !== undefined &&
    usage.modelTokens >
      limits.maxModelTokens
  ) {
    return {
      reason:
        "MODEL_TOKEN_BUDGET_EXCEEDED",
      message:
        "Model token budget exceeded: " +
        String(usage.modelTokens) +
        " > " +
        String(limits.maxModelTokens) +
        "."
    };
  }

  if (
    limits.maxModelCostUsd !== undefined &&
    usage.modelCostUsd >
      limits.maxModelCostUsd
  ) {
    return {
      reason:
        "MODEL_COST_BUDGET_EXCEEDED",
      message:
        "Model cost budget exceeded: " +
        String(usage.modelCostUsd) +
        " > " +
        String(limits.maxModelCostUsd) +
        "."
    };
  }

  return undefined;
}

export function normalizeActionEffect(
  result: AgentActionResult
): AgentActionEffect {
  if (result.effect !== undefined) {
    return result.effect;
  }

  return result.success
    ? "committed"
    : "unknown";
}

export function actionSignature(
  decision: AgentLoopActionDecision,
  action: AgentLoopActionSummary
): string {
  return JSON.stringify({
    selector: action.selector,
    description: action.description,
    method: action.method ?? null,
    effectRisk: decision.effectRisk
  });
}

export function consecutiveActionCount(
  trajectory: readonly AgentLoopTrajectoryEntry[],
  signature: string
): number {
  let count = 0;

  for (
    let index = trajectory.length - 1;
    index >= 0;
    index -= 1
  ) {
    const entry = trajectory[index];

    if (
      entry?.decision.type !== "ACTION" ||
      entry.actionOutcome === undefined
    ) {
      break;
    }

    const previousSignature =
      actionSignature(
        entry.decision,
        entry.actionOutcome.action
      );

    if (previousSignature !== signature) {
      break;
    }

    count += 1;
  }

  return count;
}
