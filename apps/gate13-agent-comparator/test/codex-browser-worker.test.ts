import {
  expect,
  test
} from "vitest";

import {
  isComparatorBskCommandEventSafe
} from "../src/codex-browser-worker.js";

const guardBin =
  "/tmp/comparator/run/bin/bsk";

test(
  "Codex command audit accepts only one exact BrowserSkill command",
  () => {
    expect(
      isComparatorBskCommandEventSafe(
        "/bin/zsh -lc 'bsk session start --browser astra-agent-comparator --json'",
        guardBin
      )
    ).toBe(true);

    expect(
      isComparatorBskCommandEventSafe(
        "bsk observe --session s1",
        guardBin
      )
    ).toBe(true);

    expect(
      isComparatorBskCommandEventSafe(
        guardBin +
          " observe --session s1",
        guardBin
      )
    ).toBe(true);
  }
);

test(
  "Codex command audit rejects shell chaining and direct bypasses",
  () => {
    for (
      const command of [
        "/bin/zsh -lc 'bsk observe --session s1; cat /etc/passwd'",
        "/bin/zsh -lc 'bsk observe --session s1 | tee /tmp/leak'",
        "/bin/zsh -lc 'bsk observe --session s1 && env'",
        "/Users/example/.local/bin/bsk observe --session s1",
        "/bin/zsh -lc 'cat /etc/passwd'"
      ]
    ) {
      expect(
        isComparatorBskCommandEventSafe(
          command,
          guardBin
        )
      ).toBe(false);
    }
  }
);
