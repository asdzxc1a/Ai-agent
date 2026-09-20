import type {
  AgentAction,
  AgentActionResult,
  AgentSession
} from "@astra/agent-runtime";

import type {
  AgentLoopActionSummary,
  AgentLoopDecision,
  AgentLoopExecutorOptions,
  AgentLoopFailureReason,
  AgentLoopLimitReason,
  AgentLoopOptions,
  AgentLoopOutcome,
  AgentLoopTrajectoryEntry,
  ExecuteAgentLoopInput
} from "./types.js";

import {
  abortable,
  actionSignature,
  consecutiveActionCount,
  normalizeActionEffect,
  normalizeAgentLoopLimits,
  throwIfAborted,
  usageLimitFailure
} from "./control.js";

const DEFAULT_ITERATION_CEILING = 20;
const MAX_ITERATION_CEILING = 100;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
function nonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const unexpected = Object.keys(value).find(
    (key) => !allowed.includes(key)
  );

  if (unexpected !== undefined) {
    throw new TypeError(
      `Agent-loop decision contains unsupported field "${unexpected}".`
    );
  }
}

function optionalRationale(
  value: Record<string, unknown>
): { rationale?: string } {
  if (value.rationale === undefined) {
    return {};
  }

  if (!nonEmptyString(value.rationale)) {
    throw new TypeError(
      "Agent-loop decision rationale must be a non-empty string when provided."
    );
  }

  return {
    rationale: value.rationale
  };
}

function parseDecision(
  input: unknown
): AgentLoopDecision {
  if (!isRecord(input)) {
    throw new TypeError(
      "Agent-loop policy must return an object decision."
    );
  }

  switch (input.type) {
    case "ACTION": {
      assertKnownKeys(
        input,
        [
          "type",
          "actionIndex",
          "rationale",
          "onFailure",
          "effectRisk"
        ]
      );

      if (
        !Number.isInteger(input.actionIndex) ||
        (input.actionIndex as number) < 0
      ) {
        throw new TypeError(
          "ACTION decisions require a non-negative integer actionIndex."
        );
      }

      if (!nonEmptyString(input.rationale)) {
        throw new TypeError(
          "ACTION decisions require a non-empty rationale."
        );
      }

      if (
        input.onFailure !== "CONTINUE" &&
        input.onFailure !== "FAIL"
      ) {
        throw new TypeError(
          "ACTION decisions require onFailure CONTINUE or FAIL."
        );
      }

      if (
        input.effectRisk !== "REVERSIBLE" &&
        input.effectRisk !== "IRREVERSIBLE"
      ) {
        throw new TypeError(
          "ACTION decisions require effectRisk REVERSIBLE or IRREVERSIBLE."
        );
      }

      return {
        type: "ACTION",
        actionIndex:
          input.actionIndex as number,
        rationale: input.rationale,
        onFailure: input.onFailure,
        effectRisk: input.effectRisk
      };
    }

    case "COMPLETE": {
      assertKnownKeys(
        input,
        [
          "type",
          "rationale",
          "result"
        ]
      );

      if (!nonEmptyString(input.rationale)) {
        throw new TypeError(
          "COMPLETE decisions require a non-empty rationale."
        );
      }

      return {
        type: "COMPLETE",
        rationale: input.rationale,
        ...(input.result === undefined
          ? {}
          : {
              result: input.result
            })
      };
    }

    case "FAIL": {
      assertKnownKeys(
        input,
        [
          "type",
          "message",
          "rationale"
        ]
      );

      if (!nonEmptyString(input.message)) {
        throw new TypeError(
          "FAIL decisions require a non-empty message."
        );
      }

      return {
        type: "FAIL",
        message: input.message,
        ...optionalRationale(input)
      };
    }

    case "BLOCKED": {
      assertKnownKeys(
        input,
        [
          "type",
          "message",
          "rationale"
        ]
      );

      if (!nonEmptyString(input.message)) {
        throw new TypeError(
          "BLOCKED decisions require a non-empty message."
        );
      }

      return {
        type: "BLOCKED",
        message: input.message,
        ...optionalRationale(input)
      };
    }

    default:
      throw new TypeError(
        "Agent-loop decision type must be ACTION, COMPLETE, FAIL, or BLOCKED."
      );
  }
}

