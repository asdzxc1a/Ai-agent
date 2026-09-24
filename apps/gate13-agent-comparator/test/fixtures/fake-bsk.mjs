#!/usr/bin/env node

import {
  Buffer
} from "node:buffer";
import {
  writeFile
} from "node:fs/promises";

const args =
  process.argv.slice(
    2
  );
const [
  command,
  subcommand
] = args;

function option(
  name
) {
  const index =
    args.indexOf(
      name
    );

  return index < 0
    ? undefined
    : args[index + 1];
}

if (
  command ===
    "session" &&
  subcommand ===
    "start"
) {
  process.stdout.write(
    JSON.stringify({
      session_id:
        "fixture-session",
      browser:
        option(
          "--browser"
        ),
      interaction: {
        requestHelpEnabled:
          false
      }
    }) +
      "\n"
  );
  process.exit(0);
}

if (
  command ===
    "session" &&
  subcommand ===
    "stop"
) {
  process.stdout.write(
    JSON.stringify({
      stopped: true
    }) +
      "\n"
  );
  process.exit(0);
}

if (
  command ===
    "navigate"
) {
  process.stdout.write(
    JSON.stringify({
      url:
        args[1],
      ok: true
    }) +
      "\n"
  );
  process.exit(0);
}

if (
  command ===
    "observe" ||
  command ===
    "snapshot"
) {
  process.stdout.write(
    [
      "Fixture Transit — About",
      "URL: https://fixture.test/about",
      "",
      "Fixture Transit is a public transportation logistics company serving regional freight customers.",
      "The company states that it operates 120 vehicles and a 24/7 dispatch center.",
      "Its operations page says dispatch scheduling still includes manual spreadsheet handoffs between shifts.",
      "Its 2026 modernization update says the company is evaluating workflow automation for dispatch and maintenance planning.",
      "The same update says leadership has budgeted a pilot for predictive maintenance and fleet utilization analytics.",
      "",
      "These statements are fixture content for local comparator validation only."
    ].join(
      "\n"
    ) +
      "\n"
  );
  process.exit(0);
}

if (
  command ===
    "screenshot"
) {
  const out =
    option(
      "--out"
    );

  if (
    out !== undefined
  ) {
    await writeFile(
      out,
      Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360606060000000050001a5f645400000000049454e44ae426082",
        "hex"
      )
    );
  }

  process.stdout.write(
    JSON.stringify({
      ok: true,
      path:
        out ??
        null
    }) +
      "\n"
  );
  process.exit(0);
}

if (
  [
    "wheel",
    "scroll-to",
    "navigate-back",
    "navigate-forward",
    "reload",
    "wait-ms"
  ].includes(
    command
  )
) {
  process.stdout.write(
    JSON.stringify({
      ok: true
    }) +
      "\n"
  );
  process.exit(0);
}

process.stderr.write(
  "fixture bsk: unsupported command: " +
    args.join(
      " "
    ) +
    "\n"
);
process.exit(2);
