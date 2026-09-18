import type { AddressInfo } from "node:net";

import { expect, test } from "vitest";

import type { RunSnapshot } from "@astra/contracts";

import { createApiServer } from "../src/index.js";
import { InMemoryRunRepository, RunEngine } from "../../../packages/run-engine/src/index.js";
import { createStagehandAgentRuntimeForTesting } from "../../../packages/agent-stagehand/src/testing.js";
import { FixtureLLMClient } from "../../../packages/agent-stagehand/test/fixture-llm.js";
import { SteelBrowserRuntime } from "../../../packages/browser-steel/src/index.js";

const steelBaseUrl = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ?? "http://host.docker.internal:4173";

test("HTTP API executes a real structured browser run", async () => {
  const browserRuntime = new SteelBrowserRuntime({
    baseUrl: steelBaseUrl,
    skipFingerprintInjection: true
  });

  const agentRuntime = createStagehandAgentRuntimeForTesting(
    () => new FixtureLLMClient()
  );

  const server = createApiServer(
    new RunEngine({
      repository: new InMemoryRunRepository(),
      browserRuntime,
      agentRuntime
    })
  );

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();

    if (
      address === null ||
      typeof address === "string"
    ) {
      throw new Error("API server did not bind a TCP port.");
    }

    const baseUrl =
      `http://127.0.0.1:${(address as AddressInfo).port}`;

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: `${fixtureUrl}/?source=api`,
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
      status: string;
    };

    expect(accepted.status).toBe("PENDING");

    let terminal: RunSnapshot | undefined;

    for (let attempt = 0; attempt < 300; attempt += 1) {
      const response = await fetch(
        `${baseUrl}/v1/runs/${accepted.runId}`
      );

      expect(response.status).toBe(200);

      const snapshot = await response.json() as RunSnapshot;

      if (
        snapshot.status === "COMPLETED" ||
        snapshot.status === "FAILED"
      ) {
        terminal = snapshot;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(terminal?.status).toBe("COMPLETED");
    expect(terminal?.result).toEqual({
      count: 1,
      status: "clicked"
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
