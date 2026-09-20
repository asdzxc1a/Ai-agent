import { afterEach, describe, expect, it, vi } from "vitest";

import { SteelClient } from "../src/index.js";

describe("SteelClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a session through the documented REST endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "e0ab01d9-6643-4d68-a88b-ea75ad1f2ee4",
          status: "live",
          websocketUrl: "ws://localhost:3000/"
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

    const client = new SteelClient("http://localhost:3000/");
    const controller =
      new AbortController();
    const session = await client.createSession({
      headless: true,
      signal: controller.signal
    });

    expect(session.status).toBe("live");
    expect(session.websocketUrl).toBe("ws://localhost:3000/");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/sessions",
      expect.objectContaining({
        method: "POST",
        signal:
          controller.signal
      })
    );
  });

  it("rejects malformed session responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: "live" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    const client = new SteelClient();

    await expect(client.createSession()).rejects.toThrow(
      "Steel returned an invalid session response."
    );
  });
});
