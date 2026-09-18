import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { expect, test } from "vitest";

import type { RunSnapshot } from "@astra/contracts";

import { createApiServer } from "../src/index.js";
import { createStagehandAgentRuntimeForTesting } from "../../../packages/agent-stagehand/src/testing.js";
import { FixtureLLMClient } from "../../../packages/agent-stagehand/test/fixture-llm.js";
import { SteelBrowserRuntime } from "../../../packages/browser-steel/src/index.js";
import { RunEngine } from "../../../packages/run-engine/src/index.js";
import {
  createPostgresPool,
  PostgresRunRepository,
  runPostgresMigrations
} from "../../../packages/run-postgres/src/index.js";

const connectionString = process.env.TEST_DATABASE_URL;
const steelBaseUrl = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ?? "http://host.docker.internal:4173";

if (connectionString === undefined) {
  throw new Error("TEST_DATABASE_URL is required.");
}

async function listen(server: Server): Promise<string> {
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

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function waitForCompleted(
  baseUrl: string,
  runId: string
): Promise<RunSnapshot> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const response = await fetch(
      `${baseUrl}/v1/runs/${runId}`
    );
    const snapshot = await response.json() as RunSnapshot;

    if (snapshot.status === "FAILED") {
      throw new Error(
        `Durable API run failed: ${snapshot.error?.message ?? "unknown"}`
      );
    }

    if (snapshot.status === "COMPLETED") {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Durable API run did not complete.");
}

test("completed HTTP run survives a fresh Postgres pool and API instance", async () => {
  const poolA = createPostgresPool({
    connectionString,
    max: 4
  });

  await runPostgresMigrations(poolA);
  await poolA.query(
    "TRUNCATE run_events, run_steps, runs RESTART IDENTITY CASCADE"
  );

  const repositoryA = new PostgresRunRepository(poolA);
  const browserRuntime = new SteelBrowserRuntime({
    baseUrl: steelBaseUrl,
    skipFingerprintInjection: true
  });
  const agentRuntime = createStagehandAgentRuntimeForTesting(
    () => new FixtureLLMClient()
  );

  const serverA = createApiServer(
    new RunEngine({
      repository: repositoryA,
      browserRuntime,
      agentRuntime
    })
  );

  const baseUrlA = await listen(serverA);
  let runId: string;

  try {
    const acceptedResponse = await fetch(
      `${baseUrlA}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: `${fixtureUrl}/?source=postgres-restart`,
          goal:
            "Click the Increment count button, then extract the RESULT count and status from the fixture.",
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
    };
    runId = accepted.runId;

    const completed = await waitForCompleted(
      baseUrlA,
      runId
    );

    expect(completed.result).toEqual({
      count: 1,
      status: "clicked"
    });
  } finally {
    await closeServer(serverA);
    await poolA.end();
  }

  const poolB = createPostgresPool({
    connectionString,
    max: 2
  });

  try {
    await runPostgresMigrations(poolB);

    const repositoryB = new PostgresRunRepository(poolB);
    const serverB = createApiServer(
      new RunEngine({
        repository: repositoryB,
        browserRuntime,
        agentRuntime
      })
    );

    const baseUrlB = await listen(serverB);

    try {
      const response = await fetch(
        `${baseUrlB}/v1/runs/${runId}`
      );

      expect(response.status).toBe(200);

      const persisted = await response.json() as RunSnapshot;

      expect(persisted.status).toBe("COMPLETED");
      expect(persisted.result).toEqual({
        count: 1,
        status: "clicked"
      });

      const steps = await repositoryB.listSteps(runId);
      const events = await repositoryB.listEvents(runId);

      expect(steps.map((step) => step.kind)).toEqual(
        expect.arrayContaining([
          "BROWSER_CREATED",
          "AGENT_OPENED",
          "NAVIGATE",
          "OBSERVE",
          "ACT",
          "EXTRACT",
          "CLEANUP"
        ])
      );

      expect(events.map((event) => event.eventType)).toEqual([
        "RUN_CREATED",
        "RUN_STARTED",
        "RUN_COMPLETED"
      ]);
    } finally {
      await closeServer(serverB);
    }
  } finally {
    await poolB.end();
  }
});
