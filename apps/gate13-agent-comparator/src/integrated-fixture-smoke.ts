import {
  createServer
} from "node:http";
import {
  mkdtemp,
  readFile
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join,
  resolve
} from "node:path";

import {
  ComparatorFileStore,
  ComparatorProtocolSchema,
  runComparatorFirstAttempt
} from "@astra/agent-comparator";

import {
  startComparatorBrowserEnvironment
} from "./browser-environment.js";
import {
  CodexBrowserSkillWorker
} from "./codex-browser-worker.js";
import {
  inspectComparatorReadiness
} from "./readiness.js";

const server =
  createServer(
    (
      request,
      response
    ) => {
      if (
        request.url !==
          "/about"
      ) {
        response.writeHead(
          404,
          {
            "content-type":
              "text/plain"
          }
        );
        response.end(
          "not found"
        );
        return;
      }

      response.writeHead(
        200,
        {
          "content-type":
            "text/html; charset=utf-8",
          "cache-control":
            "no-store"
        }
      );
      response.end(
        `<!doctype html>
<html>
<head><title>Fixture Transit — About</title></head>
<body>
  <main>
    <h1>Fixture Transit</h1>
    <p>Fixture Transit is a regional freight transportation company serving industrial customers.</p>
    <p>The company operates 120 vehicles and a 24/7 dispatch center.</p>
    <section>
      <h2>Operations modernization</h2>
      <p>Dispatch scheduling still includes manual spreadsheet handoffs between shifts.</p>
      <p>In 2026 the company began evaluating workflow automation for dispatch and maintenance planning.</p>
      <p>Leadership has budgeted a pilot for predictive maintenance and fleet utilization analytics.</p>
    </section>
  </main>
</body>
</html>`
      );
    }
  );

await new Promise<void>(
  (
    resolveListen,
    reject
  ) => {
    server.once(
      "error",
      reject
    );
    server.listen(
      0,
      "127.0.0.1",
      () =>
        resolveListen()
    );
  }
);

const address =
  server.address();

if (
  address === null ||
  typeof address ===
    "string"
) {
  throw new Error(
    "Integrated fixture server did not expose a TCP port."
  );
}

const protocol =
  ComparatorProtocolSchema
    .parse(
      JSON.parse(
        await readFile(
          "docs/project/data/gate13-agent-comparator-v1.json",
          "utf8"
        )
      )
    );
const startUrl =
  "http://127.0.0.1:" +
  String(
    address.port
  ) +
  "/about";
const target = {
  id:
    "fixture.local.integrated",
  companyName:
    "Fixture Transit",
  startUrl,
  approvedDomains: [
    "127.0.0.1"
  ]
};
const storeRoot =
  await mkdtemp(
    join(
      tmpdir(),
      "astra-agent-comparator-integrated-"
    )
  );
const store =
  new ComparatorFileStore(
    storeRoot
  );

await store.authorize({
  protocolVersion:
    protocol.version,
  protocolSha256:
    "a".repeat(64),
  manifestSha256:
    "c".repeat(64),
  targetCount: 43,
  authorizedBy:
    "integrated-fixture"
});

let environment:
  Awaited<
    ReturnType<
      typeof startComparatorBrowserEnvironment
    >
  > | undefined;

try {
  environment =
    await startComparatorBrowserEnvironment(
      target,
      protocol,
      {
        trustedHostnames: [
          "127.0.0.1"
        ]
      }
    );
  const readiness =
    await inspectComparatorReadiness(
      protocol
    );

  if (
    readiness.status !==
      "READY" ||
    readiness.identity ===
      null ||
    readiness.browserInstanceId !==
      environment.browserInstanceId
  ) {
    throw new Error(
      "Integrated local fixture browser did not satisfy frozen readiness."
    );
  }

  const worker =
    new CodexBrowserSkillWorker({
      storeRoot,
      frozenPrompt:
        [
          "This is a deterministic local fixture, not a measured company.",
          "Use only the permitted BrowserSkill commands.",
          "Do not use public search.",
          "Navigate directly to the supplied local fixture start URL.",
          "Observe the page, use only 127.0.0.1 as evidence, and stop the BrowserSkill session before final JSON.",
          "Return evidence-backed values for all four requested fields.",
          "The worker must leave modelUsage null; the runner captures usage independently."
        ].join(
          "\n"
        ),
      resultSchemaPath:
        resolve(
          process.cwd(),
          "docs/project/data/gate13-agent-comparator-v1-result.schema.json"
        ),
      realBskPath:
        join(
          process.env.HOME ??
            "",
          ".local",
          "bin",
          "bsk"
        )
    });
  const attempt =
    await runComparatorFirstAttempt({
      store,
      worker,
      protocol,
      protocolSha256:
        "a".repeat(64),
      promptSha256:
        "b".repeat(64),
      manifestSha256:
        "c".repeat(64),
      target,
      agentIdentity:
        readiness.identity
    });

  if (
    attempt.status !==
      "COMPLETED" ||
    attempt.workerResult ===
      null ||
    attempt.workerResult
      .evidence.length ===
      0 ||
    attempt.workerResult
      .modelUsage ===
      null
  ) {
    throw new Error(
      "Integrated local comparator fixture failed: " +
        JSON.stringify(
          attempt,
          null,
          2
        )
    );
  }

  if (
    attempt.workerResult
      .visitedUrls.some(
        (url) =>
          !url.startsWith(
            "http://127.0.0.1:"
          )
      )
  ) {
    throw new Error(
      "Integrated local fixture visited a non-local URL."
    );
  }

  process.stdout.write(
    JSON.stringify(
      {
        status:
          "PASS",
        attemptId:
          attempt.attemptId,
        elapsedMs:
          attempt.elapsedMs,
        evidenceCount:
          attempt.workerResult
            .evidence.length,
        visitedUrls:
          attempt.workerResult
            .visitedUrls,
        modelUsage:
          attempt.workerResult
            .modelUsage,
        humanBaselineMinutes:
          attempt.humanBaselineMinutes,
        humanReviewMinutes:
          attempt.humanReviewMinutes,
        reviewType:
          attempt.reviewType,
        proxyBypassList:
          environment
            .proxyBypassList,
        storeRoot
      },
      null,
      2
    ) +
      "\n"
  );
} finally {
  if (
    environment !==
      undefined
  ) {
    await environment.close();
  }

  await new Promise<void>(
    (resolveClose) =>
      server.close(
        () =>
          resolveClose()
      )
  );
}
