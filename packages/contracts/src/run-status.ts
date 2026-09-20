export const RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

export type RunStatus =
  (typeof RUN_STATUSES)[number];

export const GOAL_STATES = [
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "BLOCKED"
] as const;

export type GoalState =
  (typeof GOAL_STATES)[number];

export const ACTION_EFFECT_STATES = [
  "none",
  "committed",
  "unknown"
] as const;

export type ActionEffectState =
  (typeof ACTION_EFFECT_STATES)[number];

const RUN_STATUS_SET:
  ReadonlySet<string> =
    new Set(RUN_STATUSES);

const GOAL_STATE_SET:
  ReadonlySet<string> =
    new Set(GOAL_STATES);

const ACTION_EFFECT_STATE_SET:
  ReadonlySet<string> =
    new Set(ACTION_EFFECT_STATES);

export function isRunStatus(
  value: unknown
): value is RunStatus {
  return (
    typeof value === "string" &&
    RUN_STATUS_SET.has(value)
  );
}

export function isGoalState(
  value: unknown
): value is GoalState {
  return (
    typeof value === "string" &&
    GOAL_STATE_SET.has(value)
  );
}

export function isActionEffectState(
  value: unknown
): value is ActionEffectState {
  return (
    typeof value === "string" &&
    ACTION_EFFECT_STATE_SET.has(
      value
    )
  );
}
