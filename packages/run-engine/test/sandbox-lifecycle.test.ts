import {
  expect,
  test
} from "vitest";

import {
  AgentLoopExecutor
} from "@astra/agent-loop";
import type {
  AgentAction,
  AgentActionResult,
  AgentOperationOptions,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  BrowserNetworkPolicy,
  BrowserRuntime,
  BrowserSession
} from "@astra/browser-runtime";
import {
  SandboxedBrowserRuntime,
  type SandboxRuntime,
  type SandboxSession,
  type SandboxStatus
} from "../../sandbox-runtime/src/index.js";

import {
  InMemoryRunRepository,
  RunEngine
} from "../src/index.js";

class UnderlyingBrowser
  implements BrowserSession {
  public readonly id =
    "sandbox-browser";
  public readonly cdpUrl =
    "ws://fixture/sandbox";
  public closeCalls = 0;

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class UnderlyingBrowserRuntime
  implements BrowserRuntime {
  public readonly browser =
    new UnderlyingBrowser();

  public async createSession():
    Promise<BrowserSession> {
    return this.browser;
  }
}

class RecordingSandbox
  implements SandboxSession {
  public readonly id =
    "sandbox-isolation-1";
  public readonly networkPolicy:
    BrowserNetworkPolicy = {
      domainPolicy: {
        allowedDomains: [
          "fixture.test"
        ]
      },
      async assertAllowed() {}
    };
  public closeCalls = 0;
  #status: SandboxStatus =
    "ACTIVE";

  public get status():
    SandboxStatus {
    return this.#status;
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
    this.#status =
      "CLOSED";
  }
}

class RecordingSandboxRuntime
  implements SandboxRuntime {
  public readonly session =
    new RecordingSandbox();

  public async createSession():
    Promise<SandboxSession> {
    return this.session;
  }
}

class LifecycleAgent
  implements AgentSession {
  public navigateStarted = false;
  public closeCalls = 0;

  public constructor(
    private readonly navigateImpl?:
      (
        signal:
          AbortSignal | undefined
      ) => Promise<void>
  ) {}

  public async navigate(
    url: string,
    options:
      AgentOperationOptions = {}
  ): Promise<void> {
    void url;
    this.navigateStarted = true;
    await this.navigateImpl?.(
      options.signal
    );
  }

  public async observe():
    Promise<AgentAction[]> {
    return [];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: true,
      message: "acted",
      actions: [action],
      effect: "committed"
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({});
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class LifecycleAgentRuntime
  implements AgentRuntime {
  public constructor(
    public readonly session:
      LifecycleAgent
  ) {}

  public async openSession(
    options:
      OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return this.session;
  }
}

async function waitForTerminal(
  engine: RunEngine,
  runId: string
) {
  for (
    let attempt = 0;
    attempt < 200;
    attempt += 1
  ) {
    const run =
      await engine.getRun(runId);

    if (
      run?.status ===
        "COMPLETED" ||
      run?.status ===
        "FAILED" ||
      run?.status ===
        "CANCELLED"
    ) {
      return run;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 5);
      }
    );
  }

  throw new Error(
    "Sandbox lifecycle run did not finish."
  );
}

async function waitForNavigate(
  agent: LifecycleAgent
): Promise<void> {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    if (agent.navigateStarted) {
      return;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 2);
      }
    );
  }

  throw new Error(
    "Sandbox lifecycle navigation did not start."
  );
}

function runtimeFixture(
  agent:
    LifecycleAgent
) {
  const sandbox =
    new RecordingSandboxRuntime();
  const browser =
    new UnderlyingBrowserRuntime();
  const repository =
    new InMemoryRunRepository();
  const engine =
    new RunEngine({
      repository,
      browserRuntime:
        new SandboxedBrowserRuntime({
          sandboxRuntime:
            sandbox,
          browserRuntime:
            browser
        }),
      agentRuntime:
        new LifecycleAgentRuntime(
          agent
        ),
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide() {
              return {
                type: "COMPLETE",
                rationale:
                  "Fixture completed.",
                result: {
                  done: true
                }
              };
            }
          }
        }),
      completionVerifier: {
        verify({ result }) {
          return {
            verified:
              (
                result as {
                  done?: unknown;
                }
              ).done === true,
            message:
              "Fixture completion verified."
          };
        }
      }
    });

  return {
    engine,
    repository,
    sandbox,
    browser
  };
}

test("RunEngine closes sandbox after successful completion and persists isolation id", async () => {
  const agent =
    new LifecycleAgent();
  const {
    engine,
    repository,
    sandbox,
    browser
  } = runtimeFixture(agent);

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Complete safely."
      }
    });
  const terminal =
    await waitForTerminal(
      engine,
      started.id
    );

  expect(terminal.status).toBe(
    "COMPLETED"
  );
  expect(
    sandbox.session.status
  ).toBe("CLOSED");
  expect(
    sandbox.session.closeCalls
  ).toBe(1);
  expect(
    browser.browser.closeCalls
  ).toBe(1);

  const createdStep =
    (
      await repository.listSteps(
        started.id
      )
    ).find(
      (step) =>
        step.kind ===
        "BROWSER_CREATED"
    );

  expect(
    createdStep?.payload
  ).toMatchObject({
    browserId:
      "sandbox-browser",
    isolationId:
      "sandbox-isolation-1"
  });
});

test("RunEngine closes sandbox after execution failure", async () => {
  const agent =
    new LifecycleAgent(
      async () => {
        throw new Error(
          "fixture navigation failed"
        );
      }
    );
  const {
    engine,
    sandbox,
    browser
  } = runtimeFixture(agent);

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Fail safely."
      }
    });
  const terminal =
    await waitForTerminal(
      engine,
      started.id
    );

  expect(terminal.status).toBe(
    "FAILED"
  );
  expect(
    sandbox.session.status
  ).toBe("CLOSED");
  expect(
    sandbox.session.closeCalls
  ).toBe(1);
  expect(
    browser.browser.closeCalls
  ).toBe(1);
});

test("RunEngine closes sandbox after cancellation", async () => {
  const agent =
    new LifecycleAgent(
      (signal) =>
        new Promise<void>(
          (resolve, reject) => {
            if (signal?.aborted) {
              reject(
                signal.reason
              );
              return;
            }

            signal?.addEventListener(
              "abort",
              () => {
                reject(
                  signal.reason
                );
              },
              {
                once: true
              }
            );
            void resolve;
          }
        )
    );
  const {
    engine,
    sandbox,
    browser
  } = runtimeFixture(agent);

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Cancel safely."
      }
    });

  await waitForNavigate(agent);
  await engine.cancelRun(
    started.id
  );
  const terminal =
    await waitForTerminal(
      engine,
      started.id
    );

  expect(terminal.status).toBe(
    "CANCELLED"
  );
  expect(
    sandbox.session.status
  ).toBe("CLOSED");
  expect(
    sandbox.session.closeCalls
  ).toBe(1);
  expect(
    browser.browser.closeCalls
  ).toBe(1);
});
