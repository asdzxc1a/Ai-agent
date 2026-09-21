export const GATE13_RUN_OWNER_LOCK_KEY =
  913_572_414;

export interface Gate13AdvisoryLockResult {
  rows:
    readonly Record<
      string,
      unknown
    >[];
}

export type Gate13AdvisoryLockQuery =
  (
    sql: string,
    values:
      readonly unknown[]
  ) => Promise<
    Gate13AdvisoryLockResult
  >;

export async function acquireGate13RunOwnership(
  query:
    Gate13AdvisoryLockQuery
): Promise<void> {
  const result =
    await query(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [
        GATE13_RUN_OWNER_LOCK_KEY
      ]
    );

  if (
    result.rows[0]?.[
      "acquired"
    ] !== true
  ) {
    throw new Error(
      "Gate 13 live research already has an active operator owner in this database. Wait for that run-target process to finish or cancel it before starting another."
    );
  }
}

export async function releaseGate13RunOwnership(
  query:
    Gate13AdvisoryLockQuery
): Promise<void> {
  const result =
    await query(
      "SELECT pg_advisory_unlock($1) AS released",
      [
        GATE13_RUN_OWNER_LOCK_KEY
      ]
    );

  if (
    result.rows[0]?.[
      "released"
    ] !== true
  ) {
    throw new Error(
      "Gate 13 operator ownership lock was not held by this database session during release."
    );
  }
}
