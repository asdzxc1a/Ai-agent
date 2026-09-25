import {
  expect,
  test
} from "vitest";

import {
  auditNoShellCommandEvents
} from "../src/codex-browser-worker.js";

test(
  "Codex worker audit accepts MCP-only event streams with no shell execution",
  () => {
    expect(
      () =>
        auditNoShellCommandEvents(
          [
            JSON.stringify({
              type:
                "thread.started"
            }),
            JSON.stringify({
              type:
                "item.completed",
              item: {
                type:
                  "mcp_tool_call",
                name:
                  "astra_browser.browser_observe"
              }
            }),
            JSON.stringify({
              type:
                "turn.completed",
              usage: {
                input_tokens:
                  100,
                output_tokens:
                  20
              }
            })
          ].join(
            "\n"
          )
        )
    ).not.toThrow();
  }
);

test(
  "Codex worker audit rejects any shell command event even if BrowserSkill appears in the command",
  () => {
    expect(
      () =>
        auditNoShellCommandEvents(
          JSON.stringify({
            type:
              "item.completed",
            item: {
              type:
                "command_execution",
              command:
                "bsk observe --session s1"
            }
          })
        )
    ).toThrow(
      "forbidden shell command events"
    );
  }
);
