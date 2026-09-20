import {
  Pool,
  type PoolClient,
  type PoolConfig
} from "pg";

import type {
  CreateRunRequest,
  GoalStatus,
  RunFailure,
  RunSnapshot,
  RunStatus,
  RunTerminalReason
} from "@astra/contracts";
import type {
  RunEventRecord,
  RunRepository,
  RunStepRecord,
  RunTerminalUpdate,
  RunUpdate
} from "@astra/run-engine";

interface RunRow {
  id: string;
  status: RunStatus;
  goal_status: GoalStatus;
  request: CreateRunRequest;
  result: unknown | null;
  error: RunFailure | null;
  terminal_reason:
    RunTerminalReason | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface StepRow {
  run_id: string;
  sequence_number: number;
  kind: string;
  payload: unknown;
  created_at: Date | string;
}

interface EventRow {
  run_id: string;
  sequence_number: number;
  event_type: string;
  payload: unknown;
  created_at: Date | string;
}

function iso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapRun(row: RunRow): RunSnapshot {
  return {
    id: row.id,
    status: row.status,
    goalStatus: row.goal_status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.result === null
      ? {}
      : {
          result: row.result
        }),
    ...(row.error === null
      ? {}
      : {
          error: row.error
        }),
    ...(row.terminal_reason === null
      ? {}
      : {
          terminalReason:
            row.terminal_reason
        })
  };
}

function mapStep(row: StepRow): RunStepRecord {
  return {
    runId: row.run_id,
    sequenceNumber: row.sequence_number,
    kind: row.kind,
    payload: row.payload,
    createdAt: iso(row.created_at)
  };
}

function mapEvent(row: EventRow): RunEventRecord {
  return {
    runId: row.run_id,
    sequenceNumber: row.sequence_number,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: iso(row.created_at)
  };
}

function validateTerminal(snapshot: RunSnapshot): void {
  const terminal =
    snapshot.status === "COMPLETED" ||
    snapshot.status === "FAILED" ||
    snapshot.status === "CANCELLED";

  if (!terminal) {
    if (
      snapshot.goalStatus !==
        "IN_PROGRESS" ||
      snapshot.terminalReason !==
        undefined
    ) {
      throw new Error(
        "Non-terminal runs must remain IN_PROGRESS without a terminal reason."
      );
    }

    return;
  }

  if (
    snapshot.terminalReason ===
      undefined
  ) {
    throw new Error(
      "Terminal runs must contain a typed terminal reason."
    );
  }

  if (
    snapshot.status === "COMPLETED"
  ) {
    if (
      snapshot.goalStatus !==
        "COMPLETED" ||
      snapshot.result === undefined
    ) {
      throw new Error(
        "COMPLETED runs must contain a validated result and COMPLETED goal state."
      );
    }

    return;
  }

  if (
    snapshot.status === "CANCELLED"
  ) {
    if (
      snapshot.goalStatus !==
      "FAILED"
    ) {
      throw new Error(
        "CANCELLED runs must use FAILED goal state."
      );
    }

    return;
  }

  if (
    snapshot.error === undefined ||
    (
      snapshot.goalStatus !==
        "FAILED" &&
      snapshot.goalStatus !==
        "BLOCKED"
    )
  ) {
    throw new Error(
      "FAILED runs must contain a typed error and FAILED or BLOCKED goal state."
    );
  }
}

