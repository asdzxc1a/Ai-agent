import { createHash } from "node:crypto";

import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  BrowserDiagnostic,
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";
import { expect, test } from "vitest";

import {
  InMemoryArtifactStore
} from "../../artifact-store/src/index.js";
import {
  InMemoryRunRepository
} from "../src/in-memory-repository.js";
import {
  RunEngine
} from "../src/run-engine.js";

class EvidenceBrowserSession
  implements BrowserSession {
  public readonly id = "browser-evidence";
  public readonly cdpUrl =
    "ws://browser.test/evidence";
  public diagnosticCalls = 0;

  public async captureScreenshot(): Promise<Uint8Array> {
    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  }

  public async getDiagnostics(): Promise<BrowserDiagnostic[]> {
    this.diagnosticCalls += 1;

    return [
      {
        kind: "console",
        level: "error",
        message:
          "token=super-secret Authorization=Bearer abc123",
        url:
          "https://fixture.test/?password=hunter2"
      },
      {
        kind: "page-error",
        message: "fixture exploded"
      }
    ];
  }

  public async close(): Promise<void> {}
}

class EvidenceBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new EvidenceBrowserSession();

  public async createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    void options;
    return this.session;
  }
}

class FailingAgentSession
  implements AgentSession {
  public async navigate(
    url: string
  ): Promise<void> {
    void url;
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;
    return [
      {
        selector: "xpath=//button",
        description: "Danger button",
        method: "click",
        arguments: [
          "plain-argument-should-not-appear",
          "password=hunter2"
        ]
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: false,
      message:
        "action failed token=super-secret",
      actionDescription:
        action.description,
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({});
  }

  public async close(): Promise<void> {}
}

class FailingAgentRuntime
  implements AgentRuntime {
  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return new FailingAgentSession();
  }
}

async function waitForTerminal(
  engine: RunEngine,
  runId: string
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await engine.getRun(runId);

    if (
      run?.status === "FAILED" ||
      run?.status === "COMPLETED"
    ) {
      return run;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }

  throw new Error(
    "Artifact fixture did not finish."
  );
}

test("failed run leaves redacted debugging artifacts", async () => {
  const artifactStore =
    new InMemoryArtifactStore();
  const engine = new RunEngine({
    repository: new InMemoryRunRepository(),
    browserRuntime:
      new EvidenceBrowserRuntime(),
    agentRuntime:
      new FailingAgentRuntime(),
    artifactStore
  });

  const started = await engine.createRun({
    request: {
      url:
        "https://fixture.test/?token=url-secret",
      goal: "Click the dangerous button."
    }
  });

  const terminal = await waitForTerminal(
    engine,
    started.id
  );

  expect(terminal.status).toBe("FAILED");
  expect(terminal.error?.code).toBe(
    "ACTION_FAILED"
  );

  const artifacts =
    await engine.listArtifacts(started.id);

  expect(
    artifacts.some(
      (artifact) =>
        artifact.name === "failure.jpg"
    )
  ).toBe(true);
  expect(
    artifacts.some(
      (artifact) =>
        artifact.name ===
        "browser-diagnostics.json"
    )
  ).toBe(true);

  const summaryRecord = artifacts.find(
    (artifact) =>
      artifact.name === "run-summary.json"
  );

  expect(summaryRecord).toBeDefined();

  const summary =
    await engine.readArtifact(
      started.id,
      summaryRecord!.id
    );

  const summaryText =
    new TextDecoder().decode(
      summary!.data
    );

  expect(summaryText).toContain(
    "ACTION_FAILED"
  );
  expect(summaryText).not.toContain(
    "hunter2"
  );
  expect(summaryText).not.toContain(
    "super-secret"
  );
  expect(summaryText).not.toContain(
    "url-secret"
  );
  expect(summaryText).not.toContain(
    "plain-argument-should-not-appear"
  );

  const diagnosticsRecord =
    artifacts.find(
      (artifact) =>
        artifact.name ===
        "browser-diagnostics.json"
    );

  const diagnostics =
    await engine.readArtifact(
      started.id,
      diagnosticsRecord!.id
    );

  const diagnosticsText =
    new TextDecoder().decode(
      diagnostics!.data
    );

  expect(diagnosticsText).toContain(
    "fixture exploded"
  );
  expect(diagnosticsText).not.toContain(
    "hunter2"
  );
  expect(diagnosticsText).not.toContain(
    "super-secret"
  );
});

test("does not request browser diagnostics when artifact collection is disabled", async () => {
  const browserRuntime =
    new EvidenceBrowserRuntime();
  const engine = new RunEngine({
    repository: new InMemoryRunRepository(),
    browserRuntime,
    agentRuntime: new FailingAgentRuntime()
  });

  const started = await engine.createRun({
    request: {
      url: "https://fixture.test/",
      goal: "Fail without collecting artifacts."
    }
  });

  await waitForTerminal(engine, started.id);

  expect(
    browserRuntime.session.diagnosticCalls
  ).toBe(0);
});

test("configured artifact store captures successful lifecycle evidence", async () => {
  const artifactStore = new InMemoryArtifactStore();
  const repository =
    new InMemoryRunRepository();
  const engine = new RunEngine({
    repository,
    browserRuntime: new EvidenceBrowserRuntime(),
    agentRuntime: {
      async openSession() {
        return {
          async navigate() {},
          async observe() {
            return [
              {
                selector: "xpath=//button",
                description: "Safe button",
                method: "click",
                arguments: [
                  "plain-success-argument"
                ]
              }
            ];
          },
          async act(action) {
            return {
              success: true,
              message: "ok",
              actionDescription:
                action.description,
              actions: [action]
            };
          },
          async extract<T>(
            instruction: string,
            schema: RuntimeSchema<T>
          ): Promise<T> {
            void instruction;
            return schema.parse({});
          },
          async capturePageEvidence() {
            return {
              url:
                "https://fixture.test/evidence",
              title:
                "Fixture evidence",
              text:
                "Visible page evidence that should only be hashed."
            };
          },
          async getModelUsage() {
            return {
              promptTokens: 120,
              completionTokens: 30,
              reasoningTokens: 5,
              cachedInputTokens: 40,
              inferenceTimeMs: 275
            };
          },
          async close() {}
        };
      }
    },
    artifactStore,
    completionVerifier: {
      verify() {
        return {
          verified: true,
          message:
            "Fixture completion verified."
        };
      }
    }
  });

  const started = await engine.createRun({
    request: {
      url:
        "https://fixture.test/?token=success-secret",
      goal: "Click safe."
    }
  });

  const terminal = await waitForTerminal(
    engine,
    started.id
  );

  expect(terminal.status).toBe("COMPLETED");

  const artifacts =
    await engine.listArtifacts(started.id);
  const names = artifacts.map(
    (artifact) => artifact.name
  );

  expect(names).toContain(
    "after-navigation.jpg"
  );
  expect(names).toContain("after-action.jpg");
  expect(names).toContain(
    "browser-diagnostics.json"
  );
  expect(names).toContain("run-summary.json");

  const navigationScreenshot =
    artifacts.find(
      (artifact) =>
        artifact.name ===
        "after-navigation.jpg"
    );

  expect(
    navigationScreenshot
      ?.metadata
  ).toMatchObject({
    captureVersion:
      "page-evidence-v1",
    semanticSettled:
      false,
    pageUrl:
      "https://fixture.test/evidence",
    pageTitle:
      "Fixture evidence",
    pageContentSha256:
      createHash(
        "sha256"
      )
        .update(
          "Visible page evidence that should only be hashed."
        )
        .digest("hex"),
    screenshotSha256:
      createHash(
        "sha256"
      )
        .update(
          new Uint8Array([
            0xff,
            0xd8,
            0xff,
            0xd9
          ])
        )
        .digest("hex")
  });
  expect(
    JSON.stringify(
      navigationScreenshot
        ?.metadata
    )
  ).not.toContain(
    "Visible page evidence"
  );

  const summaryRecord = artifacts.find(
    (artifact) =>
      artifact.name === "run-summary.json"
  );
  const summary = await engine.readArtifact(
    started.id,
    summaryRecord!.id
  );
  const summaryText = new TextDecoder().decode(
    summary!.data
  );

  expect(summaryText).toContain("Safe button");
  expect(summaryText).toContain("xpath=//button");
  expect(summaryText).toContain("click");
  expect(
    JSON.parse(
      summaryText
    )
  ).toMatchObject({
    modelUsage: {
      promptTokens: 120,
      completionTokens: 30,
      reasoningTokens: 5,
      cachedInputTokens: 40,
      inferenceTimeMs: 275
    }
  });

  const usageStep =
    (
      await repository.listSteps(
        started.id
      )
    ).find(
      (step) =>
        step.kind ===
          "AGENT_MODEL_USAGE"
    );

  expect(
    usageStep?.payload
  ).toEqual({
    promptTokens: 120,
    completionTokens: 30,
    reasoningTokens: 5,
    cachedInputTokens: 40,
    inferenceTimeMs: 275
  });
  expect(summaryText).not.toContain(
    "plain-success-argument"
  );
  expect(summaryText).not.toContain(
    "success-secret"
  );
});

test("artifact-store failures do not change successful run result", async () => {
  const engine = new RunEngine({
    repository: new InMemoryRunRepository(),
    browserRuntime: {
      async createSession() {
        return new EvidenceBrowserSession();
      }
    },
    agentRuntime: {
      async openSession() {
        return {
          async navigate() {},
          async observe() {
            return [
              {
                selector: "xpath=//button",
                description: "Safe button",
                method: "click"
              }
            ];
          },
          async act(action) {
            return {
              success: true,
              message: "ok",
              actions: [action]
            };
          },
          async extract<T>(
            instruction: string,
            schema: RuntimeSchema<T>
          ): Promise<T> {
            void instruction;
            return schema.parse({});
          },
          async close() {}
        };
      }
    },
    artifactStore: {
      async putArtifact() {
        throw new Error("disk full");
      },
      async putJsonArtifact() {
        throw new Error("disk full");
      },
      async listArtifacts() {
        return [];
      },
      async readArtifact() {
        return undefined;
      }
    },
    completionVerifier: {
      verify() {
        return {
          verified: true,
          message:
            "Fixture completion verified."
        };
      }
    }
  });

  const started = await engine.createRun({
    request: {
      url: "https://fixture.test/",
      goal: "Click safe."
    }
  });

  const terminal = await waitForTerminal(
    engine,
    started.id
  );

  expect(terminal.status).toBe(
    "COMPLETED"
  );
});