export function summarizeAgentAction(
  action: AgentAction
): AgentLoopActionSummary {
  return {
    selector: action.selector,
    description: action.description,
    ...(action.method === undefined
      ? {}
      : {
          method: action.method
        })
  };
}

function summarizeActions(
  actions: readonly AgentAction[]
): AgentLoopActionSummary[] {
  return actions.map(
    summarizeAgentAction
  );
}
function cloneDecision(
  decision: AgentLoopDecision
): AgentLoopDecision {
  return structuredClone(decision);
}

function actionFailure(
  action: AgentAction,
  error: unknown
): AgentActionResult {
  return {
    success: false,
    message:
      error instanceof Error
        ? error.message
        : "Agent action failed.",
    actionDescription:
      action.description,
    actions: [action],
    effect: "unknown"
  };
}

function validateCeiling(
  value: number
): void {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_ITERATION_CEILING
  ) {
    throw new RangeError(
      "Agent-loop iteration ceiling must be an integer from 1 to 100."
    );
  }
}

function failOutcome(
  reason: AgentLoopFailureReason,
  message: string,
  iteration: number,
  trajectory: AgentLoopTrajectoryEntry[]
): AgentLoopOutcome {
  return {
    type: "FAIL",
    goalState: "FAILED",
    reason,
    message,
    iterations: iteration,
    trajectory:
      structuredClone(trajectory)
  };
}

async function limitOutcome(
  options: AgentLoopOptions,
  iteration: number,
  reason: AgentLoopLimitReason,
  message: string,
  trajectory: AgentLoopTrajectoryEntry[]
): Promise<AgentLoopOutcome> {
  await options.onProgress?.({
    type: "LIMIT_REACHED",
    iteration,
    reason,
    message
  });

  return failOutcome(
    reason,
    message,
    iteration,
    trajectory
  );
}

async function rejectDecision(
  options: AgentLoopOptions,
  iteration: number,
  startedAt: number,
  error: unknown,
  trajectory: AgentLoopTrajectoryEntry[]
): Promise<AgentLoopOutcome> {
  const message =
    error instanceof Error
      ? error.message
      : "Agent-loop policy returned an invalid decision.";

  await options.onProgress?.({
    type: "DECISION_REJECTED",
    iteration,
    message:
      "Agent-loop policy decision was rejected.",
    durationMs:
      Date.now() - startedAt
  });

  return failOutcome(
    "POLICY_REJECTED",
    message,
    iteration,
    trajectory
  );
}

