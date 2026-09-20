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
    goalState:
      "IN_PROGRESS",
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
      terminalReason: {
        code: "GOAL_VERIFIED",
        message:
          "Fixture claimed verification without completing the goal state."
      },
      result: {
        count: 1,
        status: "clicked"
      }
    })
  ).rejects.toThrow(
    "COMPLETED runs must have goalState COMPLETED."
  );

  const completed = await repository.updateRun(
    runId,
    {
      status: "COMPLETED",
      goalState: "COMPLETED",
      terminalReason: {
        code: "GOAL_VERIFIED",
        message:
          "Durable fixture verified."
      },
      result: {
        count: 1,
        status: "clicked"
      }
    }
  );

  expect(completed).toMatchObject({
    status: "COMPLETED",
    goalState: "COMPLETED",
    terminalReason: {
      code: "GOAL_VERIFIED"
    },
    result: {
      count: 1,
      status: "clicked"
    }
  });

  expect(
    await repository.getRun(runId)
  ).toMatchObject({
    status: "COMPLETED",
    goalState: "COMPLETED",
    terminalReason: {
      code: "GOAL_VERIFIED"
    }
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
      goalState: "FAILED",
      terminalReason: {
        code: "EXECUTION_FAILED",
        message: "fixture failure"
      },
      error: {
        code: "EXECUTION_FAILED",
        message: "fixture failure"
      }
    }
  );

  expect(failed.error).toEqual({
    code: "EXECUTION_FAILED",
    message: "fixture failure"
  });

  expect(
    await repository.getRun(failedId)
  ).toMatchObject({
    status: "FAILED",
    goalState: "FAILED",
    terminalReason: {
      code: "EXECUTION_FAILED"
    },
    error: failed.error
  });

  const cancelledId =
    randomUUID();
  await repository.createRun(
    pendingRun(cancelledId),
    request
  );

  const cancelled =
    await repository.updateRun(
      cancelledId,
      {
        status: "CANCELLED",
        goalState: "BLOCKED",
        terminalReason: {
          code: "CANCELLED",
          message:
            "operator cancelled"
        },
        error: {
          code: "CANCELLED",
          message:
            "operator cancelled"
        }
      }
    );

  expect(cancelled).toMatchObject({
    status: "CANCELLED",
    goalState: "BLOCKED",
    terminalReason: {
      code: "CANCELLED"
    }
  });
  expect(
    await repository.getRun(
      cancelledId
    )
  ).toMatchObject({
    status: "CANCELLED",
    goalState: "BLOCKED",
    terminalReason: {
      code: "CANCELLED"
    }
  });
});

test.each([
  "STEP_LIMIT_EXCEEDED",
  "EXECUTION_TIMEOUT",
  "MODEL_COST_BUDGET_EXCEEDED",
  "ACTION_EFFECT_UNKNOWN"
] as const)(
  "PostgresRunRepository round-trips bounded terminal reason %s",
  async (code) => {
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

    await repository.updateRun(
      runId,
      {
        status: "FAILED",
        goalState: "BLOCKED",
        terminalReason: {
          code,
          message:
            "bounded fixture"
        },
        error: {
          code,
          message:
            "bounded fixture"
        }
      }
    );

    const reloadedRepository =
      new PostgresRunRepository(
        pool
      );
    const reloaded =
      await reloadedRepository.getRun(
        runId
      );

    expect(reloaded).toMatchObject({
      status: "FAILED",
      goalState: "BLOCKED",
      terminalReason: {
        code,
        message:
          "bounded fixture"
      },
      error: {
        code,
        message:
          "bounded fixture"
      }
    });
  }
);

test(
  "migration 2 preserves legacy completed evidence without retroactive verification",
  async () => {
    const runId =
      randomUUID();
    const now =
      new Date().toISOString();

    await pool.query(
      "DELETE FROM schema_migrations WHERE version = $1",
      [2]
    );
    await pool.query(`
      ALTER TABLE runs
        DROP CONSTRAINT IF EXISTS runs_goal_status_consistency,
        DROP CONSTRAINT IF EXISTS runs_goal_state,
        DROP COLUMN IF EXISTS terminal_reason,
        DROP COLUMN IF EXISTS goal_state
    `);

    await pool.query(
      `
        INSERT INTO runs (
          id,
          status,
          request,
          result,
          error,
          created_at,
          updated_at,
          step_sequence,
          event_sequence
        )
        VALUES (
          $1,
          'COMPLETED',
          $2::jsonb,
          $3::jsonb,
          NULL,
          $4,
          $4,
          0,
          0
        )
      `,
      [
        runId,
        JSON.stringify(request),
        JSON.stringify({
          legacy: true,
          count: 1
        }),
        now
      ]
    );

    try {
      await runPostgresMigrations(
        pool
      );

      const migrated =
        await repository.getRun(
          runId
        );

      expect(migrated).toMatchObject({
        status: "FAILED",
        goalState: "BLOCKED",
        terminalReason: {
          code:
            "COMPLETION_REJECTED",
          message:
            "Legacy completed run predates semantic completion verification."
        },
        error: {
          code:
            "COMPLETION_REJECTED"
        }
      });
      expect(
        migrated?.result
      ).toBeUndefined();

      const steps =
        await repository.listSteps(
          runId
        );

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        sequenceNumber: 1,
        kind:
          "LEGACY_UNVERIFIED_RESULT",
        payload: {
          previousStatus:
            "COMPLETED",
          result: {
            legacy: true,
            count: 1
          }
        }
      });
    } finally {
      await runPostgresMigrations(
        pool
      );
    }
  }
);


