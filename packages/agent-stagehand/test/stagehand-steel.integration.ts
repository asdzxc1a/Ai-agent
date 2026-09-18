import { z } from "zod";
import { expect, test } from "vitest";

import { SteelClient, type SteelSessionDetails } from "../../browser-steel/src/index.js";
import { createStagehandForSteel } from "../src/index.js";
import { FixtureLLMClient } from "./fixture-llm.js";

const steelBaseUrl = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ?? "http://host.docker.internal:4173";

const fixtureStateSchema = z.object({
  count: z.number(),
  status: z.string()
});

async function runIteration(
  client: SteelClient,
  iteration: number
): Promise<void> {
  let session: SteelSessionDetails | undefined;
  let stagehand: ReturnType<typeof createStagehandForSteel> | undefined;
  let released = false;

  try {
    session = await client.createSession({
      headless: true,
      skipFingerprintInjection: true,
      dimensions: {
        width: 1280,
        height: 800
      }
    });

    stagehand = createStagehandForSteel({
      cdpUrl: session.websocketUrl,
      llmClient: new FixtureLLMClient()
    });

    await stagehand.init();

    const page = stagehand.context.pages()[0];
    if (page === undefined) {
      throw new Error("Stagehand attached to Steel without exposing a page.");
    }

    await page.goto(`${fixtureUrl}/?iteration=${iteration}`);

    const observed = await stagehand.observe(
      "find the Increment count button"
    );

    const action = observed.find(
      (candidate) =>
        candidate.method === "click" &&
        candidate.description.toLowerCase().includes("increment count")
    );

    if (action === undefined) {
      throw new Error("Stagehand observe() returned no usable increment action.");
    }

    const actResult = await stagehand.act(action);
    expect(actResult.success).toBe(true);

    expect(await page.locator("#count").textContent()).toBe("1");
    expect(await page.locator("#status-text").textContent()).toBe("clicked");

    const extracted = await stagehand.extract(
      "extract the current count and status from the fixture",
      fixtureStateSchema
    );

    expect(extracted).toEqual({
      count: 1,
      status: "clicked"
    });

    await stagehand.close();
    stagehand = undefined;

    const release = await client.releaseSession(session.id);
    released = true;

    expect(release.success).toBe(true);
    expect(release.status).toBe("released");

    const persisted = await client.getSession(session.id);
    expect(persisted.status).toBe("released");
  } finally {
    if (stagehand !== undefined) {
      await stagehand.close().catch(() => undefined);
    }

    if (session !== undefined && !released) {
      await client.releaseSession(session.id).catch(() => undefined);
    }
  }
}

test("Stagehand observes, acts, and extracts through Steel for ten sessions", async () => {
  const client = new SteelClient(steelBaseUrl);

  await expect(client.isHealthy()).resolves.toBe(true);

  for (let iteration = 1; iteration <= 10; iteration += 1) {
    await runIteration(client, iteration);
  }
});
