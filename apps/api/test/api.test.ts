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
import type {
  RunEventRecord,
  RunService
} from "@astra/run-engine";

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

class CancellationAgentSession
  implements AgentSession {
  public closeCalls = 0;
  public navigateStarted = false;

  public async navigate(
    url: string,
    options: {
      signal?: AbortSignal;
    } = {}
  ): Promise<void> {
    void url;
    this.navigateStarted = true;

    const signal = options.signal;

    if (signal === undefined) {
      throw new Error(
        "Cancellation fixture requires a signal."
      );
    }

    await new Promise<void>(
      (_resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }

        signal.addEventListener(
          "abort",
          () => {
            reject(signal.reason);
          },
          {
            once: true
          }
        );
      }
    );
  }

  public async observe():
    Promise<AgentAction[]> {
    return [];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: true,
      message: "unused",
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

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class CancellationAgentRuntime
  implements AgentRuntime {
  public readonly session =
    new CancellationAgentSession();

  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return this.session;
  }
}

class ReplayRunService
  implements RunService {
  readonly #runId =
    "run-replay-backlog";
  readonly #events:
    RunEventRecord[];
  readonly #snapshot:
    RunSnapshot;

  public constructor(
    eventCount = 151
  ) {
    const timestamp =
      "2026-09-20T00:00:00.000Z";

    this.#events =
      Array.from(
        {
          length: eventCount
        },
        (_unused, index) => {
          const sequenceNumber =
            index + 1;

          return {
            runId: this.#runId,
            sequenceNumber,
            eventType:
              sequenceNumber ===
              eventCount
                ? "RUN_COMPLETED"
                : "RUN_PROGRESS",
            payload: {
              sequenceNumber
            },
            createdAt: timestamp
          };
        }
      );

    this.#snapshot = {
      id: this.#runId,
      status: "COMPLETED",
      goalStatus: "COMPLETED",
      createdAt: timestamp,
      updatedAt: timestamp,
      result: {
        ok: true
      },
      terminalReason: {
        code: "GOAL_COMPLETED",
        message:
          "Completed replay fixture."
      }
    };
  }

  public get runId(): string {
    return this.#runId;
  }

  public async createRun():
    Promise<RunSnapshot> {
    throw new Error(
      "Replay fixture does not create runs."
    );
  }

  public async getRun(
    runId: string
  ): Promise<
    RunSnapshot | undefined
  > {
    return runId === this.#runId
      ? this.#snapshot
      : undefined;
  }

  public async cancelRun(
    runId: string
  ): Promise<
    RunSnapshot | undefined
  > {
    return this.getRun(runId);
  }

  public async listEventsAfter(
    runId: string,
    afterSequence: number,
    limit = 100
  ): Promise<RunEventRecord[]> {
    if (runId !== this.#runId) {
      return [];
    }

    return this.#events
      .filter(
        (event) =>
          event.sequenceNumber >
          afterSequence
      )
      .slice(0, limit);
  }

  public async listArtifacts() {
    return [];
  }

  public async readArtifact() {
    return undefined;
  }
}

const servers: Server[] = [];

async function startRunServiceServer(
  runService: RunService
): Promise<string> {
  const server =
    createApiServer(runService);
  servers.push(server);

  await new Promise<void>(
    (resolve, reject) => {
      server.once("error", reject);
      server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );

  const address = server.address();

  if (
    address === null ||
    typeof address === "string"
  ) {
    throw new Error(
      "API server did not bind a TCP port."
    );
  }

  return (
    `http://127.0.0.1:${
      (address as AddressInfo).port
    }`
  );
}

async function startServer(
  browserRuntime: BrowserRuntime,
  agentRuntime: AgentRuntime,
  artifactStore?: ArtifactStore
): Promise<string> {
  const runService = new RunEngine({
    repository:
      new InMemoryRunRepository(),
    browserRuntime,
    agentRuntime,
    ...(artifactStore === undefined
      ? {}
      : {
          artifactStore
        })
  });

  return startRunServiceServer(
    runService
  );
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
      run.status === "FAILED" ||
      run.status === "CANCELLED"
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

  it("cancels an active run through the API", async () => {
    const browserRuntime =
      new FakeBrowserRuntime();
    const agentRuntime =
      new CancellationAgentRuntime();
    const baseUrl =
      await startServer(
        browserRuntime,
        agentRuntime
      );

    const acceptedResponse =
      await fetch(
        `${baseUrl}/v1/runs`,
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
              "Wait until cancelled."
          })
        }
      );

    const accepted =
      await acceptedResponse.json() as {
        runId: string;
      };

    for (
      let attempt = 0;
      attempt < 100 &&
      !agentRuntime.session
        .navigateStarted;
      attempt += 1
    ) {
      await new Promise(
        (resolve) => {
          setTimeout(resolve, 2);
        }
      );
    }

    const cancelResponse =
      await fetch(
        `${baseUrl}/v1/runs/${accepted.runId}/cancel`,
        {
          method: "POST"
        }
      );

    expect(
      cancelResponse.status
    ).toBe(202);

    const terminal =
      await waitForTerminal(
        baseUrl,
        accepted.runId
      );

    expect(terminal.status).toBe(
      "CANCELLED"
    );
    expect(
      terminal.terminalReason?.code
    ).toBe("RUN_CANCELLED");
    expect(
      agentRuntime.session.closeCalls
    ).toBe(1);
    expect(
      browserRuntime.session.closeCalls
    ).toBe(1);
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

  it("drains completed SSE replay across event batches", async () => {
    const runService =
      new ReplayRunService(151);
    const baseUrl =
      await startRunServiceServer(
        runService
      );

    const response = await fetch(
      `${baseUrl}/v1/runs/${runService.runId}/events`
    );

    expect(response.status).toBe(200);

    const body = await response.text();
    const ids = [
      ...body.matchAll(
        /^id: (\d+)$/gm
      )
    ].map(
      (match) => Number(match[1])
    );
    const eventTypes = [
      ...body.matchAll(
        /^event: ([^\n]+)$/gm
      )
    ].map(
      (match) => match[1]
    );

    expect(ids).toEqual(
      Array.from(
        {
          length: 151
        },
        (_unused, index) =>
          index + 1
      )
    );
    expect(
      eventTypes.at(-1)
    ).toBe("RUN_COMPLETED");
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
