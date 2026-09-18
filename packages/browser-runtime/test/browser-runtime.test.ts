import { describe, expect, it } from "vitest";

import { FakeBrowserRuntime, FakeBrowserSession } from "./fakes.js";

describe("BrowserRuntime contract fakes", () => {
  it("records session creation through the owned runtime contract", async () => {
    const runtime = new FakeBrowserRuntime();

    const session = await runtime.createSession({
      headless: true,
      viewport: {
        width: 1280,
        height: 800
      }
    });

    expect(session.id).toBe("browser-session-1");
    expect(session.cdpUrl).toContain("/1");
    expect(runtime.createOptions).toEqual([
      {
        headless: true,
        viewport: {
          width: 1280,
          height: 800
        }
      }
    ]);
  });

  it("supports explicit session cleanup", async () => {
    const session = new FakeBrowserSession();

    await session.close();

    expect(session.closeCalls).toBe(1);
  });
});
