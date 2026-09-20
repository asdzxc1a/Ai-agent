import {
  afterEach,
  expect,
  test,
  vi
} from "vitest";

import {
  SteelBrowserIsolationError,
  SteelBrowserRuntime
} from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("self-hosted Steel endpoint rejects concurrent sessions and unlocks after release", async () => {
  let createCount = 0;

  const fetchMock =
    vi.fn<typeof fetch>(
      async (
        input,
        init
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method =
          init?.method ?? "GET";

        if (
          url.endsWith(
            "/v1/sessions"
          ) &&
          method === "POST"
        ) {
          createCount += 1;
          const id =
            "session-" +
            String(createCount);

          return new Response(
            JSON.stringify({
              id,
              status: "live",
              websocketUrl:
                "ws://steel.test/" +
                id
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          );
        }

        const sessionMatch =
          url.match(
            /\/v1\/sessions\/(session-\d+)$/
          );

        if (
          sessionMatch?.[1] !==
            undefined &&
          method === "GET"
        ) {
          return new Response(
            JSON.stringify({
              id:
                sessionMatch[1],
              status: "live",
              websocketUrl:
                "ws://steel.test/" +
                sessionMatch[1]
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          );
        }

        const releaseMatch =
          url.match(
            /\/v1\/sessions\/(session-\d+)\/release$/
          );

        if (
          releaseMatch?.[1] !==
            undefined &&
          method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              id:
                releaseMatch[1],
              status:
                "released",
              websocketUrl:
                "ws://steel.test/" +
                releaseMatch[1],
              success: true
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          );
        }

        throw new Error(
          "Unexpected Steel fixture request: " +
            method +
            " " +
            url
        );
      }
    );

  vi.stubGlobal(
    "fetch",
    fetchMock
  );

  const firstRuntime =
    new SteelBrowserRuntime({
      baseUrl:
        "http://steel-lock.test:4567"
    });
  const secondRuntime =
    new SteelBrowserRuntime({
      baseUrl:
        "http://steel-lock.test:4567/"
    });

  const first =
    await firstRuntime
      .createSession();

  await expect(
    secondRuntime.createSession()
  ).rejects.toBeInstanceOf(
    SteelBrowserIsolationError
  );

  expect(createCount).toBe(1);

  await first.close();

  const second =
    await secondRuntime
      .createSession();

  expect(createCount).toBe(2);

  await second.close();
});
