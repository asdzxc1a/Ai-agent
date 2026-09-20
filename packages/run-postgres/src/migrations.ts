import type { Pool } from "pg";

const MIGRATION_ONE = `
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL
    CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  request JSONB NOT NULL,
  result JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  step_sequence INTEGER NOT NULL DEFAULT 0,
  event_sequence INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT runs_completed_result
    CHECK (status <> 'COMPLETED' OR result IS NOT NULL),
  CONSTRAINT runs_failed_error
    CHECK (status <> 'FAILED' OR error IS NOT NULL)
);

CREATE TABLE run_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, sequence_number)
);

CREATE TABLE run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, sequence_number)
);
`;

const MIGRATION_TWO = `
ALTER TABLE runs
  ADD COLUMN goal_state TEXT,
  ADD COLUMN terminal_reason JSONB;

WITH legacy_completed AS (
  UPDATE runs
  SET step_sequence = step_sequence + 1
  WHERE status = 'COMPLETED'
    AND result IS NOT NULL
  RETURNING
    id,
    step_sequence,
    result
)
INSERT INTO run_steps (
  run_id,
  sequence_number,
  kind,
  payload
)
SELECT
  id,
  step_sequence,
  'LEGACY_UNVERIFIED_RESULT',
  jsonb_build_object(
    'previousStatus',
    'COMPLETED',
    'result',
    result
  )
FROM legacy_completed;

UPDATE runs
SET
  status = CASE
    WHEN status = 'COMPLETED' THEN 'FAILED'
    ELSE status
  END,
  goal_state = CASE status
    WHEN 'COMPLETED' THEN 'BLOCKED'
    WHEN 'FAILED' THEN 'FAILED'
    WHEN 'CANCELLED' THEN 'BLOCKED'
    ELSE 'IN_PROGRESS'
  END,
  terminal_reason = CASE
    WHEN status = 'COMPLETED'
      THEN jsonb_build_object(
        'code', 'COMPLETION_REJECTED',
        'message',
        'Legacy completed run predates semantic completion verification.'
      )
    WHEN status = 'FAILED'
      THEN jsonb_build_object(
        'code', error->>'code',
        'message', error->>'message'
      )
    WHEN status = 'CANCELLED'
      THEN jsonb_build_object(
        'code', 'CANCELLED',
        'message', COALESCE(
          error->>'message',
          'Run cancelled.'
        )
      )
    ELSE NULL
  END,
  result = CASE
    WHEN status = 'COMPLETED' THEN NULL
    ELSE result
  END,
  error = CASE
    WHEN status = 'COMPLETED'
      THEN jsonb_build_object(
        'code', 'COMPLETION_REJECTED',
        'message',
        'Legacy completed run predates semantic completion verification.'
      )
    WHEN status = 'CANCELLED' AND error IS NULL
      THEN '{"code":"CANCELLED","message":"Run cancelled."}'::jsonb
    ELSE error
  END;

ALTER TABLE runs
  ALTER COLUMN goal_state SET NOT NULL,
  ADD CONSTRAINT runs_goal_state
    CHECK (
      goal_state IN (
        'IN_PROGRESS',
        'COMPLETED',
        'FAILED',
        'BLOCKED'
      )
    ),
  ADD CONSTRAINT runs_goal_status_consistency
    CHECK (
      (
        status IN ('PENDING', 'RUNNING')
        AND goal_state = 'IN_PROGRESS'
        AND terminal_reason IS NULL
      )
      OR (
        status = 'COMPLETED'
        AND goal_state = 'COMPLETED'
        AND terminal_reason IS NOT NULL
      )
      OR (
        status = 'FAILED'
        AND goal_state IN ('FAILED', 'BLOCKED')
        AND terminal_reason IS NOT NULL
      )
      OR (
        status = 'CANCELLED'
        AND goal_state = 'BLOCKED'
        AND terminal_reason IS NOT NULL
      )
    );
`;

const MIGRATIONS = [
  [1, MIGRATION_ONE],
  [2, MIGRATION_TWO]
] as const;

export async function runPostgresMigrations(
  pool: Pool
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [913_572_401]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (
      const [version, sql]
      of MIGRATIONS
    ) {
      const applied =
        await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = $1",
          [version]
        );

      if (applied.rowCount !== 0) {
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version) VALUES ($1)",
        [version]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query(
      "ROLLBACK"
    ).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
