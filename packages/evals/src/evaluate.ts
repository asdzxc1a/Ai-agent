import type {
  EvalObservation,
  EvalTask,
  EvalTaskResult
} from "./types.js";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function matchesExpected(
  expected: unknown,
  actual: unknown
): boolean {
  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      expected.length !== actual.length
    ) {
      return false;
    }

    return expected.every(
      (value, index) =>
        matchesExpected(value, actual[index])
    );
  }

  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return false;
    }

    return Object.entries(expected).every(
      ([key, value]) =>
        key in actual &&
        matchesExpected(value, actual[key])
    );
  }

  return Object.is(expected, actual);
}

export function evaluateTask(
  task: EvalTask,
  observation: EvalObservation
): EvalTaskResult {
  let success = false;
  let failureCategory:
    EvalTaskResult["failureCategory"] =
      "NONE";

  if (observation.runStatus !== "COMPLETED") {
    failureCategory = "RUN_FAILED";
  } else if (
    observation.stepCount > task.maxSteps
  ) {
    failureCategory =
      "STEP_LIMIT_EXCEEDED";
  } else if (
    observation.finalState === undefined
  ) {
    failureCategory = "NO_FINAL_STATE";
  } else if (
    !matchesExpected(
      task.expected.value,
      observation.finalState
    )
  ) {
    failureCategory = "STATE_MISMATCH";
  } else {
    success = true;
  }

  const falseCompleted =
    !success &&
    observation.runStatus === "COMPLETED";

  return {
    taskId: task.id,
    taskVersion: task.version,
    category: task.category,
    success,
    falseCompleted,
    failureCategory,
    runId: observation.runId,
    runStatus: observation.runStatus,
    stepCount: observation.stepCount,
    durationMs: observation.durationMs,
    artifactComplete:
      observation.artifactComplete,
    actionFailures:
      observation.actionFailures,
    loopCount: observation.loopCount,
    ...(observation.failureCode === undefined
      ? {}
      : {
          failureCode:
            observation.failureCode
        }),
    ...(observation.finalState === undefined
      ? {}
      : {
          finalState:
            observation.finalState
        })
  };
}
