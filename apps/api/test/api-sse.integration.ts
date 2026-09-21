import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { expect, test } from "vitest";

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
import type {
  RunSnapshot
} from "@astra/contracts";

import { createApiServer } from "../src/index.js";
import { RunEngine } from "../../../packages/run-engine/src/index.js";
import {
  createPostgresPool,
  PostgresRunRepository,
  runPostgresMigrations
} from "../../../packages/run-postgres/src/index.js";

const connectionString = process.env.TEST_DATABASE_URL;

if (connectionString === undefined) {
  throw new Error("TEST_DATABASE_URL is required.");
}

interface ParsedSseEvent {
  id: number;
  event: string;
  data: {
    runId: string;
    sequenceNumber: number;
    eventType: string;
    payload: unknown;
    createdAt: string;
  };
}

class FakeBrowserSession implements BrowserSession {
  public readonly id = "sse-browser";
  public readonly cdpUrl =
    "ws://browser.test/devtools/browser/sse";

  public async close(): Promise<void> {}
}

class FakeBrowserRuntime implements BrowserRuntime {
  public async createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    void options;
    return new FakeBrowserSession();
  }
}

class SlowAgentSession implements AgentSession {
  public async navigate(url: string): Promise<void> {
    void url;
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
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
      success: true,
      message: "clicked",
      actionDescription: action.description,
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({
      count: 1,
      status: "clicked"
    });
  }

  public async close(): Promise<void> {}
}

class SlowAgentRuntime implements AgentRuntime {
  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return new SlowAgentSession();
  }
}

async function listen(
  server: Server
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (
    address === null ||
    typeof address === "string"
  ) {
    throw new Error(
      "API server did not bind a TCP port."
    );
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function closeServer(
  server: Server
): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

function parseEventBlock(
  block: string
): ParsedSseEvent {
  const lines = block.split("\n");
  const idLine = lines.find(
    (line) => line.startsWith("id: ")
  );
  const eventLine = lines.find(
    (line) => line.startsWith("event: ")
  );
  const dataLine = lines.find(
    (line) => line.startsWith("data: ")
  );

  if (
    idLine === undefined ||
    eventLine === undefined ||
    dataLine === undefined
  ) {
    throw new Error(
      `Invalid SSE block: ${block}`
    );
  }

  return {
    id: Number(idLine.slice(4)),
    event: eventLine.slice(7),
    data: JSON.parse(dataLine.slice(6)) as ParsedSseEvent["data"]
  };
}

async function readSse(
  response: Response,
  stopAfterFirst = false
): Promise<ParsedSseEvent[]> {
  if (response.body === null) {
    throw new Error("SSE response has no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: ParsedSseEvent[] = [];
  let buffer = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(
        chunk.value,
        {
          stream: true
        }
      );

      while (true) {
        const boundary = buffer.indexOf("\n\n");

        if (boundary < 0) {
          break;
        }

        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        if (block.length === 0) {
          continue;
        }

        events.push(parseEventBlock(block));

        if (stopAfterFirst) {
          await reader.cancel();
          return events;
        }
      }
    }

    return events;
  } finally {
    reader.releaseLock();
  }
}

async function waitForTerminal(
  baseUrl: string,
  runId: string
): Promise<RunSnapshot> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
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

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  throw new Error(
    "SSE fixture run did not reach terminal state."
  );
}

test("PostgreSQL SSE resumes after disconnect without duplicate events", async () => {
  const pool = createPostgresPool({
    connectionString,
    max: 4
  });

  await runPostgresMigrations(pool);
  await pool.query(
    "TRUNCATE run_events, run_steps, runs RESTART IDENTITY CASCADE"
  );

  const repository = new PostgresRunRepository(pool);
  const runEngine = new RunEngine({
    repository,
    browserRuntime: new FakeBrowserRuntime(),
    agentRuntime: new SlowAgentRuntime()
  });
  const server = createApiServer(runEngine);
  const baseUrl = await listen(server);

  try {
    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "http://fixture.test/",
          goal: "Click and extract fixture state.",
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
            required: [
              "count",
              "status"
            ],
            additionalProperties: false
          }
        })
      }
    );

    expect(acceptedResponse.status).toBe(202);

    const accepted = await acceptedResponse.json() as {
      runId: string;
    };

    const firstResponse = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/events`
    );

    expect(firstResponse.status).toBe(200);
    expect(
      firstResponse.headers.get("content-type")
    ).toContain("text/event-stream");

    const firstEvents = await readSse(
      firstResponse,
      true
    );

    expect(firstEvents).toHaveLength(1);
    expect(firstEvents[0]?.id).toBe(1);
    expect(firstEvents[0]?.event).toBe("RUN_CREATED");

    // RUN_CREATED is persisted before the run snapshot is advanced from
    // PENDING to RUNNING. The replay assertions below prove that RUN_STARTED
    // was durably recorded as event 2 without depending on scheduler timing.

    const reconnect = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/events`,
      {
        headers: {
          "Last-Event-ID": String(
            firstEvents[0]?.id
          )
        }
      }
    );

    const replayed = await readSse(reconnect);

    expect(
      replayed.map((event) => event.id)
    ).toEqual([2, 3]);
    expect(
      replayed.map((event) => event.event)
    ).toEqual([
      "RUN_STARTED",
      "RUN_COMPLETED"
    ]);

    const allIds = [
      firstEvents[0]?.id,
      ...replayed.map((event) => event.id)
    ];

    expect(allIds).toEqual([1, 2, 3]);
    expect(new Set(allIds).size).toBe(3);

    const terminal = await waitForTerminal(
      baseUrl,
      accepted.runId
    );

    expect(terminal.status).toBe("COMPLETED");
    expect(terminal.result).toEqual({
      count: 1,
      status: "clicked"
    });

    const terminalEvent = replayed.at(-1);

    expect(
      terminalEvent?.data.payload
    ).toEqual({
      goalStatus: "COMPLETED",
      result: {
        count: 1,
        status: "clicked"
      },
      terminalReason: {
        code: "GOAL_COMPLETED",
        message:
          "Completion verifier accepted the run result."
      }
    });
  } finally {
    await closeServer(server);
    await pool.end();
  }
});
