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
    "Terminal runs must contain a typed terminal reason."
  );

  const completed = await repository.updateRun(
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
        message: "fixture verified"
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

  expect(
    (await repository.listEvents(runId)).map(
      (event) => event.sequenceNumber
    )
  ).toEqual([1, 2]);

  const afterFirstEvent = await repository.listEventsAfter(
    runId,
    1,
    10
  );

  expect(
    afterFirstEvent.map(
      (event) => event.sequenceNumber
    )
  ).toEqual([2]);

  const failedId = randomUUID();
  await repository.createRun(
    pendingRun(failedId),
    request
  );

  const failed = await repository.updateRun(
    failedId,
    {
      status: "FAILED",
      goalStatus: "FAILED",
      error: {
        code: "EXECUTION_FAILED",
        message: "fixture failure"
      },
      terminalReason: {
        code: "EXECUTION_FAILED",
        message: "fixture failure"
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
    await repository.updateRun(
      cancelledId,
      {
        status: "CANCELLED",
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
