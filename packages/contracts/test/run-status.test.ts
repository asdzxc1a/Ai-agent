import {
  describe,
  expect,
  it
} from "vitest";

import {
  ACTION_EFFECT_STATES,
  GOAL_STATES,
  RUN_STATUSES,
  isActionEffectState,
  isGoalState,
  isRunStatus
} from "../src/index.js";

describe(
  "run status contract",
  () => {
    it("accepts every declared run status", () => {
      for (
        const status of
        RUN_STATUSES
      ) {
        expect(
          isRunStatus(status)
        ).toBe(true);
      }
    });

    it("rejects invalid run statuses", () => {
      expect(
        isRunStatus("PAUSED")
      ).toBe(false);
      expect(
        isRunStatus("running")
      ).toBe(false);
      expect(
        isRunStatus(42)
      ).toBe(false);
      expect(
        isRunStatus(null)
      ).toBe(false);
    });
  }
);

describe(
  "Gate 10 goal/effect contracts",
  () => {
    it("accepts only declared goal states", () => {
      for (
        const state of
        GOAL_STATES
      ) {
        expect(
          isGoalState(state)
        ).toBe(true);
      }

      expect(
        isGoalState("CANCELLED")
      ).toBe(false);
    });

    it("accepts only declared action effects", () => {
      for (
        const effect of
        ACTION_EFFECT_STATES
      ) {
        expect(
          isActionEffectState(
            effect
          )
        ).toBe(true);
      }

      expect(
        isActionEffectState(
          "maybe"
        )
      ).toBe(false);
    });
  }
);
