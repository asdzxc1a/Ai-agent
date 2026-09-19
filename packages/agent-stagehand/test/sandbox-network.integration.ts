import {
  execFile
} from "node:child_process";
import {
  createServer,
  type Server
} from "node:http";
import type {
  AddressInfo
} from "node:net";
import {
  promisify
} from "node:util";

import { z } from "zod";
import {
  expect,
  test
} from "vitest";

import type {
  AgentRuntime,
  AgentSession
} from "@astra/agent-runtime";
import type {
  BrowserSession
} from "@astra/browser-runtime";
import {
  SteelBrowserIsolationError,
  SteelBrowserRuntime,
  SteelClient
} from "@astra/browser-steel";
import {
  LocalSandboxRuntime,
  SandboxedBrowserRuntime,
  SandboxNetworkPolicyError
} from "@astra/sandbox-runtime";

import {
  createStagehandAgentRuntimeForTesting
} from "../src/testing.js";
import {
  SandboxFixtureLLMClient
} from "./sandbox-fixture-llm.js";

const steelBaseUrl =
  process.env.STEEL_BASE_URL ??
  "http://127.0.0.1:3000";
const steelSecondaryBaseUrl =
  process.env.STEEL_SECONDARY_BASE_URL ??
  "http://127.0.0.1:3001";

const steelPrimaryContainer =
  process.env
    .STEEL_PRIMARY_CONTAINER ??
  "astra-steel-stagehand";
const steelSecondaryContainer =
  process.env
    .STEEL_SECONDARY_CONTAINER ??
  "astra-steel-stagehand-secondary";
const execFileAsync =
  promisify(execFile);

async function docker(
  ...args: string[]
) {
  return execFileAsync(
    "docker",
    args,
    {
      encoding: "utf8"
    }
  );
}

async function dockerSucceeds(
  ...args: string[]
): Promise<boolean> {
  try {
    await docker(...args);
    return true;
  } catch {
    return false;
  }
}

const stateSchema =
  z.object({
    cookie:
      z.enum([
        "set",
        "missing"
      ]),
    storage:
      z.enum([
        "set",
        "missing"
      ])
  });

function stateHtml(
  shouldSet: boolean
): string {
  const setScript =
    shouldSet
      ? [
          'document.cookie = "sandbox_cookie=set; path=/";',
          'localStorage.setItem("sandbox_storage", "set");'
        ].join("\n")
      : "";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>Sandbox isolation fixture</title>",
    "</head>",
    "<body>",
    '<p id="sandbox-state">SANDBOX_STATE cookie=missing storage=missing</p>',
    "<script>",
    setScript,
    'const cookieState = document.cookie.includes("sandbox_cookie=set") ? "set" : "missing";',
    'const storageState = localStorage.getItem("sandbox_storage") === "set" ? "set" : "missing";',
    'document.getElementById("sandbox-state").textContent = "SANDBOX_STATE cookie=" + cookieState + " storage=" + storageState;',
    "</script>",
    "</body>",
    "</html>"
  ].join("\n");
}

