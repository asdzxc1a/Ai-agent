import { describe, expect, it } from "vitest";

import type { BrowserSession } from "../../browser-runtime/src/index.js";
import { FakeAgentRuntime } from "./fakes.js";

function fakeBrowserSession(): BrowserSession {
  return {
    id: "browser-session-1",
    cdpUrl: "ws://browser.test/devtools/browser/1",
    async close() {}
  };
}

describe("AgentRuntime contract fakes", () => {
  it("opens an agent session against our BrowserSession contract", async () => {
    const browser = fakeBrowserSession();
    const runtime = new FakeAgentRuntime();

    const session = await runtime.openSession({ browser });
    await session.navigate("https://fixture.test");

    const actions = await session.observe("find the button");
    const result = await session.act(actions[0]!);

    expect(result.success).toBe(true);
    expect(runtime.openOptions[0]?.browser).toBe(browser);
  });

  it("validates extracted values through the owned RuntimeSchema contract", async () => {
    const runtime = new FakeAgentRuntime();
    const session = await runtime.openSession({
      browser: fakeBrowserSession()
    });

    runtime.sessions[0]!.extractionValue = {
      count: 1
    };

    const extracted = await session.extract("extract count", {
      parse(input: unknown) {
        if (
          typeof input !== "object" ||
          input === null ||
          !("count" in input) ||
          (input as { count?: unknown }).count !== 1
        ) {
          throw new Error("invalid fixture extraction");
        }

        return { count: 1 };
      }
    });

    expect(extracted).toEqual({ count: 1 });
  });
});
