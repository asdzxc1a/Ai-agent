export const RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

const RUN_STATUS_SET: ReadonlySet<string> = new Set(RUN_STATUSES);

export function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && RUN_STATUS_SET.has(value);
}
