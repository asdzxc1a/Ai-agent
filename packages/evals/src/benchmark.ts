import {
  EVAL_REPORT_SCHEMA_VERSION,
  type EvalBenchmarkMetadata,
  type EvalBenchmarkReport,
  type EvalTaskResult
} from "./types.js";

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );
  const middle = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return (
    ((sorted[middle - 1] ?? 0) +
      (sorted[middle] ?? 0)) /
    2
  );
}

export function buildBenchmarkReport(
  metadata: EvalBenchmarkMetadata,
  tasks: EvalTaskResult[]
): EvalBenchmarkReport {
  const passed = tasks.filter(
    (task) => task.success
  ).length;
  const total = tasks.length;

  return {
    schemaVersion:
      EVAL_REPORT_SCHEMA_VERSION,
    metadata,
    aggregate: {
      total,
      passed,
      failed: total - passed,
      falseCompleted: tasks.filter(
        (task) => task.falseCompleted
      ).length,
      successRate:
        total === 0
          ? 0
          : passed / total,
      medianSteps: median(
        tasks.map(
          (task) => task.stepCount
        )
      ),
      medianDurationMs: median(
        tasks.map(
          (task) => task.durationMs
        )
      )
    },
    tasks
  };
}

export function serializeBenchmarkReport(
  report: EvalBenchmarkReport
): string {
  return `${JSON.stringify(
    report,
    null,
    2
  )}\n`;
}
