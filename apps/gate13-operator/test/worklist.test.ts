import {
  describe,
  expect,
  test
} from "vitest";

import {
  buildGate13AcceptanceWorkItem,
  summarizeGate13AcceptanceWorklist,
  type Gate13AcceptanceWorklistInput
} from "../src/worklist.js";

function input(
  patch:
    Partial<
      Gate13AcceptanceWorklistInput
    > = {}
): Gate13AcceptanceWorklistInput {
  return {
    targetId:
      "target.01",
    companyName:
      "Example Logistics",
    baseline: null,
    reservation: null,
    reservedRun: null,
    attempts: [],
    outcome: null,
    ...patch
  };
}

const baseline = {
  id:
    "baseline.01"
};

const reservation = {
  runId:
    "run.acceptance.01",
  reservedAt:
    "2026-09-23T10:00:00.000Z"
};

describe(
  "Gate 13 acceptance worklist",
  () => {
    test(
      "derives the exact legal next transition across the acceptance lifecycle",
      () => {
        expect(
          buildGate13AcceptanceWorkItem(
            input()
          ).nextTransition
        ).toBe(
          "RECORD_MEASURED_HUMAN_BASELINE"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline
            })
          ).nextTransition
        ).toBe(
          "RUN_TARGET"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation
            })
          ).nextTransition
        ).toBe(
          "RELEASE_ORPHAN_ATTEMPT_RESERVATION"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "RUNNING"
              }
            })
          ).nextTransition
        ).toBe(
          "WAIT_FOR_TERMINAL_RUN"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "COMPLETED"
              }
            })
          ).nextTransition
        ).toBe(
          "REVIEW_COMPLETED_RUN"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "FAILED"
              }
            })
          ).nextTransition
        ).toBe(
          "RECORD_FAILED_ATTEMPT"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "COMPLETED"
              },
              attempts: [
                {
                  id:
                    "attempt.01",
                  status:
                    "COMPLETED",
                  runId:
                    reservation.runId
                }
              ]
            })
          ).nextTransition
        ).toBe(
          "RECORD_OUTCOME"
        );

        expect(
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "COMPLETED"
              },
              attempts: [
                {
                  id:
                    "attempt.01",
                  status:
                    "COMPLETED",
                  runId:
                    reservation.runId
                }
              ],
              outcome: {
                id:
                  "outcome.01",
                attemptId:
                  "attempt.01"
              }
            })
          ).nextTransition
        ).toBe(
          "COMPLETE"
        );
      }
    );

    test(
      "matches the persisted attempt to the reserved run instead of unrelated target history",
      () => {
        const item =
          buildGate13AcceptanceWorkItem(
            input({
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "COMPLETED"
              },
              attempts: [
                {
                  id:
                    "attempt.calibration",
                  status:
                    "COMPLETED",
                  runId:
                    "run.calibration"
                },
                {
                  id:
                    "attempt.acceptance",
                  status:
                    "COMPLETED",
                  runId:
                    reservation.runId
                }
              ]
            })
          );

        expect(
          item.attemptId
        ).toBe(
          "attempt.acceptance"
        );
        expect(
          item.nextTransition
        ).toBe(
          "RECORD_OUTCOME"
        );
      }
    );

    test(
      "fails closed on contradictory measured-attempt state",
      () => {
        expect(
          () =>
            buildGate13AcceptanceWorkItem(
              input({
                reservation
              })
            )
        ).toThrow(
          "reservation exists before the durable human baseline"
        );

        expect(
          () =>
            buildGate13AcceptanceWorkItem(
              input({
                baseline,
                reservation,
                reservedRun: {
                  id:
                    reservation.runId,
                  status:
                    "COMPLETED"
                },
                attempts: [
                  {
                    id:
                      "attempt.01",
                    status:
                      "COMPLETED",
                    runId:
                      reservation.runId
                  },
                  {
                    id:
                      "attempt.02",
                    status:
                      "FAILED",
                    runId:
                      reservation.runId
                  }
                ]
              })
            )
        ).toThrow(
          "more than one persisted attempt"
        );

        expect(
          () =>
            buildGate13AcceptanceWorkItem(
              input({
                baseline,
                reservation,
                reservedRun: {
                  id:
                    reservation.runId,
                  status:
                    "COMPLETED"
                },
                attempts: [
                  {
                    id:
                      "attempt.01",
                    status:
                      "COMPLETED",
                    runId:
                      reservation.runId
                  }
                ],
                outcome: {
                  id:
                    "outcome.01",
                  attemptId:
                    "attempt.other"
                }
              })
            )
        ).toThrow(
          "reviewed outcome references a different attempt"
        );
      }
    );

    test(
      "summarizes all transitions without hiding incomplete targets",
      () => {
        const items = [
          buildGate13AcceptanceWorkItem(
            input()
          ),
          buildGate13AcceptanceWorkItem(
            input({
              targetId:
                "target.02",
              baseline
            })
          ),
          buildGate13AcceptanceWorkItem(
            input({
              targetId:
                "target.03",
              baseline,
              reservation,
              reservedRun: {
                id:
                  reservation.runId,
                status:
                  "COMPLETED"
              },
              attempts: [
                {
                  id:
                    "attempt.03",
                  status:
                    "COMPLETED",
                  runId:
                    reservation.runId
                }
              ],
              outcome: {
                id:
                  "outcome.03",
                attemptId:
                  "attempt.03"
              }
            })
          )
        ];

        const summary =
          summarizeGate13AcceptanceWorklist(
            items
          );

        expect(summary).toMatchObject({
          targetCount: 3,
          completeCount: 1,
          pendingCount: 2
        });
        expect(
          summary
            .countsByTransition
            .RECORD_MEASURED_HUMAN_BASELINE
        ).toBe(1);
        expect(
          summary
            .countsByTransition
            .RUN_TARGET
        ).toBe(1);
        expect(
          summary
            .countsByTransition
            .COMPLETE
        ).toBe(1);
      }
    );
  }
);
