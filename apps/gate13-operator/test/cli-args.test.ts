import {
  expect,
  test
} from "vitest";

import {
  normalizeGate13CliArgs
} from "../src/cli-args.js";

test(
  "Gate 13 CLI accepts pnpm option separators",
  () => {
    expect(
      normalizeGate13CliArgs([
        "--",
        "preview",
        "--sample-id",
        "sample-1"
      ])
    ).toEqual([
      "preview",
      "--sample-id",
      "sample-1"
    ]);
  }
);

test(
  "Gate 13 CLI preserves direct arguments",
  () => {
    expect(
      normalizeGate13CliArgs([
        "preview"
      ])
    ).toEqual([
      "preview"
    ]);
  }
);
