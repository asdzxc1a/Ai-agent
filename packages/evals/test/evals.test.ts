import {
  describe,
  expect,
  test
} from "vitest";

import {
  buildBenchmarkReport,
  EVAL_FIXTURE_VERSION,
  EVAL_TASKS,
  evaluateTask,
  resolveTaskStartUrl
} from "../src/index.js";

describe("Gate 8 evaluation contracts", () => {
  test("defines thirteen versioned tasks across distinct categories", () => {
    expect(EVAL_TASKS).toHaveLength(13);
    expect(
      new Set(
        EVAL_TASKS.map((task) => task.id)
      ).size
    ).toBe(EVAL_TASKS.length);
    expect(
      new Set(
        EVAL_TASKS.map(
          (task) => task.category
        )
      ).size
    ).toBeGreaterThanOrEqual(12);

    for (const task of EVAL_TASKS) {
      expect(task.version).toBe(1);
      expect(task.maxSteps).toBeGreaterThanOrEqual(
        task.contractActions.length
      );
      expect(task.timeoutMs).toBeGreaterThan(0);
      expect(task.startUrl).toMatch(
        /^http:\/\/eval\.fixture\.local\//
      );
    }
  });

  test("locks Baseline 0 task shape without changing tasks for score", () => {
    const oneAction = EVAL_TASKS.filter(
      (task) =>
        task.contractActions.length === 1
    );

    expect(oneAction).toHaveLength(5);
  });

  test("resolves canonical URLs onto the runtime fixture origin", () => {
    expect(
      resolveTaskStartUrl(
        EVAL_TASKS[0]!,
        "http://127.0.0.1:4174"
      )
    ).toBe(
      "http://127.0.0.1:4174/button"
    );
  });

  test("marks wrong completed state as a false completion", () => {
    const task = EVAL_TASKS[0]!;
    const result = evaluateTask(task, {
      runId: "run-1",
      runStatus: "COMPLETED",
      finalState: {
        complete: false
      },
      stepCount: 1,
      durationMs: 10,
      artifactComplete: true,
      actionFailures: 0,
      loopCount: 0
    });

    expect(result.success).toBe(false);
    expect(result.falseCompleted).toBe(
      true
    );
    expect(result.failureCategory).toBe(
      "STATE_MISMATCH"
    );
  });

  test("aggregates outcomes without retry-adjusting failures", () => {
    const task = EVAL_TASKS[0]!;
    const passed = evaluateTask(task, {
      runId: "run-pass",
      runStatus: "COMPLETED",
      finalState: {
        complete: true
      },
      stepCount: 1,
      durationMs: 12,
      artifactComplete: true,
      actionFailures: 0,
      loopCount: 0
    });
    const failed = evaluateTask(task, {
      runId: "run-fail",
      runStatus: "COMPLETED",
      finalState: {
        complete: false
      },
      stepCount: 1,
      durationMs: 20,
      artifactComplete: true,
      actionFailures: 0,
      loopCount: 0
    });

    const report = buildBenchmarkReport(
      {
        lane: "contract",
        fixtureVersion:
          EVAL_FIXTURE_VERSION,
        gitCommit: "abc123",
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        model: {
          provider: "scripted",
          model: "contract-v1"
        }
      },
      [passed, failed]
    );

    expect(report.aggregate).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      falseCompleted: 1,
      successRate: 0.5,
      medianSteps: 1,
      medianDurationMs: 16
    });
  });
});
