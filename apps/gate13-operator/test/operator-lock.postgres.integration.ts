import {
  afterAll,
  expect,
  test
} from "vitest";

import {
  createProspectPostgresPool
} from "@astra/prospect-postgres";

import {
  acquireGate13RunOwnership,
  releaseGate13RunOwnership,
  type Gate13AdvisoryLockQuery
} from "../src/operator-lock.js";

const connectionString =
  process.env.TEST_DATABASE_URL;

if (
  connectionString === undefined
) {
  throw new Error(
    "TEST_DATABASE_URL is required."
  );
}

const pool =
  createProspectPostgresPool({
    connectionString,
    max: 2
  });

afterAll(async () => {
  await pool.end();
});

test(
  "Gate 13 run ownership is exclusive across PostgreSQL sessions and becomes available after release",
  async () => {
    const first =
      await pool.connect();
    const second =
      await pool.connect();

    const queryFor =
      (
        client:
          typeof first
      ):
        Gate13AdvisoryLockQuery =>
        (
          sql,
          values
        ) =>
          client.query(
            sql,
            [
              ...values
            ]
          );

    const firstQuery =
      queryFor(first);
    const secondQuery =
      queryFor(second);

    try {
      await expect(
        acquireGate13RunOwnership(
          firstQuery
        )
      ).resolves.toBeUndefined();

      await expect(
        acquireGate13RunOwnership(
          secondQuery
        )
      ).rejects.toThrow(
        "already has an active operator owner"
      );

      await expect(
        releaseGate13RunOwnership(
          firstQuery
        )
      ).resolves.toBeUndefined();

      await expect(
        acquireGate13RunOwnership(
          secondQuery
        )
      ).resolves.toBeUndefined();

      await expect(
        releaseGate13RunOwnership(
          secondQuery
        )
      ).resolves.toBeUndefined();
    } finally {
      first.release();
      second.release();
    }
  }
);