test(
  "migration V2 reclassifies legacy completion without inventing verification",
  async () => {
    const schema =
      "gate10_legacy_" +
      randomUUID().replaceAll(
        "-",
        ""
      );

    await pool.query(
      "CREATE SCHEMA " +
        schema
    );

    const legacyPool =
      createPostgresPool({
        connectionString,
        max: 1,
        options:
          "-c search_path=" +
          schema
      });

    try {
      await legacyPool.query(
        "CREATE TABLE schema_migrations (" +
          "version INTEGER PRIMARY KEY," +
          "applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
        ")"
      );
      await legacyPool.query(
        "INSERT INTO schema_migrations(version) VALUES (1)"
      );

      await legacyPool.query(
        "CREATE TABLE runs (" +
          "id UUID PRIMARY KEY," +
          "status TEXT NOT NULL CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED'))," +
          "request JSONB NOT NULL," +
          "result JSONB," +
          "error JSONB," +
          "created_at TIMESTAMPTZ NOT NULL," +
          "updated_at TIMESTAMPTZ NOT NULL," +
          "step_sequence INTEGER NOT NULL DEFAULT 0," +
          "event_sequence INTEGER NOT NULL DEFAULT 0," +
          "CONSTRAINT runs_completed_result CHECK (status <> 'COMPLETED' OR result IS NOT NULL)," +
          "CONSTRAINT runs_failed_error CHECK (status <> 'FAILED' OR error IS NOT NULL)" +
        ")"
      );
      await legacyPool.query(
        "CREATE TABLE run_steps (" +
          "id BIGSERIAL PRIMARY KEY," +
          "run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE," +
          "sequence_number INTEGER NOT NULL," +
          "kind TEXT NOT NULL," +
          "payload JSONB NOT NULL," +
          "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
          "UNIQUE (run_id, sequence_number)" +
        ")"
      );
      await legacyPool.query(
        "CREATE TABLE run_events (" +
          "id BIGSERIAL PRIMARY KEY," +
          "run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE," +
          "sequence_number INTEGER NOT NULL," +
          "event_type TEXT NOT NULL," +
          "payload JSONB NOT NULL," +
          "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
          "UNIQUE (run_id, sequence_number)" +
        ")"
      );

      const runId =
        randomUUID();
      const now =
        new Date().toISOString();
      const legacyResult = {
        company: "Legacy Acme",
        status: "claimed-complete"
      };

      await legacyPool.query(
        "INSERT INTO runs (" +
          "id,status,request,result,error,created_at,updated_at,step_sequence,event_sequence" +
        ") VALUES ($1,'COMPLETED',$2::jsonb,$3::jsonb,NULL,$4,$4,1,2)",
        [
          runId,
          JSON.stringify(request),
          JSON.stringify(
            legacyResult
          ),
          now
        ]
      );
      await legacyPool.query(
        "INSERT INTO run_steps (run_id,sequence_number,kind,payload) " +
        "VALUES ($1,1,'EXTRACT',$2::jsonb)",
        [
          runId,
          JSON.stringify({
            result:
              legacyResult
          })
        ]
      );
      await legacyPool.query(
        "INSERT INTO run_events (run_id,sequence_number,event_type,payload) VALUES " +
        "($1,1,'RUN_CREATED',$2::jsonb)," +
        "($1,2,'RUN_COMPLETED',$3::jsonb)",
        [
          runId,
          JSON.stringify({
            status: "PENDING"
          }),
          JSON.stringify({
            result:
              legacyResult
          })
        ]
      );

      await runPostgresMigrations(
        legacyPool
      );

      const migratedRepository =
        new PostgresRunRepository(
          legacyPool
        );
      const migrated =
        await migratedRepository.getRun(
          runId
        );

      expect(migrated).toMatchObject({
        status: "FAILED",
        goalState: "BLOCKED",
        terminalReason: {
          code:
            "COMPLETION_REJECTED"
        },
        error: {
          code:
            "COMPLETION_REJECTED"
        }
      });
      expect(
        migrated?.result
      ).toBeUndefined();

      const steps =
        await migratedRepository.listSteps(
          runId
        );
      expect(
        steps.map(
          (step) =>
            step.sequenceNumber
        )
      ).toEqual([1, 2]);
      expect(
        steps.at(-1)
      ).toMatchObject({
        kind:
          "LEGACY_UNVERIFIED_RESULT",
        payload: {
          previousStatus:
            "COMPLETED",
          result:
            legacyResult
        }
      });

      const events =
        await migratedRepository.listEvents(
          runId
        );
      expect(
        events.map(
          (event) =>
            event.sequenceNumber
        )
      ).toEqual([1, 2, 3]);
      expect(
        events.at(-1)
      ).toMatchObject({
        eventType:
          "RUN_FAILED",
        payload: {
          goalState:
            "BLOCKED",
          reason: {
            code:
              "COMPLETION_REJECTED"
          },
          error: {
            code:
              "COMPLETION_REJECTED"
          }
        }
      });
    } finally {
      await legacyPool.end();
      await pool.query(
        "DROP SCHEMA IF EXISTS " +
          schema +
          " CASCADE"
      );
    }
  }
);
