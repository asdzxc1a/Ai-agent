export const BSK_FILE_CLIENT_SOURCE =
  `import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const brokerDir = process.env.ASTRA_COMPARATOR_BSK_BROKER_DIR;
if (!brokerDir) {
  throw new Error("Comparator BrowserSkill broker directory is missing.");
}

const id = randomUUID();
const requestsDir = join(brokerDir, "requests");
const responsesDir = join(brokerDir, "responses");
await Promise.all([
  mkdir(requestsDir, { recursive: true, mode: 0o700 }),
  mkdir(responsesDir, { recursive: true, mode: 0o700 })
]);

const requestPath = join(requestsDir, id + ".json");
const temporaryPath = requestPath + ".tmp." + String(process.pid);
await writeFile(
  temporaryPath,
  JSON.stringify({ id, args: process.argv.slice(2) }) + "\\n",
  { encoding: "utf8", mode: 0o600, flag: "wx" }
);
await rename(temporaryPath, requestPath);

const responsePath = join(responsesDir, id + ".json");
const deadline = Date.now() + 125000;
let response;
while (Date.now() < deadline) {
  try {
    response = JSON.parse(await readFile(responsePath, "utf8"));
    break;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
}

if (!response) {
  throw new Error("Comparator BrowserSkill broker response timed out.");
}

await unlink(responsePath).catch(() => undefined);

if (typeof response.stdout === "string") {
  process.stdout.write(response.stdout);
}
if (typeof response.stderr === "string") {
  process.stderr.write(response.stderr);
}
process.exitCode =
  Number.isInteger(response.exitCode)
    ? response.exitCode
    : 1;
`;
