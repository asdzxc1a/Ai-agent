import { z } from "zod";
import { expect, test } from "vitest";

import type {
  AgentRuntime,
  AgentSession
} from "@astra/agent-runtime";
import type {
  BrowserRuntime,
  BrowserSession
} from "@astra/browser-runtime";
import { SteelBrowserRuntime } from "@astra/browser-steel";

import { createStagehandAgentRuntimeForTesting } from "../src/testing.js";
import { FixtureLLMClient } from "./fixture-llm.js";

const steelBaseUrl = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ?? "http://host.docker.internal:4173";

const fixtureStateSchema = z.object({
  count: z.number().int(),
  status: z.literal("clicked")
});

async function runIteration(
  browserRuntime: BrowserRuntime,
  agentRuntime: AgentRuntime,
  iteration: number
): Promise<void> {
  let browser: BrowserSession | undefined;
  let agent: AgentSession | undefined;

  try {
    browser = await browserRuntime.createSession({
      headless: true,
      viewport: {
        width: 1280,
        height: 800
      }
    });

    agent = await agentRuntime.openSession({ browser });

    await agent.navigate(`${fixtureUrl}/?iteration=${iteration}`);

    const observed = await agent.observe(
      "find the Increment count button"
    );

    const action = observed.find(
      (candidate) =>
        candidate.method === "click" &&
        candidate.description.toLowerCase().includes("increment count")
    );

    if (action === undefined) {
      throw new Error(
        "AgentRuntime observe() returned no usable increment action."
      );
    }

    expect(action.selector).toMatch(/^xpath=/);

    const actResult = await agent.act(action);
    expect(actResult.success).toBe(true);

    const extracted = await agent.extract(
      "extract the RESULT count and status from the fixture",
      fixtureStateSchema
    );

    expect(extracted).toEqual({
      count: 1,
      status: "clicked"
    });

    await agent.close();
    agent = undefined;

    await browser.close();
    browser = undefined;
  } finally {
    if (agent !== undefined) {
      await agent.close().catch(() => undefined);
    }

    if (browser !== undefined) {
      await browser.close().catch(() => undefined);
    }
  }
}

test("owned runtimes preserve Stagehand→Steel semantics for ten sessions", async () => {
  const browserRuntime: BrowserRuntime = new SteelBrowserRuntime({
    baseUrl: steelBaseUrl,
    skipFingerprintInjection: true
  });

  const agentRuntime: AgentRuntime =
    createStagehandAgentRuntimeForTesting(
      () => new FixtureLLMClient()
    );

  for (let iteration = 1; iteration <= 10; iteration += 1) {
    await runIteration(browserRuntime, agentRuntime, iteration);
  }
});
