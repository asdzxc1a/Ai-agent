import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  ArtifactStore
} from "@astra/artifact-store";
import type {
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";
import type { RunSnapshot } from "@astra/contracts";

import {
  createApiServer
} from "../src/index.js";
import {
  InMemoryArtifactStore
} from "../../../packages/artifact-store/src/index.js";
import {
  InMemoryRunRepository,
  RunEngine
} from "../../../packages/run-engine/src/index.js";

class FakeBrowserSession implements BrowserSession {
  public readonly id = "browser-1";
  public readonly cdpUrl = "ws://browser.test/1";
  public closeCalls = 0;

  public async captureScreenshot(): Promise<Uint8Array> {
    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeBrowserRuntime implements BrowserRuntime {
  public readonly session = new FakeBrowserSession();

  public async createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    void options;
    return this.session;
  }
}

class FakeAgentSession implements AgentSession {
  public closeCalls = 0;

  public constructor(
    private readonly failAction: boolean,
    private readonly extraction: unknown
  ) {}

  public async navigate(url: string): Promise<void> {
    void url;
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;
    return [
      {
        selector: "xpath=//button",
        description: "Increment count button",
        method: "click",
        arguments: []
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: !this.failAction,
      message: this.failAction
        ? "fixture action failed"
        : "fixture action succeeded",
      actionDescription: action.description,
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse(this.extraction);
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeAgentRuntime implements AgentRuntime {
  public readonly sessions: FakeAgentSession[] = [];

  public constructor(
    private readonly failAction = false,
    private readonly extraction: unknown = {
      count: 1,
      status: "clicked"
    }
  ) {}

  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    const session = new FakeAgentSession(
      this.failAction,
      this.extraction
    );
    this.sessions.push(session);
    return session;
  }
}


class HangingAgentSession
  implements AgentSession {
  public observeStarted = false;
  public closeCalls = 0;

  public async navigate(
    url: string
  ): Promise<void> {
    void url;
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;
    this.observeStarted = true;
    return new Promise<
      AgentAction[]
    >(() => undefined);
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: true,
      message: "unexpected",
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({});
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class HangingAgentRuntime
  implements AgentRuntime {
  public readonly session =
    new HangingAgentSession();

  public async openSession(
    options:
      OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return this.session;
  }
}

const servers: Server[] = [];

async function startServer(
  browserRuntime: BrowserRuntime,
  agentRuntime: AgentRuntime,
  artifactStore?: ArtifactStore
): Promise<string> {
  const runService = new RunEngine({
    repository: new InMemoryRunRepository(),
    browserRuntime,
    agentRuntime,
    completionVerifier: {
      async verify() {
        return { verified: true };
      }
    },
    ...(artifactStore === undefined
      ? {}
      : {
          artifactStore
        })
  });

  const server = createApiServer(runService);
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (
    address === null ||
    typeof address === "string"
  ) {
    throw new Error("API server did not bind a TCP port.");
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function waitForTerminal(
  baseUrl: string,
  runId: string
): Promise<RunSnapshot> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch(
      `${baseUrl}/v1/runs/${runId}`
    );
    const run = await response.json() as RunSnapshot;

    if (
      run.status === "COMPLETED" ||
      run.status === "FAILED"
    ) {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Run did not reach a terminal state.");
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe("first product API", () => {
  it("accepts a run and returns structured completed output", async () => {
    const browserRuntime = new FakeBrowserRuntime();
    const agentRuntime = new FakeAgentRuntime();
    const baseUrl = await startServer(
      browserRuntime,
      agentRuntime
    );

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "Click Increment count and return count/status.",
          outputSchema: {
            type: "object",
            properties: {
              count: {
                type: "number",
                const: 1
              },
              status: {
                type: "string",
                const: "clicked"
              }
            },
            required: ["count", "status"],
            additionalProperties: false
          }
        })
      }
    );

    expect(acceptedResponse.status).toBe(202);

    const accepted = await acceptedResponse.json() as {
      runId: string;
      status: string;
    };

    expect(accepted.status).toBe("PENDING");

    const terminal = await waitForTerminal(
      baseUrl,
      accepted.runId
    );

    expect(terminal.status).toBe("COMPLETED");
    expect(terminal.result).toEqual({
      count: 1,
      status: "clicked"
    });
    expect(browserRuntime.session.closeCalls).toBe(1);
    expect(agentRuntime.sessions[0]?.closeCalls).toBe(1);
  });

  it("returns a typed failed run without crashing the server", async () => {
    const browserRuntime = new FakeBrowserRuntime();
    const agentRuntime = new FakeAgentRuntime(true);
    const baseUrl = await startServer(
      browserRuntime,
      agentRuntime
    );

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "Click the fixture button."
        })
      }
    );

    const accepted = await acceptedResponse.json() as {
      runId: string;
    };

    const terminal = await waitForTerminal(
      baseUrl,
      accepted.runId
    );

    expect(terminal.status).toBe("FAILED");
    expect(terminal.error?.code).toBe("ACTION_FAILED");
    expect(browserRuntime.session.closeCalls).toBe(1);
    expect(agentRuntime.sessions[0]?.closeCalls).toBe(1);
  });

  it("lists and downloads artifacts with typed missing-artifact errors", async () => {
    const artifactStore =
      new InMemoryArtifactStore();
    const baseUrl = await startServer(
      new FakeBrowserRuntime(),
      new FakeAgentRuntime(),
      artifactStore
    );

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "Click the fixture button."
        })
      }
    );

    const accepted = await acceptedResponse.json() as {
      runId: string;
    };

    await waitForTerminal(
      baseUrl,
      accepted.runId
    );

    const listedResponse = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/artifacts`
    );

    expect(listedResponse.status).toBe(200);

    const listed = await listedResponse.json() as {
      artifacts: Array<{
        id: string;
        name: string;
        mediaType: string;
      }>;
    };

    const screenshot = listed.artifacts.find(
      (artifact) =>
        artifact.name === "after-navigation.jpg"
    );

    expect(screenshot).toBeDefined();

    const download = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/artifacts/${screenshot!.id}`
    );

    expect(download.status).toBe(200);
    expect(
      download.headers.get("content-type")
    ).toBe("image/jpeg");
    expect(
      download.headers.get("cache-control")
    ).toBe("no-store");
    expect([
      ...new Uint8Array(
        await download.arrayBuffer()
      )
    ]).toEqual([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);

    const missingArtifact = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/artifacts/does-not-exist`
    );

    expect(missingArtifact.status).toBe(404);
    expect(
      (await missingArtifact.json() as {
        error: { code: string };
      }).error.code
    ).toBe("ARTIFACT_NOT_FOUND");

    const missingRun = await fetch(
      `${baseUrl}/v1/runs/does-not-exist/artifacts`
    );

    expect(missingRun.status).toBe(404);
    expect(
      (await missingRun.json() as {
        error: { code: string };
      }).error.code
    ).toBe("RUN_NOT_FOUND");
  });

  it("cancels an active run through the HTTP API", async () => {
    const browserRuntime =
      new FakeBrowserRuntime();
    const agentRuntime =
      new HangingAgentRuntime();
    const baseUrl =
      await startServer(
        browserRuntime,
        agentRuntime
      );

    const acceptedResponse =
      await fetch(
        baseUrl + "/v1/runs",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json"
          },
          body: JSON.stringify({
            url:
              "http://fixture.test/",
            goal:
              "Remain active until cancelled."
          })
        }
      );

    const accepted =
      await acceptedResponse.json() as {
        runId: string;
      };

    for (
      let attempt = 0;
      attempt < 100;
      attempt += 1
    ) {
      if (
        agentRuntime.session
          .observeStarted
      ) {
        break;
      }

      await new Promise(
        (resolve) => {
          setTimeout(resolve, 2);
        }
      );
    }

    expect(
      agentRuntime.session
        .observeStarted
    ).toBe(true);

    const cancelResponse =
      await fetch(
        baseUrl +
          "/v1/runs/" +
          accepted.runId +
          "/cancel",
        {
          method: "POST"
        }
      );

    expect(
      cancelResponse.status
    ).toBe(200);

    const cancelled =
      await cancelResponse.json() as
        RunSnapshot;

    expect(
      cancelled.status
    ).toBe("CANCELLED");
    expect(
      cancelled.goalState
    ).toBe("BLOCKED");
    expect(
      cancelled.terminalReason
        ?.code
    ).toBe("CANCELLED");
    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session
        .closeCalls
    ).toBe(1);

    const secondCancel =
      await fetch(
        baseUrl +
          "/v1/runs/" +
          accepted.runId +
          "/cancel",
        {
          method: "POST"
        }
      );

    expect(
      secondCancel.status
    ).toBe(200);
    const secondCancelled =
      await secondCancel.json() as
        RunSnapshot;

    expect(
      secondCancelled.status
    ).toBe("CANCELLED");
  });

  it("fails closed when cancellation cannot be propagated to a durable RUNNING run", async () => {
    const repository =
      new InMemoryRunRepository();
    const now =
      new Date().toISOString();
    const runId =
      "00000000-0000-4000-8000-000000000098";

    await repository.createRun(
      {
        id: runId,
        status: "RUNNING",
        goalState:
          "IN_PROGRESS",
        createdAt: now,
        updatedAt: now
      },
      {
        url:
          "http://fixture.test/",
        goal:
          "Persisted active run."
      }
    );

    const server =
      createApiServer(
        new RunEngine({
          repository,
          browserRuntime:
            new FakeBrowserRuntime(),
          agentRuntime:
            new FakeAgentRuntime(),
          completionVerifier: {
            async verify() {
              return {
                verified: true
              };
            }
          }
        })
      );
    servers.push(server);

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
      typeof address === "string"
    ) {
      throw new Error(
        "API server did not bind a TCP port."
      );
    }

    const baseUrl =
      "http://127.0.0.1:" +
      String(
        (
          address as AddressInfo
        ).port
      );

    const response =
      await fetch(
        baseUrl +
          "/v1/runs/" +
          runId +
          "/cancel",
        {
          method: "POST"
        }
      );

    expect(response.status).toBe(
      409
    );
    expect(
      (
        await response.json() as {
          error: {
            code: string;
          };
        }
      ).error.code
    ).toBe(
      "CANCELLATION_UNAVAILABLE"
    );
    expect(
      (
        await repository.getRun(
          runId
        )
      )?.status
    ).toBe("RUNNING");
  });

  it("returns typed 400 and 404 errors", async () => {
    const baseUrl = await startServer(
      new FakeBrowserRuntime(),
      new FakeAgentRuntime()
    );

    const invalid = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "not-a-url",
          goal: ""
        })
      }
    );

    expect(invalid.status).toBe(400);
    expect(
      (await invalid.json() as {
        error: { code: string };
      }).error.code
    ).toBe("INVALID_REQUEST");

    const unsupported = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "extract data",
          outputSchema: {
            type: "array"
          }
        })
      }
    );

    expect(unsupported.status).toBe(400);
    expect(
      (await unsupported.json() as {
        error: { code: string };
      }).error.code
    ).toBe("UNSUPPORTED_OUTPUT_SCHEMA");

    const missing = await fetch(
      `${baseUrl}/v1/runs/does-not-exist`
    );

    expect(missing.status).toBe(404);
    expect(
      (await missing.json() as {
        error: { code: string };
      }).error.code
    ).toBe("RUN_NOT_FOUND");

    const missingEvents = await fetch(
      `${baseUrl}/v1/runs/does-not-exist/events`
    );

    expect(missingEvents.status).toBe(404);
    expect(
      (await missingEvents.json() as {
        error: { code: string };
      }).error.code
    ).toBe("RUN_NOT_FOUND");

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "Click the fixture button."
        })
      }
    );

    const accepted = await acceptedResponse.json() as {
      runId: string;
    };

    const invalidCursor = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/events`,
      {
        headers: {
          "Last-Event-ID": "not-an-integer"
        }
      }
    );

    expect(invalidCursor.status).toBe(400);
    expect(
      (await invalidCursor.json() as {
        error: { code: string };
      }).error.code
    ).toBe("INVALID_REQUEST");
  });
});
