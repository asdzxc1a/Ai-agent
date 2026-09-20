import type {
  Pool,
  PoolClient
} from "pg";

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
  ADD COLUMN goal_status TEXT;

UPDATE runs
SET goal_status = CASE
  WHEN status = 'COMPLETED' THEN 'COMPLETED'
  WHEN status IN ('FAILED', 'CANCELLED') THEN 'FAILED'
  ELSE 'IN_PROGRESS'
END;

ALTER TABLE runs
  ALTER COLUMN goal_status SET NOT NULL,
  ADD CONSTRAINT runs_goal_status
    CHECK (goal_status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED')),
  ADD CONSTRAINT runs_status_goal_status
    CHECK (
      (status IN ('PENDING', 'RUNNING') AND goal_status = 'IN_PROGRESS')
      OR
      (status = 'COMPLETED' AND goal_status = 'COMPLETED')
      OR
      (status = 'FAILED' AND goal_status IN ('FAILED', 'BLOCKED'))
      OR
      (status = 'CANCELLED' AND goal_status = 'FAILED')
    );

ALTER TABLE runs
  ADD COLUMN terminal_reason JSONB;

UPDATE runs
SET terminal_reason = CASE
  WHEN status = 'COMPLETED' THEN
    jsonb_build_object('code', 'GOAL_COMPLETED', 'message', 'Goal completed before terminal-reason migration.')
  WHEN status = 'FAILED' THEN error
  WHEN status = 'CANCELLED' THEN
    jsonb_build_object('code', 'RUN_CANCELLED', 'message', 'Run cancelled before terminal-reason migration.')
  ELSE NULL
END;

ALTER TABLE runs
  ADD CONSTRAINT runs_terminal_reason
    CHECK (
      (status IN ('COMPLETED', 'FAILED', 'CANCELLED') AND terminal_reason IS NOT NULL)
      OR
      (status IN ('PENDING', 'RUNNING') AND terminal_reason IS NULL)
    );
`;

async function applyMigration(
  client: PoolClient,
  version: number,
  sql: string
): Promise<void> {
  const applied = await client.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    [version]
  );

  if (applied.rowCount !== 0) {
    return;
  }

  await client.query(sql);
  await client.query(
    "INSERT INTO schema_migrations(version) VALUES ($1)",
    [version]
  );
}

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

    await applyMigration(
      client,
      1,
      MIGRATION_ONE
    );
    await applyMigration(
      client,
      2,
      MIGRATION_TWO
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
