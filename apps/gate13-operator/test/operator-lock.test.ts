import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  GATE13_RUN_OWNER_LOCK_KEY,
  acquireGate13RunOwnership,
  releaseGate13RunOwnership,
  type Gate13AdvisoryLockQuery
} from "../src/operator-lock.js";

describe(
  "Gate 13 cross-process run ownership",
  () => {
    it(
      "acquires and releases one database-scoped advisory lock",
      async () => {
        const query =
          vi.fn<
            Gate13AdvisoryLockQuery
          >()
            .mockResolvedValueOnce({
              rows: [
                {
                  acquired:
                    true
                }
              ]
            })
            .mockResolvedValueOnce({
              rows: [
                {
                  released:
                    true
                }
              ]
            });

        await expect(
          acquireGate13RunOwnership(
            query
          )
        ).resolves.toBeUndefined();

        await expect(
          releaseGate13RunOwnership(
            query
          )
        ).resolves.toBeUndefined();

        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          "SELECT pg_try_advisory_lock($1) AS acquired",
          [
            GATE13_RUN_OWNER_LOCK_KEY
          ]
        );
        expect(
          query
        ).toHaveBeenNthCalledWith(
          2,
          "SELECT pg_advisory_unlock($1) AS released",
          [
            GATE13_RUN_OWNER_LOCK_KEY
          ]
        );
      }
    );

    it(
      "fails closed when another operator process already owns live research",
      async () => {
        const query:
          Gate13AdvisoryLockQuery =
          async () => ({
            rows: [
              {
                acquired:
                  false
              }
            ]
          });

        await expect(
          acquireGate13RunOwnership(
            query
          )
        ).rejects.toThrow(
          "already has an active operator owner"
        );
      }
    );

    it(
      "fails closed when the owning database session cannot release its lock",
      async () => {
        const query:
          Gate13AdvisoryLockQuery =
          async () => ({
            rows: [
              {
                released:
                  false
              }
            ]
          });

        await expect(
          releaseGate13RunOwnership(
            query
          )
        ).rejects.toThrow(
          "ownership lock was not held"
        );
      }
    );
  }
);
