import type { AddressInfo } from "node:net";
import {
  mkdtemp,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import type { RunSnapshot } from "@astra/contracts";

import { createApiServer } from "../src/index.js";
import {
  LocalArtifactStore
} from "../../../packages/artifact-store/src/index.js";
import {
  InMemoryRunRepository,
  RunEngine
} from "../../../packages/run-engine/src/index.js";
import { createStagehandAgentRuntimeForTesting } from "../../../packages/agent-stagehand/src/testing.js";
import { FixtureLLMClient } from "../../../packages/agent-stagehand/test/fixture-llm.js";
import { SteelBrowserRuntime } from "../../../packages/browser-steel/src/index.js";

const steelBaseUrl =
  process.env.STEEL_BASE_URL ??
  "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ??
  "http://host.docker.internal:4173";

test("HTTP API executes a real structured browser run with downloadable screenshots", async () => {
  const artifactRoot = await mkdtemp(
    join(tmpdir(), "astra-api-artifacts-")
  );
  const artifactStore =
    new LocalArtifactStore(artifactRoot);

  const browserRuntime =
    new SteelBrowserRuntime({
      baseUrl: steelBaseUrl,
      skipFingerprintInjection: true
    });

  const agentRuntime =
    createStagehandAgentRuntimeForTesting(
      () => new FixtureLLMClient()
    );

  const server = createApiServer(
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime,
      agentRuntime,
      artifactStore
    })
  );

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

  try {
    const address = server.address();

    if (
      address === null ||
      typeof address === "string"
    ) {
      throw new Error(
        "API server did not bind a TCP port."
      );
    }

    const baseUrl =
      `http://127.0.0.1:${(address as AddressInfo).port}`;

    const acceptedResponse = await fetch(
      `${baseUrl}/v1/runs`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body: JSON.stringify({
          url:
            `${fixtureUrl}/?source=api&token=redact-me`,
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
            required: [
              "count",
              "status"
            ],
            additionalProperties: false
          }
        })
      }
    );

    expect(
      acceptedResponse.status
    ).toBe(202);

    const accepted =
      await acceptedResponse.json() as {
        runId: string;
        status: string;
      };

    expect(accepted.status).toBe(
      "PENDING"
    );

    let terminal:
      | RunSnapshot
      | undefined;

    for (
      let attempt = 0;
      attempt < 300;
      attempt += 1
    ) {
      const response = await fetch(
        `${baseUrl}/v1/runs/${accepted.runId}`
      );

      expect(response.status).toBe(200);

      const snapshot =
        await response.json() as RunSnapshot;

      if (
        snapshot.status === "COMPLETED" ||
        snapshot.status === "FAILED"
      ) {
        terminal = snapshot;
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    }

    expect(terminal?.status).toBe(
      "COMPLETED"
    );
    expect(
      terminal?.goalStatus
    ).toBe("COMPLETED");
    expect(
      terminal?.terminalReason?.code
    ).toBe("GOAL_COMPLETED");
    expect(terminal?.result).toEqual({
      count: 1,
      status: "clicked"
    });

    const listResponse = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/artifacts`
    );

    expect(listResponse.status).toBe(
      200
    );

    const listed =
      await listResponse.json() as {
        artifacts: Array<{
          id: string;
          kind: string;
          name: string;
          mediaType: string;
        }>;
      };

    const screenshot =
      listed.artifacts.find(
        (artifact) =>
          artifact.kind ===
          "SCREENSHOT"
      );

    expect(screenshot).toBeDefined();

    const download = await fetch(
      `${baseUrl}/v1/runs/${accepted.runId}/artifacts/${screenshot!.id}`
    );

    expect(download.status).toBe(200);
    expect(
      download.headers.get(
        "content-type"
      )
    ).toContain("image/jpeg");

    const bytes = new Uint8Array(
      await download.arrayBuffer()
    );

    expect([
      bytes[0],
      bytes[1],
      bytes[2]
    ]).toEqual([
      0xff,
      0xd8,
      0xff
    ]);

    const summary =
      listed.artifacts.find(
        (artifact) =>
          artifact.name ===
          "run-summary.json"
      );

    expect(summary).toBeDefined();

    const summaryResponse =
      await fetch(
        `${baseUrl}/v1/runs/${accepted.runId}/artifacts/${summary!.id}`
      );

    const summaryText =
      await summaryResponse.text();

    expect(summaryText).not.toContain(
      "redact-me"
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await rm(artifactRoot, {
      recursive: true,
      force: true
    });
  }
});