function isTerminalStatus(
  status: RunStatus
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

function terminalEventType(
  status:
    RunTerminalUpdate["status"]
): string {
  switch (status) {
    case "COMPLETED":
      return "RUN_COMPLETED";
    case "FAILED":
      return "RUN_FAILED";
    case "CANCELLED":
      return "RUN_CANCELLED";
  }
}

export function createPostgresPool(
  config: PoolConfig
): Pool {
  return new Pool(config);
}

export class PostgresRunRepository implements RunRepository {
  readonly #pool: Pool;

  public constructor(pool: Pool) {
    this.#pool = pool;
  }

  public async createRun(
    snapshot: RunSnapshot,
    request: CreateRunRequest
  ): Promise<void> {
    await this.#pool.query(
      `
        INSERT INTO runs (
          id,
          status,
          goal_status,
          request,
          result,
          error,
          terminal_reason,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, NULL, NULL, NULL, $5, $6)
      `,
      [
        snapshot.id,
        snapshot.status,
        snapshot.goalStatus,
        JSON.stringify(request),
        snapshot.createdAt,
        snapshot.updatedAt
      ]
    );
  }

  public async getRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    const result = await this.#pool.query(
      `
        SELECT
          id,
          status,
          goal_status,
          request,
          result,
          error,
          terminal_reason,
          created_at,
          updated_at
        FROM runs
        WHERE id = $1
      `,
      [runId]
    );

    const row = result.rows[0] as RunRow | undefined;
    return row === undefined
      ? undefined
      : mapRun(row);
  }

  public async getRequest(
    runId: string
  ): Promise<CreateRunRequest | undefined> {
    const result = await this.#pool.query(
      "SELECT request FROM runs WHERE id = $1",
      [runId]
    );

    const row = result.rows[0] as
      | { request: CreateRunRequest }
      | undefined;

    return row?.request;
  }

  public async listActiveRuns():
    Promise<RunSnapshot[]> {
    const result =
      await this.#pool.query(
        `
          SELECT
            id,
            status,
            goal_status,
            request,
            result,
            error,
            terminal_reason,
            created_at,
            updated_at
          FROM runs
          WHERE status IN (
            'PENDING',
            'RUNNING'
          )
          ORDER BY created_at ASC
        `
      );

    return (
      result.rows as RunRow[]
    ).map(mapRun);
  }

  public async updateRun(
    runId: string,
    update: RunUpdate
  ): Promise<RunSnapshot> {
    const current = await this.getRun(runId);

    if (current === undefined) {
      throw new Error(`Run ${runId} does not exist.`);
    }

    const next: RunSnapshot = {
      ...current,
      ...update,
      updatedAt: new Date().toISOString()
    };

    if (
      isTerminalStatus(
        next.status
      )
    ) {
      throw new Error(
        "Terminal runs must use finalizeRun()."
      );
    }

    validateTerminal(next);

    const resultJson =
      next.result === undefined
        ? null
        : JSON.stringify(next.result);
    const errorJson =
      next.error === undefined
        ? null
        : JSON.stringify(next.error);
    const terminalReasonJson =
      next.terminalReason === undefined
        ? null
        : JSON.stringify(
            next.terminalReason
          );

    await this.#pool.query(
      `
        UPDATE runs
        SET
          status = $2,
          goal_status = $3,
          result = $4::jsonb,
          error = $5::jsonb,
          terminal_reason = $6::jsonb,
          updated_at = $7
        WHERE id = $1
      `,
      [
        runId,
        next.status,
        next.goalStatus,
        resultJson,
        errorJson,
        terminalReasonJson,
        next.updatedAt
      ]
    );

    return next;
  }

  public async finalizeRun(
    runId: string,
    update: RunTerminalUpdate,
    eventPayload: unknown
  ): Promise<RunSnapshot> {
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");

      const currentResult =
        await client.query(
          `
            SELECT
              id,
              status,
              goal_status,
              request,
              result,
              error,
              terminal_reason,
              created_at,
              updated_at
            FROM runs
            WHERE id = $1
            FOR UPDATE
          `,
          [runId]
        );
      const row =
        currentResult.rows[0] as
          | RunRow
          | undefined;

      if (row === undefined) {
        throw new Error(
          `Run ${runId} does not exist.`
        );
      }

      const current =
        mapRun(row);

      if (
        isTerminalStatus(
          current.status
        )
      ) {
        throw new Error(
          `Run ${runId} is already terminal.`
        );
      }

      const next:
        RunSnapshot = {
          ...current,
          ...update,
          updatedAt:
            new Date().toISOString()
        };

      validateTerminal(next);

      const sequence =
        await this.#nextSequence(
          client,
          runId,
          "event_sequence"
        );
      const eventType =
        terminalEventType(
          update.status
        );

      await client.query(
        `
          INSERT INTO run_events (
            run_id,
            sequence_number,
            event_type,
            payload
          )
          VALUES (
            $1,
            $2,
            $3,
            $4::jsonb
          )
        `,
        [
          runId,
          sequence,
          eventType,
          JSON.stringify(
            eventPayload
          )
        ]
      );

      await client.query(
        `
          UPDATE runs
          SET
            status = $2,
            goal_status = $3,
            result = $4::jsonb,
            error = $5::jsonb,
            terminal_reason =
              $6::jsonb,
            updated_at = $7
          WHERE id = $1
        `,
        [
          runId,
          next.status,
          next.goalStatus,
          next.result ===
            undefined
            ? null
            : JSON.stringify(
                next.result
              ),
          next.error ===
            undefined
            ? null
            : JSON.stringify(
                next.error
              ),
          JSON.stringify(
            next.terminalReason
          ),
          next.updatedAt
        ]
      );

      await client.query("COMMIT");
      return next;
    } catch (error) {
      await client
        .query("ROLLBACK")
        .catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async #nextSequence(
    client: PoolClient,
    runId: string,
    column: "step_sequence" | "event_sequence"
  ): Promise<number> {
    const result = await client.query(
      `
        UPDATE runs
        SET ${column} = ${column} + 1
        WHERE id = $1
        RETURNING ${column} AS sequence_number
      `,
      [runId]
    );

    const row = result.rows[0] as
      | { sequence_number: number }
      | undefined;

    if (row === undefined) {
      throw new Error(`Run ${runId} does not exist.`);
    }

    return row.sequence_number;
  }

  public async appendStep(
    runId: string,
    kind: string,
    payload: unknown
  ): Promise<RunStepRecord> {
    const client = await this.#pool.connect();

    try {
      await client.query("BEGIN");
      const sequence = await this.#nextSequence(
        client,
        runId,
        "step_sequence"
      );

      const result = await client.query(
        `
          INSERT INTO run_steps (
            run_id,
            sequence_number,
            kind,
            payload
          )
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING
            run_id,
            sequence_number,
            kind,
            payload,
            created_at
        `,
        [
          runId,
          sequence,
          kind,
          JSON.stringify(payload)
        ]
      );

      await client.query("COMMIT");
      return mapStep(result.rows[0] as StepRow);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async appendEvent(
    runId: string,
    eventType: string,
    payload: unknown
  ): Promise<RunEventRecord> {
    const client = await this.#pool.connect();

    try {
      await client.query("BEGIN");
      const sequence = await this.#nextSequence(
        client,
        runId,
        "event_sequence"
      );

      const result = await client.query(
        `
          INSERT INTO run_events (
            run_id,
            sequence_number,
            event_type,
            payload
          )
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING
            run_id,
            sequence_number,
            event_type,
            payload,
            created_at
        `,
        [
          runId,
          sequence,
          eventType,
          JSON.stringify(payload)
        ]
      );

      await client.query("COMMIT");
      return mapEvent(result.rows[0] as EventRow);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async listSteps(
    runId: string
  ): Promise<RunStepRecord[]> {
    const result = await this.#pool.query(
      `
        SELECT
          run_id,
          sequence_number,
          kind,
          payload,
          created_at
        FROM run_steps
        WHERE run_id = $1
        ORDER BY sequence_number ASC
      `,
      [runId]
    );

    return (result.rows as StepRow[]).map(mapStep);
  }

  public async listEventsAfter(
    runId: string,
    afterSequence: number,
    limit = 100
  ): Promise<RunEventRecord[]> {
    if (
      !Number.isInteger(afterSequence) ||
      afterSequence < 0 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      throw new RangeError(
        "Event cursor and limit must be positive integers."
      );
    }

    const result = await this.#pool.query(
      `
        SELECT
          run_id,
          sequence_number,
          event_type,
          payload,
          created_at
        FROM run_events
        WHERE run_id = $1
          AND sequence_number > $2
        ORDER BY sequence_number ASC
        LIMIT $3
      `,
      [runId, afterSequence, limit]
    );

    return (result.rows as EventRow[]).map(mapEvent);
  }

  public async listEvents(
    runId: string
  ): Promise<RunEventRecord[]> {
    const result = await this.#pool.query(
      `
        SELECT
          run_id,
          sequence_number,
          event_type,
          payload,
          created_at
        FROM run_events
        WHERE run_id = $1
        ORDER BY sequence_number ASC
      `,
      [runId]
    );

    return (result.rows as EventRow[]).map(mapEvent);
  }
}