async function startFixture():
  Promise<{
    server: Server;
    browserBaseUrl: string;
    privateRequestCount():
      number;
  }> {
  let privateRequests = 0;

  const server =
    createServer(
      (request, response) => {
        const url =
          new URL(
            request.url ?? "/",
            "http://fixture.local"
          );

        if (
          url.pathname ===
          "/state"
        ) {
          response.writeHead(
            200,
            {
              "content-type":
                "text/html; charset=utf-8",
              "cache-control":
                "no-store"
            }
          );
          response.end(
            stateHtml(
              url.searchParams
                .get("set") ===
                "1"
            )
          );
          return;
        }

        if (
          url.pathname ===
          "/redirect-private"
        ) {
          const port =
            request.headers.host
              ?.split(":")
              .at(-1);

          response.writeHead(
            302,
            {
              location:
                "http://blocked.docker.internal:" +
                String(port) +
                "/private-sentinel"
            }
          );
          response.end();
          return;
        }

        if (
          url.pathname ===
          "/private-sentinel"
        ) {
          privateRequests += 1;
          response.writeHead(
            200,
            {
              "content-type":
                "text/plain; charset=utf-8"
            }
          );
          response.end(
            "private target reached"
          );
          return;
        }

        response.writeHead(
          404,
          {
            "content-type":
              "text/plain; charset=utf-8"
          }
        );
        response.end(
          "Not found"
        );
      }
    );

  await new Promise<void>(
    (resolve, reject) => {
      server.once(
        "error",
        reject
      );
      server.listen(
        0,
        "0.0.0.0",
        resolve
      );
    }
  );

  const address =
    server.address();

  if (
    address === null ||
    typeof address === "string"
  ) {
    throw new Error(
      "Sandbox fixture did not bind a TCP port."
    );
  }

  return {
    server,
    browserBaseUrl:
      "http://host.docker.internal:" +
      String(
        (
          address as
            AddressInfo
        ).port
      ),
    privateRequestCount() {
      return privateRequests;
    }
  };
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

function browserRuntime(
  baseUrl = steelBaseUrl
) {
  return new SandboxedBrowserRuntime({
    sandboxRuntime:
      new LocalSandboxRuntime({
        trustedHostnames: [
          "host.docker.internal"
        ]
      }),
    browserRuntime:
      new SteelBrowserRuntime({
        baseUrl,
        skipFingerprintInjection:
          true
      })
  });
}

function agentRuntime():
  AgentRuntime {
  return createStagehandAgentRuntimeForTesting(
    () =>
      new SandboxFixtureLLMClient()
  );
}

async function extractState(
  agent: AgentSession
) {
  return agent.extract(
    "Extract the visible SANDBOX_STATE cookie and storage values.",
    stateSchema
  );
}

async function closePair(
  agent:
    AgentSession | undefined,
  browser:
    BrowserSession | undefined
): Promise<void> {
  if (agent !== undefined) {
    await agent.close().catch(
      () => undefined
    );
  }

  if (browser !== undefined) {
    await browser.close().catch(
      () => undefined
    );
  }
}

test(
  "sandboxed Stagehand allows a trusted fixture and blocks private/network escape targets",
  async () => {
    const {
      server,
      browserBaseUrl,
      privateRequestCount
    } = await startFixture();
    const runtime =
      browserRuntime();
    const agentRuntimeInstance =
      agentRuntime();
    const steelClient =
      new SteelClient(
        steelBaseUrl
      );

    let browser:
      BrowserSession | undefined;
    let agent:
      AgentSession | undefined;

    try {
      browser =
        await runtime.createSession({
          headless: true
        });
      expect(
        browser.isolationId
      ).toBeTypeOf(
        "string"
      );

      agent =
        await agentRuntimeInstance
          .openSession({
            browser
          });

      await agent.navigate(
        browserBaseUrl +
          "/state?set=1"
      );

      await expect(
        extractState(agent)
      ).resolves.toEqual({
        cookie: "set",
        storage: "set"
      });

      await expect(
        agent.navigate(
          "file:///proc/self/environ"
        )
      ).rejects.toBeInstanceOf(
        SandboxNetworkPolicyError
      );

      await expect(
        agent.navigate(
          "http://127.0.0.1:4173/"
        )
      ).rejects.toBeInstanceOf(
        SandboxNetworkPolicyError
      );

      await expect(
        agent.navigate(
          "http://169.254.169.254/latest/meta-data/"
        )
      ).rejects.toBeInstanceOf(
        SandboxNetworkPolicyError
      );

      await expect(
        agent.navigate(
          "http://blocked.docker.internal:" +
            new URL(
              browserBaseUrl
            ).port +
            "/private-sentinel"
        )
      ).rejects.toBeInstanceOf(
        SandboxNetworkPolicyError
      );

      await agent.navigate(
        browserBaseUrl +
          "/redirect-private"
      ).catch(
        () => undefined
      );

      expect(
        privateRequestCount()
      ).toBe(0);

      const browserId =
        browser.id;

      await agent.close();
      agent = undefined;
      await browser.close();
      browser = undefined;

      const details =
        await steelClient
          .getSession(
            browserId
          );
      expect(
        details.status
      ).toBe("released");
    } finally {
      await closePair(
        agent,
        browser
      );
      await closeServer(
        server
      );
    }
  },
  300_000
);

test(
  "sandboxed Steel sessions do not retain cookies or localStorage across isolation boundaries",
  async () => {
    const {
      server,
      browserBaseUrl
    } = await startFixture();
    const primaryRuntime =
      browserRuntime(
        steelBaseUrl
      );
    const secondaryRuntime =
      browserRuntime(
        steelSecondaryBaseUrl
      );
    const agentRuntimeInstance =
      agentRuntime();
    const primarySteelClient =
      new SteelClient(
        steelBaseUrl
      );
    const secondarySteelClient =
      new SteelClient(
        steelSecondaryBaseUrl
      );

    let firstBrowser:
      BrowserSession | undefined;
    let firstAgent:
      AgentSession | undefined;
    let secondBrowser:
      BrowserSession | undefined;
    let secondAgent:
      AgentSession | undefined;
    let thirdBrowser:
      BrowserSession | undefined;
    let thirdAgent:
      AgentSession | undefined;

    try {
      firstBrowser =
        await primaryRuntime
          .createSession({
            headless: true
          });
      firstAgent =
        await agentRuntimeInstance
          .openSession({
            browser:
              firstBrowser
          });

      await firstAgent.navigate(
        browserBaseUrl +
          "/state?set=1"
      );
      expect(
        await extractState(
          firstAgent
        )
      ).toEqual({
        cookie: "set",
        storage: "set"
      });

      const firstBrowserId =
        firstBrowser.id;
      const firstIsolationId =
        firstBrowser.isolationId;

      await expect(
        primaryRuntime
          .createSession({
            headless: true
          })
      ).rejects.toBeInstanceOf(
        SteelBrowserIsolationError
      );

      secondBrowser =
        await secondaryRuntime
          .createSession({
            headless: true
          });

      expect(
        secondBrowser.id
      ).not.toBe(
        firstBrowserId
      );
      expect(
        secondBrowser
          .isolationId
      ).not.toBe(
        firstIsolationId
      );

      secondAgent =
        await agentRuntimeInstance
          .openSession({
            browser:
              secondBrowser
          });

      await secondAgent.navigate(
        browserBaseUrl +
          "/state"
      );
      expect(
        await extractState(
          secondAgent
        )
      ).toEqual({
        cookie: "missing",
        storage: "missing"
      });

      const secondBrowserId =
        secondBrowser.id;

      expect(
        (
          await primarySteelClient
            .getSession(
              firstBrowserId
            )
        ).status
      ).not.toBe("released");
      expect(
        (
          await secondarySteelClient
            .getSession(
              secondBrowserId
            )
        ).status
      ).not.toBe("released");

      await firstAgent.close();
      firstAgent = undefined;
      await firstBrowser.close();
      firstBrowser = undefined;

      expect(
        (
          await primarySteelClient
            .getSession(
              firstBrowserId
            )
        ).status
      ).toBe("released");
      expect(
        (
          await secondarySteelClient
            .getSession(
              secondBrowserId
            )
        ).status
      ).not.toBe("released");

      thirdBrowser =
        await primaryRuntime
          .createSession({
            headless: true
          });
      thirdAgent =
        await agentRuntimeInstance
          .openSession({
            browser:
              thirdBrowser
          });

      await thirdAgent.navigate(
        browserBaseUrl +
          "/state"
      );
      expect(
        await extractState(
          thirdAgent
        )
      ).toEqual({
        cookie: "missing",
        storage: "missing"
      });

      const thirdBrowserId =
        thirdBrowser.id;

      await thirdAgent.close();
      thirdAgent = undefined;
      await thirdBrowser.close();
      thirdBrowser = undefined;

      expect(
        (
          await primarySteelClient
            .getSession(
              thirdBrowserId
            )
        ).status
      ).toBe("released");

      await secondAgent.close();
      secondAgent = undefined;
      await secondBrowser.close();
      secondBrowser =
        undefined;

      expect(
        (
          await secondarySteelClient
            .getSession(
              secondBrowserId
            )
        ).status
      ).toBe("released");
    } finally {
      await closePair(
        firstAgent,
        firstBrowser
      );
      await closePair(
        secondAgent,
        secondBrowser
      );
      await closePair(
        thirdAgent,
        thirdBrowser
      );
      await closeServer(
        server
      );
    }
  },
  300_000
);


test(
  "independent Steel sandbox providers isolate filesystem, process, and loopback-port state",
  async () => {
    const markerPath =
      "/tmp/astra-gate12-isolation-" +
      String(process.pid);
    const processMarker =
      "astraIso" +
      String(process.pid % 100_000);
    const port = 49123;

    await docker(
      "exec",
      steelPrimaryContainer,
      "node",
      "-e",
      "require('fs').writeFileSync(" +
        JSON.stringify(markerPath) +
        ",'primary')"
    );

    await expect(
      dockerSucceeds(
        "exec",
        steelSecondaryContainer,
        "node",
        "-e",
        "process.exit(require('fs').existsSync(" +
          JSON.stringify(markerPath) +
          ")?7:0)"
      )
    ).resolves.toBe(true);

    await docker(
      "exec",
      "-d",
      steelPrimaryContainer,
      "node",
      "-e",
      "setInterval(()=>{},1000)",
      processMarker
    );

    const processProbe = [
      "const fs=require('fs');",
      "const marker=" +
        JSON.stringify(processMarker) +
        ";",
      "const found=fs.readdirSync('/proc')",
      ".filter(x=>/^\\d+$/.test(x)&&x!==String(process.pid))",
      ".some(x=>{try{return fs.readFileSync('/proc/'+x+'/cmdline','utf8').includes(marker)}catch{return false}});",
      "process.exit(found?0:7);"
    ].join("");
    let primaryProcessVisible =
      false;

    for (
      let attempt = 0;
      attempt < 40;
      attempt += 1
    ) {
      if (
        await dockerSucceeds(
          "exec",
          steelPrimaryContainer,
          "node",
          "-e",
          processProbe
        )
      ) {
        primaryProcessVisible =
          true;
        break;
      }

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            50
          );
        }
      );
    }

    expect(
      primaryProcessVisible
    ).toBe(true);

    await expect(
      dockerSucceeds(
        "exec",
        steelSecondaryContainer,
        "node",
        "-e",
        processProbe.replace(
          "process.exit(found?0:7);",
          "process.exit(found?7:0);"
        )
      )
    ).resolves.toBe(true);

    await docker(
      "exec",
      "-d",
      steelPrimaryContainer,
      "node",
      "-e",
      "require('http').createServer((_,r)=>r.end('isolated')).listen(" +
        String(port) +
        ",'127.0.0.1');setInterval(()=>{},1000)"
    );

    let primaryReady = false;

    for (
      let attempt = 0;
      attempt < 40;
      attempt += 1
    ) {
      if (
        await dockerSucceeds(
          "exec",
          steelPrimaryContainer,
          "node",
          "-e",
          "fetch('http://127.0.0.1:" +
            String(port) +
            "').then(r=>r.text()).then(v=>process.exit(v==='isolated'?0:7)).catch(()=>process.exit(8))"
        )
      ) {
        primaryReady = true;
        break;
      }

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            100
          );
        }
      );
    }

    expect(primaryReady).toBe(true);

    await expect(
      dockerSucceeds(
        "exec",
        steelSecondaryContainer,
        "node",
        "-e",
        "fetch('http://127.0.0.1:" +
          String(port) +
          "').then(()=>process.exit(7)).catch(()=>process.exit(0))"
      )
    ).resolves.toBe(true);
  },
  30_000
);