export async function executeAgentLoop(
  session: AgentSession,
  options: AgentLoopOptions
): Promise<AgentLoopOutcome> {
  const iterationCeiling =
    options.iterationCeiling ??
    DEFAULT_ITERATION_CEILING;
  validateCeiling(iterationCeiling);

  const limits =
    normalizeAgentLoopLimits(
      options.limits
    );
  const trajectory:
    AgentLoopTrajectoryEntry[] = [];
  let actionsExecuted = 0;

  for (
    let iteration = 1;
    iteration <= iterationCeiling;
    iteration += 1
  ) {
    throwIfAborted(
      options.signal
    );

    let startedAt = Date.now();
    const observed =
      await abortable(
        () =>
          session.observe(
            options.goal,
            options.signal === undefined
              ? {}
              : {
                  signal: options.signal
                }
          ),
        options.signal
      );

    throwIfAborted(
      options.signal
    );

    const summaries =
      summarizeActions(observed);

    await options.onProgress?.({
      type: "OBSERVED",
      iteration,
      actions:
        structuredClone(summaries),
      durationMs:
        Date.now() - startedAt
    });

    const observeLimit =
      await usageLimitFailure(
        options.usageMeter,
        limits
      );

    if (observeLimit !== undefined) {
      return limitOutcome(
        options,
        iteration,
        observeLimit.reason,
        observeLimit.message,
        trajectory
      );
    }

    startedAt = Date.now();

    let rawDecision: unknown;

    try {
      rawDecision =
        await abortable(
          () =>
            options.policy.decide({
              goal: options.goal,
              iteration,
              observedActions:
                structuredClone(summaries),
              trajectory:
                structuredClone(trajectory)
            }),
          options.signal
        );

      throwIfAborted(
        options.signal
      );
    } catch (error) {
      throwIfAborted(
        options.signal
      );

      return rejectDecision(
        options,
        iteration,
        startedAt,
        error,
        trajectory
      );
    }

    let decision: AgentLoopDecision;

    try {
      decision =
        parseDecision(rawDecision);
    } catch (error) {
      return rejectDecision(
        options,
        iteration,
        startedAt,
        error,
        trajectory
      );
    }

    await options.onProgress?.({
      type: "DECIDED",
      iteration,
      decision:
        cloneDecision(decision),
      durationMs:
        Date.now() - startedAt
    });

    const decisionLimit =
      await usageLimitFailure(
        options.usageMeter,
        limits
      );

    if (decisionLimit !== undefined) {
      return limitOutcome(
        options,
        iteration,
        decisionLimit.reason,
        decisionLimit.message,
        trajectory
      );
    }

    if (
      decision.type === "COMPLETE"
    ) {
      trajectory.push({
        iteration,
        observedActions:
          structuredClone(
            summaries
          ),
        decision:
          cloneDecision(decision)
      });

      return {
        type: "COMPLETE",
        goalState: "COMPLETED",
        result:
          decision.result ?? {
            completed: true,
            iterations: iteration
          },
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }

    if (decision.type === "FAIL") {
      trajectory.push({
        iteration,
        observedActions:
          structuredClone(
            summaries
          ),
        decision:
          cloneDecision(decision)
      });

      return failOutcome(
        "POLICY_FAILED",
        decision.message,
        iteration,
        trajectory
      );
    }

    if (
      decision.type === "BLOCKED"
    ) {
      trajectory.push({
        iteration,
        observedActions:
          structuredClone(
            summaries
          ),
        decision:
          cloneDecision(decision)
      });

      return {
        type: "BLOCKED",
        goalState: "BLOCKED",
        reason: "POLICY_BLOCKED",
        message: decision.message,
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }

    const action =
      observed[
        decision.actionIndex
      ];

    if (action === undefined) {
      const message =
        "Loop policy selected action index " +
        String(
          decision.actionIndex
        ) +
        " but only " +
        String(observed.length) +
        " actions were observed.";

      trajectory.push({
        iteration,
        observedActions:
          structuredClone(
            summaries
          ),
        decision:
          cloneDecision(decision)
      });

      return failOutcome(
        "INVALID_ACTION_SELECTION",
        message,
        iteration,
        trajectory
      );
    }

    if (
      actionsExecuted >=
      limits.maxActions
    ) {
      return limitOutcome(
        options,
        iteration,
        "STEP_LIMIT_EXCEEDED",
        "Agent loop reached the action limit of " +
          String(limits.maxActions) +
          ".",
        trajectory
      );
    }

    const actionSummary =
      summarizeAgentAction(
        action
      );
    const signature =
      actionSignature(
        decision,
        actionSummary
      );

    if (
      consecutiveActionCount(
        trajectory,
        signature
      ) >=
        limits.repeatedActionLimit
    ) {
      return limitOutcome(
        options,
        iteration,
        "LOOP_DETECTED",
        "Agent loop selected the same action more than " +
          String(
            limits.repeatedActionLimit
          ) +
          " consecutive times.",
        trajectory
      );
    }

    startedAt = Date.now();

    let actionResult:
      AgentActionResult;

    try {
      actionResult =
        await abortable(
          () =>
            session.act(
              action,
              options.signal === undefined
                ? {}
                : {
                    signal:
                      options.signal
                  }
            ),
          options.signal
        );

      throwIfAborted(
        options.signal
      );
    } catch (error) {
      throwIfAborted(
        options.signal
      );

      actionResult =
        actionFailure(
          action,
          error
        );
    }

    actionsExecuted += 1;

    const effect =
      normalizeActionEffect(
        actionResult
      );
    const unsafeIrreversibleFailure =
      !actionResult.success &&
      decision.effectRisk ===
        "IRREVERSIBLE" &&
      effect !== "none";
    const outcome = {
      action:
        actionSummary,
      success:
        actionResult.success,
      recoverable:
        !actionResult.success &&
        decision.onFailure ===
          "CONTINUE" &&
        !unsafeIrreversibleFailure,
      effect,
      effectRisk:
        decision.effectRisk
    };

    await options.onProgress?.({
      type: "ACTED",
      iteration,
      outcome:
        structuredClone(outcome),
      durationMs:
        Date.now() - startedAt
    });

    trajectory.push({
      iteration,
      observedActions:
        structuredClone(summaries),
      decision:
        cloneDecision(decision),
      actionOutcome:
        structuredClone(outcome)
    });

    if (
      decision.effectRisk ===
        "IRREVERSIBLE" &&
      effect === "unknown"
    ) {
      return {
        type: "BLOCKED",
        goalState: "BLOCKED",
        reason:
          "IRREVERSIBLE_EFFECT_UNKNOWN",
        message:
          "Irreversible action effect is unknown; automatic retry is blocked.",
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }

    if (
      !actionResult.success &&
      decision.effectRisk ===
        "IRREVERSIBLE" &&
      effect === "committed"
    ) {
      return {
        type: "BLOCKED",
        goalState: "BLOCKED",
        reason:
          "IRREVERSIBLE_EFFECT_COMMITTED",
        message:
          "Irreversible action committed despite reporting failure; automatic retry is blocked.",
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }

    const actionLimit =
      await usageLimitFailure(
        options.usageMeter,
        limits
      );

    if (actionLimit !== undefined) {
      return limitOutcome(
        options,
        iteration,
        actionLimit.reason,
        actionLimit.message,
        trajectory
      );
    }

    if (
      !actionResult.success &&
      decision.onFailure === "FAIL"
    ) {
      return failOutcome(
        "ACTION_FAILED",
        actionResult.message,
        iteration,
        trajectory
      );
    }
  }

  return failOutcome(
    "ITERATION_LIMIT_EXCEEDED",
    "Agent loop reached its internal iteration ceiling without an explicit COMPLETE decision.",
    iterationCeiling,
    trajectory
  );
}

export class AgentLoopExecutor {
  readonly #policy:
    AgentLoopExecutorOptions["policy"];
  readonly #iterationCeiling?: number;

  public constructor({
    policy,
    iterationCeiling
  }: AgentLoopExecutorOptions) {
    this.#policy = policy;
    if (
      iterationCeiling !== undefined
    ) {
      validateCeiling(
        iterationCeiling
      );
      this.#iterationCeiling =
        iterationCeiling;
    }
  }

  public execute(
    input: ExecuteAgentLoopInput
  ): Promise<AgentLoopOutcome> {
    return executeAgentLoop(
      input.session,
      {
        goal: input.goal,
        policy: this.#policy,
        ...(this.#iterationCeiling ===
          undefined
          ? {}
          : {
              iterationCeiling:
                this.#iterationCeiling
            }),
        ...(input.limits ===
          undefined
          ? {}
          : {
              limits:
                input.limits
            }),
        ...(input.usageMeter ===
          undefined
          ? {}
          : {
              usageMeter:
                input.usageMeter
            }),
        ...(input.signal ===
          undefined
          ? {}
          : {
              signal:
                input.signal
            }),
        ...(input.onProgress ===
          undefined
          ? {}
          : {
              onProgress:
                input.onProgress
            })
      }
    );
  }
}
