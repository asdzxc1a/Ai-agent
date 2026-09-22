import {
  createServer,
  request,
  type Server
} from "node:http";
import {
  type AddressInfo
} from "node:net";

import {
  expect,
  test
} from "vitest";

import {
  ConnectionBoundEgressProxy,
  DefaultSandboxNetworkPolicy
} from "../src/index.js";

async function listen(
  server: Server
): Promise<number> {
  await new Promise<void>(
    (resolve, reject) => {
      server.once(
        "error",
        reject
      );
      server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );

  const address =
    server.address();

  if (
    address === null ||
    typeof address ===
      "string"
  ) {
    throw new Error(
      "Fixture did not bind a TCP port."
    );
  }

  return (
    address as
      AddressInfo
  ).port;
}

async function closeServer(
  server: Server
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      server.close(
        () => resolve()
      );
    }
  );
}

test(
  "connection-bound proxy enforces policy and dials through the approved route",
  async () => {
    let reached = 0;
    const fixture =
      createServer(
        (_request, response) => {
          reached += 1;
          response.end(
            "fixture-ok"
          );
        }
      );
    const fixturePort =
      await listen(
        fixture
      );
    const policy =
      new DefaultSandboxNetworkPolicy({
        trustedHostnames: [
          "fixture.test"
        ]
      });
    const proxy =
      await ConnectionBoundEgressProxy
        .start(
          policy,
          {
            browserHostname:
              "127.0.0.1",
            listenHostname:
              "127.0.0.1",
            trustedConnectionOverrides: {
              "fixture.test":
                "127.0.0.1"
            }
          }
        );
    const proxyUrl =
      new URL(
        proxy.proxyUrl
      );

    try {
      const body =
        await new Promise<string>(
          (resolve, reject) => {
            const outbound =
              request({
                host:
                  proxyUrl.hostname,
                port:
                  Number(
                    proxyUrl.port
                  ),
                method:
                  "GET",
                path:
                  "http://fixture.test:" +
                  String(
                    fixturePort
                  ) +
                  "/through-proxy",
                headers: {
                  host:
                    "fixture.test:" +
                    String(
                      fixturePort
                    )
                }
              });
            let data = "";

            outbound.on(
              "response",
              (response) => {
                response.setEncoding(
                  "utf8"
                );
                response.on(
                  "data",
                  (chunk) => {
                    data +=
                      String(
                        chunk
                      );
                  }
                );
                response.on(
                  "end",
                  () =>
                    resolve(
                      data
                    )
                );
              }
            );
            outbound.on(
              "error",
              reject
            );
            outbound.end();
          }
        );

      expect(body).toBe(
        "fixture-ok"
      );
      expect(reached).toBe(1);

      const blockedStatus =
        await new Promise<number>(
          (resolve, reject) => {
            const outbound =
              request({
                host:
                  proxyUrl.hostname,
                port:
                  Number(
                    proxyUrl.port
                  ),
                method:
                  "GET",
                path:
                  "http://blocked.test/"
              });
            outbound.on(
              "response",
              (response) => {
                response.resume();
                response.on(
                  "end",
                  () =>
                    resolve(
                      response
                        .statusCode ??
                        0
                    )
                );
              }
            );
            outbound.on(
              "error",
              reject
            );
            outbound.end();
          }
        );

      expect(
        blockedStatus
      ).toBe(403);
      expect(reached).toBe(1);
    } finally {
      await proxy.close();
      await closeServer(
        fixture
      );
    }
  }
);
