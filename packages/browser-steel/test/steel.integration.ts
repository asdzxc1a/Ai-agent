import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Browser } from "playwright-core";
import { expect, test } from "vitest";

import {
  SteelBrowserRuntime,
  SteelClient,
  type SteelSessionDetails
} from "../src/index.js";

const steelBaseUrl = process.env.STEEL_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.STEEL_FIXTURE_URL ?? "http://host.docker.internal:4173";
const artifactDir =
  process.env.STEEL_ARTIFACT_DIR ?? resolve("artifacts/gate1");

async function runIteration(
  client: SteelClient,
  iteration: number
): Promise<void> {
  let session: SteelSessionDetails | undefined;
  let browser: Browser | undefined;
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

    expect(session.status).toBe("live");
    expect(session.websocketUrl).toMatch(/^wss?:\/\//);

    browser = await chromium.connectOverCDP(session.websocketUrl);

    const context = browser.contexts()[0];
    if (context === undefined) {
      throw new Error("Steel CDP connection exposed no browser context.");
    }

    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(`${fixtureUrl}/?iteration=${iteration}`, {
      waitUntil: "domcontentloaded"
    });

    await page.getByRole("button", { name: "Increment count" }).click();

    expect(await page.locator("#count").textContent()).toBe("1");
    expect(await page.locator("#status").getAttribute("data-state")).toBe(
      "clicked"
    );

    await page.screenshot({
      path: resolve(
        artifactDir,
        `iteration-${String(iteration).padStart(2, "0")}.png`
      ),
      fullPage: true
    });

    const releaseResult = await client.releaseSession(session.id);
    released = true;

    expect(releaseResult.success).toBe(true);
    expect(releaseResult.status).toBe("released");

    const persistedSession = await client.getSession(session.id);
    expect(persistedSession.status).toBe("released");
  } finally {
    if (session !== undefined && !released) {
      await client.releaseSession(session.id).catch(() => undefined);
    }

    if (browser !== undefined) {
      await browser.close().catch(() => undefined);
    }
  }
}

test("Steel completes ten consecutive deterministic browser sessions", async () => {
  await mkdir(artifactDir, {
    recursive: true
  });

  const client = new SteelClient(steelBaseUrl);

  await expect(client.isHealthy()).resolves.toBe(true);

  for (let iteration = 1; iteration <= 10; iteration += 1) {
    await runIteration(client, iteration);
  }
});


test("Steel browser adapter captures JPEG and console diagnostics", async () => {
  const runtime = new SteelBrowserRuntime({
    baseUrl: steelBaseUrl,
    skipFingerprintInjection: true
  });
  const session = await runtime.createSession({
    headless: true,
    viewport: {
      width: 1280,
      height: 800
    }
  });
  let browser: Browser | undefined;
  let closed = false;

  try {
    browser = await chromium.connectOverCDP(
      session.cdpUrl
    );

    const context = browser.contexts()[0];
    if (context === undefined) {
      throw new Error(
        "Steel adapter exposed no browser context."
      );
    }

    const page =
      context.pages()[0] ??
      (await context.newPage());

    await page.goto(
      `${fixtureUrl}/?gate=7&adapter=diagnostics`,
      {
        waitUntil: "domcontentloaded"
      }
    );

    const diagnosticMarker =
      `gate7-console-${session.id}`;

    await page.evaluate((message) => {
      console.error(message);
    }, diagnosticMarker);

    if (
      session.captureScreenshot === undefined ||
      session.getDiagnostics === undefined
    ) {
      throw new Error(
        "Steel BrowserSession artifact capabilities are unavailable."
      );
    }

    const screenshot =
      await session.captureScreenshot({
        fullPage: true
      });

    expect([
      screenshot[0],
      screenshot[1],
      screenshot[2]
    ]).toEqual([
      0xff,
      0xd8,
      0xff
    ]);

    let diagnostics =
      await session.getDiagnostics();

    for (
      let attempt = 0;
      attempt < 30 &&
      !diagnostics.some((entry) =>
        entry.message.includes(diagnosticMarker)
      );
      attempt += 1
    ) {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      diagnostics =
        await session.getDiagnostics();
    }

    expect(
      diagnostics.some(
        (entry) =>
          entry.kind === "console" &&
          entry.message.includes(diagnosticMarker)
      )
    ).toBe(true);

    await session.close();
    closed = true;
  } finally {
    if (!closed) {
      await session.close().catch(
        () => undefined
      );
    }

    if (browser !== undefined) {
      await browser.close().catch(
        () => undefined
      );
    }
  }
});
