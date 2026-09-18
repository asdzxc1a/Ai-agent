import { describe, expect, it } from "vitest";

import {
  RUN_STATUSES,
  isRunStatus
} from "../src/index.js";

describe("run status contract", () => {
  it("accepts every declared run status", () => {
    for (const status of RUN_STATUSES) {
      expect(isRunStatus(status)).toBe(true);
    }
  });

  it("rejects invalid values", () => {
    expect(isRunStatus("PAUSED")).toBe(false);
    expect(isRunStatus("running")).toBe(false);
    expect(isRunStatus(42)).toBe(false);
    expect(isRunStatus(null)).toBe(false);
  });
});
