import type {
  AgentAction,
  AgentActionResult,
  AgentSession
} from "@astra/agent-runtime";
import {
  isActionEffectState
} from "@astra/contracts";
import type {
  ActionEffectState,
  RunTerminalReason,
  RunTerminalReasonCode
} from "@astra/contracts";

import type {
  AgentLoopActionEffectPolicy,
  AgentLoopActionSummary,
  AgentLoopBudget,
  AgentLoopDecision,
  AgentLoopExecutorOptions,
  AgentLoopOptions,
  AgentLoopOutcome,
  AgentLoopTrajectoryEntry,
  AgentLoopUsageMeter,
  AgentLoopUsageSnapshot,
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
      'Agent-loop decision contains unsupported field "' +
        unexpected +
        '".'
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

function terminalReason(
  code: RunTerminalReasonCode,
  message: string
): RunTerminalReason {
  return {
    code,
    message
  };
}

function fail(
  code: RunTerminalReasonCode,
  message: string,
  iteration: number,
  trajectory:
    AgentLoopTrajectoryEntry[]
): AgentLoopOutcome {
  return {
    type: "FAIL",
    message,
    reason:
      terminalReason(
        code,
        message
      ),
    iterations: iteration,
    trajectory:
      structuredClone(trajectory)
  };
}

function block(
  code: RunTerminalReasonCode,
  message: string,
  iteration: number,
  trajectory:
    AgentLoopTrajectoryEntry[]
): AgentLoopOutcome {
  return {
    type: "BLOCKED",
    message,
    reason:
      terminalReason(
        code,
        message
      ),
    iterations: iteration,
    trajectory:
      structuredClone(trajectory)
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

function validatePositiveInteger(
  value: number | undefined,
  label: string
): void {
  if (value === undefined) {
    return;
  }

  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RangeError(
      label +
        " must be a positive integer."
    );
  }
}

function validateNonNegativeNumber(
  value: number | undefined,
  label: string,
  integer = false
): void {
  if (value === undefined) {
    return;
  }

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (integer &&
      !Number.isInteger(value))
  ) {
    throw new RangeError(
      label +
        " must be a non-negative " +
        (integer
          ? "integer."
          : "finite number.")
    );
  }
}

function validateBudget(
  budget: AgentLoopBudget | undefined,
  usageMeter:
    AgentLoopUsageMeter | undefined
): void {
  if (budget === undefined) {
    return;
  }

  validatePositiveInteger(
    budget.maxSteps,
    "maxSteps"
  );
  validatePositiveInteger(
    budget.maxRepeatedActionSelections,
    "maxRepeatedActionSelections"
  );
  validateNonNegativeNumber(
    budget.maxModelTokens,
    "maxModelTokens",
    true
  );
  validateNonNegativeNumber(
    budget.maxEstimatedCostUsd,
    "maxEstimatedCostUsd"
  );

  if (
    (
      budget.maxModelTokens !==
        undefined ||
      budget.maxEstimatedCostUsd !==
        undefined
    ) &&
    usageMeter === undefined
  ) {
    throw new TypeError(
      "Model token/cost budgets require an AgentLoopUsageMeter."
    );
  }
}

function validateUsage(
  usage: AgentLoopUsageSnapshot
): void {
  validateNonNegativeNumber(
    usage.modelTokens,
    "modelTokens",
    true
  );
  validateNonNegativeNumber(
    usage.estimatedCostUsd,
    "estimatedCostUsd"
  );
}

async function usageViolation(
  options: AgentLoopOptions
): Promise<RunTerminalReason | undefined> {
  if (
    options.budget === undefined ||
    options.usageMeter === undefined
  ) {
    return undefined;
  }

  const usage =
    await options.usageMeter.getUsage();
  validateUsage(usage);

  if (
    options.budget.maxModelTokens !==
      undefined &&
    usage.modelTokens >
      options.budget.maxModelTokens
  ) {
    return terminalReason(
      "MODEL_TOKEN_BUDGET_EXCEEDED",
      "Agent loop exceeded its model-token budget."
    );
  }

  if (
    options.budget
      .maxEstimatedCostUsd !==
      undefined &&
    usage.estimatedCostUsd >
      options.budget
        .maxEstimatedCostUsd
  ) {
    return terminalReason(
      "MODEL_COST_BUDGET_EXCEEDED",
      "Agent loop exceeded its model-cost budget."
    );
  }

  return undefined;
}

function abortError(): Error {
  const error =
    new Error(
      "Agent loop aborted."
    );
  error.name = "AbortError";
  return error;
}

function throwIfAborted(
  signal: AbortSignal | undefined
): void {
  if (signal?.aborted === true) {
    throw abortError();
  }
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (signal === undefined) {
    return promise;
  }

  throwIfAborted(signal);

  return new Promise<T>(
    (resolve, reject) => {
      const onAbort = () => {
        reject(abortError());
      };

      signal.addEventListener(
        "abort",
        onAbort,
        {
          once: true
        }
      );

      promise.then(
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
    }
  );
}

type ActionExecution =
  | {
      kind: "RESULT";
      result:
        AgentActionResult;
      threw: boolean;
    }
  | {
      kind: "ABORTED";
    };

async function executeAction(
  session: AgentSession,
  action: AgentAction,
  signal:
    AbortSignal | undefined
): Promise<ActionExecution> {
  throwIfAborted(signal);

  const actionPromise =
    session.act(action).then(
      (result) => ({
        kind:
          "RESULT" as const,
        result,
        threw: false
      }),
      (error: unknown) => ({
        kind:
          "RESULT" as const,
        result:
          actionFailure(
            action,
            error
          ),
        threw: true
      })
    );

  if (signal === undefined) {
    return actionPromise;
  }

  return new Promise<
    ActionExecution
  >((resolve) => {
    const onAbort = () => {
      resolve({
        kind: "ABORTED"
      });
    };

    signal.addEventListener(
      "abort",
      onAbort,
      { once: true }
    );

    void actionPromise.then(
      (execution) => {
        signal.removeEventListener(
          "abort",
          onAbort
        );
        resolve(execution);
      }
    );
  });
}

function actionSignature(
  action: AgentLoopActionSummary
): string {
  return [
    action.method ?? "",
    action.selector,
    action.description
  ].join("\u0000");
}

function repeatedActionCount(
  trajectory:
    readonly AgentLoopTrajectoryEntry[],
  action: AgentLoopActionSummary
): number {
  const signature =
    actionSignature(action);
  let count = 0;

  for (
    let index =
      trajectory.length - 1;
    index >= 0;
    index -= 1
  ) {
    const previous =
      trajectory[index]
        ?.actionOutcome?.action;

    if (
      previous === undefined ||
      actionSignature(previous) !==
        signature
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

const DEFAULT_EFFECT_POLICY:
  AgentLoopActionEffectPolicy = {
    classify(input) {
      return input.success
        ? "committed"
        : "unknown";
    }
  };

async function classifyEffect(
  options: AgentLoopOptions,
  action: AgentLoopActionSummary,
  success: boolean,
  threw: boolean
): Promise<ActionEffectState> {
  const policy =
    options.effectPolicy ??
    DEFAULT_EFFECT_POLICY;

  const effect =
    await abortable(
      Promise.resolve(
        policy.classify({
          action:
            structuredClone(action),
          success,
          threw
        })
      ),
      options.signal
    );

  if (
    !isActionEffectState(effect)
  ) {
    throw new TypeError(
      "Action-effect policy must return none, committed, or unknown."
    );
  }

  return effect;
}

async function rejectDecision(
  options: AgentLoopOptions,
  iteration: number,
  startedAt: number,
  error: unknown,
  trajectory:
    AgentLoopTrajectoryEntry[]
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

  return fail(
    "INVALID_AGENT_DECISION",
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
  validateCeiling(
    iterationCeiling
  );
  validateBudget(
    options.budget,
    options.usageMeter
  );

  const trajectory:
    AgentLoopTrajectoryEntry[] = [];

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
        session.observe(
          options.goal
        ),
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

    const afterObserveBudget =
      await usageViolation(
        options
      );

    if (
      afterObserveBudget !==
      undefined
    ) {
      return block(
        afterObserveBudget.code,
        afterObserveBudget.message,
        iteration,
        trajectory
      );
    }

    startedAt = Date.now();

    let decision: AgentLoopDecision;
    try {
      const rawDecision =
        await abortable(
          options.policy.decide({
            goal: options.goal,
            iteration,
            observedActions:
              structuredClone(
                summaries
              ),
            trajectory:
              structuredClone(
                trajectory
              )
          }),
          options.signal
        );

      decision =
        parseDecision(rawDecision);
    } catch (error) {
      if (
        options.signal?.aborted ===
        true
      ) {
        throw error;
      }

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

    const afterDecisionBudget =
      await usageViolation(
        options
      );

    if (
      afterDecisionBudget !==
      undefined
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

      return block(
        afterDecisionBudget.code,
        afterDecisionBudget.message,
        iteration,
        trajectory
      );
    }

    if (
      decision.type ===
      "COMPLETE"
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
          structuredClone(
            trajectory
          )
      };
    }

    if (
      decision.type === "FAIL"
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

      return fail(
        "POLICY_FAILED",
        decision.message,
        iteration,
        trajectory
      );
    }

    if (
      decision.type ===
      "BLOCKED"
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

      return block(
        "POLICY_BLOCKED",
        decision.message,
        iteration,
        trajectory
      );
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

      return fail(
        "INVALID_ACTION_SELECTION",
        message,
        iteration,
        trajectory
      );
    }

    const actionSummary =
      summarizeAgentAction(
        action
      );
    const executedSteps =
      trajectory.filter(
        (entry) =>
          entry.actionOutcome !==
          undefined
      ).length;

    if (
      options.budget?.maxSteps !==
        undefined &&
      executedSteps >=
        options.budget.maxSteps
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

      return block(
        "STEP_LIMIT_EXCEEDED",
        "Agent loop reached its maximum action-step budget.",
        iteration,
        trajectory
      );
    }

    if (
      options.budget
        ?.maxRepeatedActionSelections !==
        undefined &&
      repeatedActionCount(
        trajectory,
        actionSummary
      ) >=
        options.budget
          .maxRepeatedActionSelections
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

      return block(
        "LOOP_DETECTED",
        "Agent loop detected a repeated action cycle.",
        iteration,
        trajectory
      );
    }

    startedAt = Date.now();

    const actionExecution =
      await executeAction(
        session,
        action,
        options.signal
      );

    if (
      actionExecution.kind ===
      "ABORTED"
    ) {
      const outcome = {
        action: actionSummary,
        success: false,
        recoverable: false,
        effect:
          "unknown" as const
      };

      await options.onProgress?.({
        type: "ACTED",
        iteration,
        outcome:
          structuredClone(
            outcome
          ),
        durationMs:
          Date.now() - startedAt
      });

      trajectory.push({
        iteration,
        observedActions:
          structuredClone(
            summaries
          ),
        decision:
          cloneDecision(decision),
        actionOutcome:
          structuredClone(
            outcome
          )
      });

      return block(
        "ACTION_EFFECT_UNKNOWN",
        "Cancellation or timeout interrupted an in-flight action; its effect is unknown and automatic retry is blocked.",
        iteration,
        trajectory
      );
    }

    const actionResult =
      actionExecution.result;
    const threw =
      actionExecution.threw;

    let effect:
      ActionEffectState;

    try {
      effect =
        await classifyEffect(
          options,
          actionSummary,
          actionResult.success,
          threw
        );
    } catch {
      effect = "unknown";
    }

    const outcome = {
      action: actionSummary,
      success:
        actionResult.success,
      recoverable:
        !actionResult.success &&
        decision.onFailure ===
          "CONTINUE" &&
        effect === "none",
      effect
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

    const afterActionBudget =
      await usageViolation(
        options
      );

    if (
      afterActionBudget !==
      undefined
    ) {
      return block(
        afterActionBudget.code,
        afterActionBudget.message,
        iteration,
        trajectory
      );
    }

    if (effect === "unknown") {
      return block(
        "ACTION_EFFECT_UNKNOWN",
        "Action effect is unknown; automatic retry is blocked.",
        iteration,
        trajectory
      );
    }

    if (
      !actionResult.success &&
      effect === "committed"
    ) {
      return block(
        "ACTION_EFFECT_COMMITTED",
        "Action reported failure after a committed effect; automatic retry is blocked.",
        iteration,
        trajectory
      );
    }

    if (
      !actionResult.success &&
      decision.onFailure ===
        "FAIL"
    ) {
      return fail(
        "ACTION_FAILED",
        actionResult.message,
        iteration,
        trajectory
      );
    }
  }

  return fail(
    "AGENT_LOOP_FAILED",
    "Agent loop reached its internal iteration ceiling without an explicit COMPLETE decision.",
    iterationCeiling,
    trajectory
  );
}

export class AgentLoopExecutor {
  readonly #policy:
    AgentLoopExecutorOptions["policy"];
  readonly #iterationCeiling?:
    number;
  readonly #budget?:
    AgentLoopBudget;
  readonly #usageMeter?:
    AgentLoopUsageMeter;
  readonly #effectPolicy?:
    AgentLoopActionEffectPolicy;

  public constructor({
    policy,
    iterationCeiling,
    budget,
    usageMeter,
    effectPolicy
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

    validateBudget(
      budget,
      usageMeter
    );

    if (budget !== undefined) {
      this.#budget =
        structuredClone(budget);
    }

    if (
      usageMeter !== undefined
    ) {
      this.#usageMeter =
        usageMeter;
    }

    if (
      effectPolicy !== undefined
    ) {
      this.#effectPolicy =
        effectPolicy;
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
                this
                  .#iterationCeiling
            }),
        ...(this.#budget ===
          undefined
          ? {}
          : {
              budget:
                this.#budget
            }),
        ...(this.#usageMeter ===
          undefined
          ? {}
          : {
              usageMeter:
                this.#usageMeter
            }),
        ...(this.#effectPolicy ===
          undefined
          ? {}
          : {
              effectPolicy:
                this.#effectPolicy
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
