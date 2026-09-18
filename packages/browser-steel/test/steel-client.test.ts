import { afterEach, describe, expect, it, vi } from "vitest";

import { SteelClient } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SteelClient", () => {
  it("normalizes a trailing slash in the base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new SteelClient({
      baseUrl: "http://steel.test/"
    });

    await client.listSessions();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://steel.test/v1/sessions",
      undefined
    );
  });

  it("surfaces the response body when Steel returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("launch failed", {
          status: 500
        })
      )
    );

    const client = new SteelClient({
      baseUrl: "http://steel.test"
    });

    await expect(client.createSession()).rejects.toThrow(
      "Steel request POST /v1/sessions failed with HTTP 500: launch failed"
    );
  });
});
