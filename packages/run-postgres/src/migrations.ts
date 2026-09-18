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

    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [1]
    );

    if (applied.rowCount === 0) {
      await client.query(MIGRATION_ONE);
      await client.query(
        "INSERT INTO schema_migrations(version) VALUES ($1)",
        [1]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
