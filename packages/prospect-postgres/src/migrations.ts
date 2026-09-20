import type {
  Pool,
  PoolClient
} from "pg";

const MIGRATION_ONE = `
CREATE TABLE approved_research_targets (
  id TEXT PRIMARY KEY,
  target JSONB NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  company_name TEXT,
  prospect JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE prospect_research_attempts (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL
    REFERENCES approved_research_targets(id),
  prospect_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('COMPLETED', 'FAILED')),
  attempt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT prospect_research_attempt_status
    CHECK (
      (status = 'COMPLETED' AND prospect_id IS NOT NULL)
      OR
      (status = 'FAILED' AND prospect_id IS NULL)
    )
);

CREATE INDEX prospect_research_attempt_target
  ON prospect_research_attempts(target_id, created_at, id);
`;

const MIGRATION_TWO = `
CREATE TABLE prospect_research_samples (
  id TEXT PRIMARY KEY,
  sample JSONB NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE prospect_research_sample_outcomes (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL
    REFERENCES prospect_research_samples(id),
  target_id TEXT NOT NULL
    REFERENCES approved_research_targets(id),
  attempt_id TEXT NOT NULL
    REFERENCES prospect_research_attempts(id),
  outcome JSONB NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT prospect_research_sample_target_once
    UNIQUE (sample_id, target_id),
  CONSTRAINT prospect_research_sample_attempt_once
    UNIQUE (sample_id, attempt_id)
);

CREATE INDEX prospect_research_sample_outcome_order
  ON prospect_research_sample_outcomes(sample_id, reviewed_at, id);
`;

async function applyMigration(
  client: PoolClient,
  version: number,
  sql: string
): Promise<void> {
  const applied =
    await client.query(
      "SELECT 1 FROM prospect_schema_migrations WHERE version = $1",
      [version]
    );

  if (applied.rowCount !== 0) {
    return;
  }

  await client.query(sql);
  await client.query(
    "INSERT INTO prospect_schema_migrations(version) VALUES ($1)",
    [version]
  );
}

export async function runProspectPostgresMigrations(
  pool: Pool
): Promise<void> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [913_572_413]
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospect_schema_migrations (
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
    await client.query(
      "ROLLBACK"
    ).catch(
      () => undefined
    );
    throw error;
  } finally {
    client.release();
  }
}
