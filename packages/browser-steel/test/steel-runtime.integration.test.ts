import { createServer, type Server } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SteelClient, type SteelSession } from "../src/index.js";

const STEEL_BASE_URL = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const FIXTURE_HOST_FOR_BROWSER =
  process.env.FIXTURE_HOST_FOR_BROWSER ?? "host.docker.internal";
const RUN_COUNT = 10;

const steel = new SteelClient({
  baseUrl: STEEL_BASE_URL,
  readyTimeoutMs: 120_000
});

let fixtureServer: Server;
let fixturePort: number;

beforeAll(async () => {
  const fixtureHtml = await readFile(
    resolve("test-sites/simple-button/index.html"),
    "utf8"
  );

  fixtureServer = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(fixtureHtml);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    fixtureServer.once("error", rejectListen);
    fixtureServer.listen(0, "0.0.0.0", () => {
      resolveListen();
    });
  });

  const address = fixtureServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fixture server did not expose a TCP port");
  }

  fixturePort = (address as AddressInfo).port;
  await steel.waitUntilReady();
  await steel.releaseAllSessions();
});

afterAll(async () => {
  await steel.releaseAllSessions().catch(() => undefined);

  if (fixtureServer) {
    await new Promise<void>((resolveClose, rejectClose) => {
      fixtureServer.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    });
  }
});

describe.sequential("Steel self-hosted browser runtime", () => {
  it(
    "completes create → navigate → click → verify → screenshot → release 10/10",
    async () => {
      for (let iteration = 1; iteration <= RUN_COUNT; iteration += 1) {
        await runSteelIteration(iteration);
      }

      const sessions = await steel.listSessions();
      expect(sessions.filter((session) => session.status === "live")).toHaveLength(0);
    },
    240_000
  );
});

async function runSteelIteration(iteration: number): Promise<void> {
  let session: SteelSession | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    session = await steel.createSession({
      headless: true,
      timezone: "UTC",
      skipFingerprintInjection: true
    });

    expect(session.status).toBe("live");
    expect(session.websocketUrl).toMatch(/^ws:\/\//);

    browser = await chromium.connectOverCDP(session.websocketUrl);

    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("Steel CDP connection returned no browser context");
    }

    page = context.pages()[0] ?? (await context.newPage());

    await page.goto(
      `http://${FIXTURE_HOST_FOR_BROWSER}:${fixturePort}/?iteration=${iteration}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      }
    );

    await page.getByRole("button", { name: "Activate" }).click();
    await page.locator("#status").waitFor({
      state: "visible",
      timeout: 10_000
    });

    expect(await page.locator("#status").textContent()).toBe("clicked");
    expect(await page.locator("#activate").getAttribute("data-state")).toBe("clicked");

    const screenshot = await page.screenshot({
      type: "png"
    });
    expect(screenshot.byteLength).toBeGreaterThan(500);
  } catch (error) {
    await saveFailureEvidence(page, iteration);
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);

    if (session) {
      await steel.releaseSession(session.id).catch(async () => {
        await steel.releaseAllSessions().catch(() => undefined);
      });
    }
  }

  const sessions = await steel.listSessions();
  expect(sessions.filter((candidate) => candidate.status === "live")).toHaveLength(0);
}

async function saveFailureEvidence(page: Page | undefined, iteration: number): Promise<void> {
  if (!page) {
    return;
  }

  const directory = resolve("artifacts/steel");
  await mkdir(directory, {
    recursive: true
  });

  try {
    const screenshot = await page.screenshot({
      type: "png"
    });
    await writeFile(
      resolve(directory, `iteration-${iteration}-failure.png`),
      screenshot
    );
  } catch {
    // Failure evidence is best-effort and must never hide the original test error.
  }
}
