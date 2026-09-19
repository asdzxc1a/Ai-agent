import type {
  AgentAction,
  AgentActionResult,
  AgentSession
} from "@astra/agent-runtime";

import type {
  AgentLoopActionSummary,
  AgentLoopDecision,
  AgentLoopExecutorOptions,
  AgentLoopOptions,
  AgentLoopOutcome,
  AgentLoopTrajectoryEntry,
  ExecuteAgentLoopInput
} from "./types.js";

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
          "onFailure"
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

      return {
        type: "ACTION",
        actionIndex:
          input.actionIndex as number,
        rationale: input.rationale,
        onFailure: input.onFailure
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
    actions: [action]
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
    message,
    durationMs:
      Date.now() - startedAt
  });

  return {
    type: "FAIL",
    message,
    iterations: iteration,
    trajectory:
      structuredClone(trajectory)
  };
}

export async function executeAgentLoop(
  session: AgentSession,
  options: AgentLoopOptions
): Promise<AgentLoopOutcome> {
  const iterationCeiling =
    options.iterationCeiling ??
    DEFAULT_ITERATION_CEILING;
  validateCeiling(iterationCeiling);

  const trajectory:
    AgentLoopTrajectoryEntry[] = [];

  for (
    let iteration = 1;
    iteration <= iterationCeiling;
    iteration += 1
  ) {
    let startedAt = Date.now();
    const observed =
      await session.observe(
        options.goal
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

    startedAt = Date.now();

    let decision: AgentLoopDecision;
    try {
      const rawDecision =
        await options.policy.decide({
          goal: options.goal,
          iteration,
          observedActions:
            structuredClone(summaries),
          trajectory:
            structuredClone(trajectory)
        });

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

      return {
        type: "FAIL",
        message: decision.message,
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
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

      return {
        type: "FAIL",
        message,
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }

    startedAt = Date.now();

    let actionResult:
      AgentActionResult;

    try {
      actionResult =
        await session.act(action);
    } catch (error) {
      actionResult =
        actionFailure(
          action,
          error
        );
    }

    const outcome = {
      action:
        summarizeAgentAction(action),
      success:
        actionResult.success,
      recoverable:
        decision.onFailure === "CONTINUE"
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
      !actionResult.success &&
      decision.onFailure === "FAIL"
    ) {
      return {
        type: "FAIL",
        message:
          actionResult.message,
        iterations: iteration,
        trajectory:
          structuredClone(trajectory)
      };
    }
  }

  return {
    type: "FAIL",
    message:
      "Agent loop reached its internal iteration ceiling without an explicit COMPLETE decision.",
    iterations: iterationCeiling,
    trajectory:
      structuredClone(trajectory)
  };
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
