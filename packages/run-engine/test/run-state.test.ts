import {
  expect,
  test
} from "vitest";

import type {
  RunSnapshot
} from "@astra/contracts";

import {
  applyRunUpdate,
  validateRunSnapshot
} from "../src/index.js";

function runningRun():
  RunSnapshot {
  const now =
    new Date().toISOString();

  return {
    id:
      "00000000-0000-4000-8000-000000000001",
    status: "RUNNING",
    goalState:
      "IN_PROGRESS",
    createdAt: now,
    updatedAt: now
  };
}

test(
  "verified completion requires matching durable goal/result/reason truth",
  () => {
    const current =
      runningRun();

    const completed =
      applyRunUpdate(
        current,
        {
          status:
            "COMPLETED",
          goalState:
            "COMPLETED",
          terminalReason: {
            code:
              "GOAL_VERIFIED",
            message:
              "verified"
          },
          result: {
            ok: true
          }
        },
        current.updatedAt
      );

    expect(
      completed
    ).toMatchObject({
      status: "COMPLETED",
      goalState:
        "COMPLETED",
      terminalReason: {
        code:
          "GOAL_VERIFIED"
      }
    });
  }
);

test(
  "terminal state rejects contradictory completion claims",
  () => {
    const current =
      runningRun();

    expect(() => {
      applyRunUpdate(
        current,
        {
          status:
            "COMPLETED",
          goalState:
            "COMPLETED",
          terminalReason: {
            code:
              "COMPLETION_REJECTED",
            message:
              "not verified"
          },
          result: {
            ok: true
          }
        }
      );
    }).toThrow(
      /GOAL_VERIFIED/
    );
  }
);

test(
  "terminal run cannot transition again",
  () => {
    const current =
      applyRunUpdate(
        runningRun(),
        {
          status: "FAILED",
          goalState:
            "BLOCKED",
          terminalReason: {
            code:
              "STEP_LIMIT_EXCEEDED",
            message:
              "bounded"
          },
          error: {
            code:
              "STEP_LIMIT_EXCEEDED",
            message:
              "bounded"
          }
        }
      );

    expect(() => {
      applyRunUpdate(
        current,
        {
          status:
            "COMPLETED",
          goalState:
            "COMPLETED",
          terminalReason: {
            code:
              "GOAL_VERIFIED",
            message:
              "late"
          },
          result: {
            ok: true
          }
        }
      );
    }).toThrow(
      /already terminal/
    );
  }
);

test(
  "cancelled durable state requires matching cancellation reason and error",
  () => {
    const snapshot:
      RunSnapshot = {
        ...runningRun(),
        status:
          "CANCELLED",
        goalState:
          "BLOCKED",
        terminalReason: {
          code: "CANCELLED",
          message:
            "cancelled"
        },
        error: {
          code: "CANCELLED",
          message:
            "cancelled"
        }
      };

    expect(() => {
      validateRunSnapshot(
        snapshot
      );
    }).not.toThrow();

    expect(() => {
      validateRunSnapshot({
        ...snapshot,
        error: {
          code:
            "EXECUTION_FAILED",
          message:
            "wrong"
        }
      });
    }).toThrow(
      /matching CANCELLED/
    );
  }
);
