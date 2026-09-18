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
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";
import type { RunSnapshot } from "@astra/contracts";

import {
  createApiServer,
  InMemoryRunService
} from "../src/index.js";

class FakeBrowserSession implements BrowserSession {
  public readonly id = "browser-1";
  public readonly cdpUrl = "ws://browser.test/1";
  public closeCalls = 0;

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeBrowserRuntime implements BrowserRuntime {
  public readonly session = new FakeBrowserSession();

  public async createSession(
    _options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    return this.session;
  }
}

class FakeAgentSession implements AgentSession {
  public closeCalls = 0;

  public constructor(
    private readonly failAction: boolean,
    private readonly extraction: unknown
  ) {}

  public async navigate(_url: string): Promise<void> {}

  public async observe(
    _instruction: string
  ): Promise<AgentAction[]> {
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
    _instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
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
    _options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    const session = new FakeAgentSession(
      this.failAction,
      this.extraction
    );
    this.sessions.push(session);
    return session;
  }
}

const servers: Server[] = [];

async function startServer(
  browserRuntime: BrowserRuntime,
  agentRuntime: AgentRuntime
): Promise<string> {
  const server = createApiServer(
    new InMemoryRunService(
      browserRuntime,
      agentRuntime
    )
  );
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
  });
});
