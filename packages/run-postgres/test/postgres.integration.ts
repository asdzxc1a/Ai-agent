import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import type { CreateRunRequest, RunSnapshot } from "@astra/contracts";

import {
  createPostgresPool,
  PostgresRunRepository,
  runPostgresMigrations
} from "../src/index.js";

const connectionString = process.env.TEST_DATABASE_URL;

if (connectionString === undefined) {
  throw new Error("TEST_DATABASE_URL is required.");
}

const pool = createPostgresPool({
  connectionString,
  max: 4
});

const repository = new PostgresRunRepository(pool);

beforeAll(async () => {
  await runPostgresMigrations(pool);
  await runPostgresMigrations(pool);
});

beforeEach(async () => {
  await pool.query(
    "TRUNCATE run_events, run_steps, runs RESTART IDENTITY CASCADE"
  );
});

afterAll(async () => {
  await pool.end();
});

function pendingRun(id: string): RunSnapshot {
  const now = new Date().toISOString();

  return {
    id,
    status: "PENDING",
    goalStatus: "IN_PROGRESS",
    createdAt: now,
    updatedAt: now
  };
}

const request: CreateRunRequest = {
  url: "http://fixture.test/",
  goal: "Run durable repository test."
};

test("PostgresRunRepository persists ordered run state, steps, and events", async () => {
  const runId = randomUUID();

  await repository.createRun(
    pendingRun(runId),
    request
  );

  expect(await repository.getRequest(runId)).toEqual(request);
  expect((await repository.getRun(runId))?.status).toBe("PENDING");

  await repository.updateRun(runId, {
    status: "RUNNING"
  });

  const step1 = await repository.appendStep(
    runId,
    "NAVIGATE",
    { url: request.url }
  );
  const step2 = await repository.appendStep(
    runId,
    "ACT",
    { success: true }
  );

  expect([
    step1.sequenceNumber,
    step2.sequenceNumber
  ]).toEqual([1, 2]);

  const event1 = await repository.appendEvent(
    runId,
    "RUN_CREATED",
    { status: "PENDING" }
  );
  const event2 = await repository.appendEvent(
    runId,
    "RUN_STARTED",
    { status: "RUNNING" }
  );

  expect([
    event1.sequenceNumber,
    event2.sequenceNumber
  ]).toEqual([1, 2]);

  await expect(
    repository.updateRun(runId, {
      status: "COMPLETED",
      goalStatus: "COMPLETED"
    })
  ).rejects.toThrow(
    "Terminal runs must use finalizeRun()."
  );

  const completed =
    await repository.finalizeRun(
      runId,
      {
        status: "COMPLETED",
        goalStatus: "COMPLETED",
        result: {
          count: 1,
          status: "clicked"
        },
        terminalReason: {
          code: "GOAL_COMPLETED",
          message:
            "fixture verified"
        }
      },
      {
        goalStatus:
          "COMPLETED",
        result: {
          count: 1,
          status: "clicked"
        },
        terminalReason: {
          code: "GOAL_COMPLETED",
          message:
            "fixture verified"
        }
      }
    );

  expect(completed.result).toEqual({
    count: 1,
    status: "clicked"
  });

  expect(
    (await repository.listSteps(runId)).map(
      (step) => step.sequenceNumber
    )
  ).toEqual([1, 2]);

  const completedEvents =
    await repository.listEvents(
      runId
    );

  expect(
    completedEvents.map(
      (event) =>
        event.sequenceNumber
    )
  ).toEqual([1, 2, 3]);
  expect(
    completedEvents.at(-1)
      ?.eventType
  ).toBe("RUN_COMPLETED");

  const afterFirstEvent =
    await repository
      .listEventsAfter(
        runId,
        1,
        10
      );

  expect(
    afterFirstEvent.map(
      (event) =>
        event.sequenceNumber
    )
  ).toEqual([2, 3]);

  const failedId = randomUUID();
  await repository.createRun(
    pendingRun(failedId),
    request
  );

  const failed =
    await repository.finalizeRun(
      failedId,
      {
        status: "FAILED",
        goalStatus: "FAILED",
        error: {
          code:
            "EXECUTION_FAILED",
          message:
            "fixture failure"
        },
        terminalReason: {
          code:
            "EXECUTION_FAILED",
          message:
            "fixture failure"
        }
      },
      {
        goalStatus: "FAILED",
        error: {
          code:
            "EXECUTION_FAILED",
          message:
            "fixture failure"
        },
        terminalReason: {
          code:
            "EXECUTION_FAILED",
          message:
            "fixture failure"
        }
      }
    );

  expect(failed.error).toEqual({
    code: "EXECUTION_FAILED",
    message: "fixture failure"
  });

  const persistedFailed =
    await repository.getRun(
      failedId
    );

  expect(
    persistedFailed?.error
  ).toEqual(failed.error);
  expect(
    persistedFailed?.goalStatus
  ).toBe("FAILED");
  expect(
    persistedFailed?.terminalReason
  ).toEqual({
    code: "EXECUTION_FAILED",
    message: "fixture failure"
  });

  const cancelledId = randomUUID();
  await repository.createRun(
    pendingRun(cancelledId),
    request
  );

  const cancelled =
    await repository.finalizeRun(
      cancelledId,
      {
        status: "CANCELLED",
        goalStatus: "FAILED",
        terminalReason: {
          code: "RUN_CANCELLED",
          message:
            "fixture cancellation"
        }
      },
      {
        goalStatus: "FAILED",
        terminalReason: {
          code: "RUN_CANCELLED",
          message:
            "fixture cancellation"
        }
      }
    );

  expect(cancelled.status).toBe(
    "CANCELLED"
  );
  expect(cancelled.goalStatus).toBe(
    "FAILED"
  );
  expect(
    (
      await repository.getRun(
        cancelledId
      )
    )?.terminalReason
  ).toEqual({
    code: "RUN_CANCELLED",
    message: "fixture cancellation"
  });
});

test(
  "PostgresRunRepository lists only non-terminal runs for startup reconciliation",
  async () => {
    const pendingId =
      randomUUID();
    const runningId =
      randomUUID();
    const completedId =
      randomUUID();

    await repository.createRun(
      pendingRun(pendingId),
      request
    );
    await repository.createRun(
      pendingRun(runningId),
      request
    );
    await repository.createRun(
      pendingRun(completedId),
      request
    );

    await repository.updateRun(
      runningId,
      {
        status: "RUNNING"
      }
    );
    await repository.finalizeRun(
      completedId,
      {
        status: "COMPLETED",
        goalStatus:
          "COMPLETED",
        result: {
          ok: true
        },
        terminalReason: {
          code:
            "GOAL_COMPLETED",
          message:
            "fixture verified"
        }
      },
      {
        goalStatus:
          "COMPLETED",
        result: {
          ok: true
        },
        terminalReason: {
          code:
            "GOAL_COMPLETED",
          message:
            "fixture verified"
        }
      }
    );

    const active =
      await repository
        .listActiveRuns();

    expect(active).toHaveLength(2);
    expect(active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pendingId,
          status: "PENDING"
        }),
        expect.objectContaining({
          id: runningId,
          status: "RUNNING"
        })
      ])
    );
  }
);

test(
  "PostgresRunRepository cannot overwrite a terminal run with a stale non-terminal update",
  async () => {
    const runId =
      randomUUID();

    await repository.createRun(
      pendingRun(runId),
      request
    );
    await repository.updateRun(
      runId,
      {
        status: "RUNNING"
      }
    );
    await repository.finalizeRun(
      runId,
      {
        status: "FAILED",
        goalStatus: "FAILED",
        error: {
          code:
            "EXECUTION_FAILED",
          message:
            "terminal fixture"
        },
        terminalReason: {
          code:
            "EXECUTION_FAILED",
          message:
            "terminal fixture"
        }
      },
      {
        goalStatus: "FAILED",
        error: {
          code:
            "EXECUTION_FAILED",
          message:
            "terminal fixture"
        },
        terminalReason: {
          code:
            "EXECUTION_FAILED",
          message:
            "terminal fixture"
        }
      }
    );

    await expect(
      repository.updateRun(
        runId,
        {
          status: "RUNNING",
          goalStatus:
            "IN_PROGRESS"
        }
      )
    ).rejects.toThrow(
      `Run ${runId} is already terminal.`
    );

    await expect(
      repository.getRun(
        runId
      )
    ).resolves.toMatchObject({
      status: "FAILED",
      goalStatus: "FAILED"
    });
    expect(
      (
        await repository
          .listEvents(runId)
      ).map(
        (event) =>
          event.eventType
      )
    ).toEqual([
      "RUN_FAILED"
    ]);
  }
);

test(
  "PostgresRunRepository rolls back terminal state, event, and sequence together",
  async () => {
    const runId =
      randomUUID();

    await repository.createRun(
      pendingRun(runId),
      request
    );
    await repository.updateRun(
      runId,
      {
        status: "RUNNING"
      }
    );
    const started =
      await repository.appendEvent(
        runId,
        "RUN_STARTED",
        {
          status: "RUNNING"
        }
      );

    expect(
      started.sequenceNumber
    ).toBe(1);

    await expect(
      repository.finalizeRun(
        runId,
        {
          status: "COMPLETED",
          goalStatus:
            "COMPLETED",
          result: {
            ok: true
          },
          terminalReason: {
            code:
              "GOAL_COMPLETED",
            message:
              "fixture verified"
          }
        },
        {
          impossible:
            BigInt(1)
        }
      )
    ).rejects.toThrow();

    expect(
      (
        await repository.getRun(
          runId
        )
      )?.status
    ).toBe("RUNNING");
    expect(
      (
        await repository.listEvents(
          runId
        )
      ).map(
        (event) =>
          event.eventType
      )
    ).toEqual([
      "RUN_STARTED"
    ]);

    const next =
      await repository.appendEvent(
        runId,
        "RUN_PROGRESS",
        {
          recovered: true
        }
      );

    expect(
      next.sequenceNumber
    ).toBe(2);
  }
);

