import {
  expect,
  test
} from "vitest";

import {
  AgentLoopExecutor,
  type AgentLoopPolicy
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
  BrowserRuntime,
  BrowserSession
} from "@astra/browser-runtime";
import {
  InMemoryArtifactStore
} from "../../artifact-store/src/index.js";

import {
  InMemoryRunRepository,
  RunEngine,
  type RunTerminalUpdate
} from "../src/index.js";

class FixtureBrowser
  implements BrowserSession {
  public readonly id =
    "gate10-browser";
  public readonly cdpUrl =
    "ws://fixture/gate10";
  public closeCalls = 0;

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class FixtureBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new FixtureBrowser();

  public async createSession():
    Promise<BrowserSession> {
    return this.session;
  }
}

interface FixtureAgentOptions {
  navigate?(
    signal:
      AbortSignal | undefined
  ): Promise<void>;
  observe?():
    Promise<AgentAction[]>;
  act?(
    action: AgentAction
  ): Promise<AgentActionResult>;
  extraction?: unknown;
}

class FixtureAgent
  implements AgentSession {
  public closeCalls = 0;
  public actCalls = 0;
  public navigateStarted = false;

  public constructor(
    private readonly options:
      FixtureAgentOptions = {}
  ) {}

  public async navigate(
    url: string,
    operation:
      AgentOperationOptions = {}
  ): Promise<void> {
    void url;
    this.navigateStarted = true;
    await this.options.navigate?.(
      operation.signal
    );
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;

    if (
      this.options.observe !==
      undefined
    ) {
      return this.options.observe();
    }

    return [
      {
        selector: "#next",
        description: "Next",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    if (
      this.options.act !==
      undefined
    ) {
      return this.options.act(
        action
      );
    }

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

    return schema.parse(
      this.options.extraction ??
        {}
    );
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}


class FailingCancellationEventRepository
  extends InMemoryRunRepository {
  public override async appendEvent(
    runId: string,
    eventType: string,
    payload: unknown
  ) {
    if (
      eventType ===
      "RUN_CANCELLATION_REQUESTED"
    ) {
      throw new Error(
        "telemetry unavailable"
      );
    }

    return super.appendEvent(
      runId,
      eventType,
      payload
    );
  }
}

class FailOnceTerminalRepository
  extends InMemoryRunRepository {
  #remainingFailures = 1;

  public override async finalizeRun(
    runId: string,
    update: RunTerminalUpdate,
    eventPayload: unknown
  ) {
    if (
      this.#remainingFailures >
      0
    ) {
      this.#remainingFailures -= 1;
      throw new Error(
        "injected terminal persistence failure"
      );
    }

    return super.finalizeRun(
      runId,
      update,
      eventPayload
    );
  }
}

class FixtureAgentRuntime
  implements AgentRuntime {
  public constructor(
    public readonly session:
      FixtureAgent
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
    "Gate 10 fixture did not finish."
  );
}

async function waitForNavigate(
  session: FixtureAgent
): Promise<void> {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    if (session.navigateStarted) {
      return;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 2);
      }
    );
  }

  throw new Error(
    "Navigation did not start."
  );
}

function abortWait(
  signal:
    AbortSignal | undefined
): Promise<void> {
  if (signal === undefined) {
    throw new Error(
      "Expected abort signal."
    );
  }

  return new Promise(
    (resolve, reject) => {
      void resolve;

      if (signal.aborted) {
        reject(signal.reason);
        return;
      }

      signal.addEventListener(
        "abort",
        () => {
          reject(signal.reason);
        },
        {
          once: true
        }
      );
    }
  );
}

test("successful action alone cannot complete without a verifier", async () => {
  const browser =
    new FixtureBrowserRuntime();
  const agent =
    new FixtureAgent();
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime: browser,
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        )
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal: "Act once."
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
  expect(terminal.error?.code).toBe(
    "COMPLETION_REJECTED"
  );
  expect(
    terminal.goalStatus
  ).toBe("FAILED");
  expect(agent.actCalls).toBe(1);
  expect(agent.closeCalls).toBe(1);
  expect(
    browser.session.closeCalls
  ).toBe(1);
});

test("completion verifier rejects wrong but schema-valid output", async () => {
  const agent =
    new FixtureAgent({
      extraction: {
        status: "wrong"
      }
    });
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new FixtureBrowserRuntime(),
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      completionVerifier: {
        verify({ result }) {
          return {
            verified:
              (
                result as {
                  status?: unknown;
                }
              ).status === "right",
            message:
              "Expected status right."
          };
        }
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Return verified status."
      },
      outputSchema: {
        parse(input) {
          const value =
            input as {
              status?: unknown;
            };

          if (
            typeof value.status !==
            "string"
          ) {
            throw new TypeError(
              "status must be a string"
            );
          }

          return {
            status: value.status
          };
        }
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
  expect(terminal.error?.code).toBe(
    "COMPLETION_REJECTED"
  );
});

test(
  "terminal persistence rejection is supervised without a contradictory completion event",
  async () => {
    const repository =
      new FailOnceTerminalRepository();
    const engine =
      new RunEngine({
        repository,
        browserRuntime:
          new FixtureBrowserRuntime(),
        agentRuntime:
          new FixtureAgentRuntime(
            new FixtureAgent({
              extraction: {
                status: "right"
              }
            })
          ),
        completionVerifier: {
          verify({ result }) {
            return {
              verified:
                (
                  result as {
                    status?: unknown;
                  }
                ).status ===
                "right",
              message:
                "Expected status right."
            };
          }
        }
      });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/",
          goal:
            "Return verified status."
        },
        outputSchema: {
          parse(input) {
            const value =
              input as {
                status?: unknown;
              };

            if (
              typeof value.status !==
              "string"
            ) {
              throw new TypeError(
                "status must be a string"
              );
            }

            return {
              status:
                value.status
            };
          }
        }
      });
    const terminal =
      await waitForTerminal(
        engine,
        started.id
      );

    expect(
      terminal.status
    ).toBe("FAILED");
    expect(
      terminal.error
    ).toEqual({
      code:
        "EXECUTION_FAILED",
      message:
        "Run execution could not persist its intended terminal state."
    });

    const events =
      await repository.listEvents(
        started.id
      );

    expect(
      events.some(
        (event) =>
          event.eventType ===
          "RUN_COMPLETED"
      )
    ).toBe(false);
    expect(
      events.at(-1)?.eventType
    ).toBe("RUN_FAILED");
  }
);

test("wall-clock timeout aborts execution and still cleans resources", async () => {
  const browser =
    new FixtureBrowserRuntime();
  const agent =
    new FixtureAgent({
      navigate: abortWait
    });
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime: browser,
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      executionBudget: {
        maxDurationMs: 20
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal: "Wait forever."
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
  expect(terminal.error?.code).toBe(
    "RUN_TIMEOUT"
  );
  expect(agent.closeCalls).toBe(1);
  expect(
    browser.session.closeCalls
  ).toBe(1);
});

test("explicit cancellation becomes durable and cleans resources", async () => {
  const repository =
    new InMemoryRunRepository();
  const browser =
    new FixtureBrowserRuntime();
  const agent =
    new FixtureAgent({
      navigate: abortWait
    });
  const engine =
    new RunEngine({
      repository,
      browserRuntime: browser,
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        )
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Cancel this run."
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
    terminal.terminalReason?.code
  ).toBe("RUN_CANCELLED");
  expect(agent.closeCalls).toBe(1);
  expect(
    browser.session.closeCalls
  ).toBe(1);

  const events =
    await repository.listEvents(
      started.id
    );
  expect(
    events.map(
      (event) =>
        event.eventType
    )
  ).toContain(
    "RUN_CANCELLATION_REQUESTED"
  );
  expect(
    events.at(-1)?.eventType
  ).toBe("RUN_CANCELLED");
});

test("model cost budget failure is durable", async () => {
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new FixtureBrowserRuntime(),
      agentRuntime:
        new FixtureAgentRuntime(
          new FixtureAgent()
        ),
      executionBudget: {
        maxModelCostUsd: 0.5
      },
      createUsageMeter() {
        return {
          snapshot() {
            return {
              modelTokens: 100,
              modelCostUsd: 0.51
            };
          }
        };
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Respect cost budget."
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
  expect(terminal.error?.code).toBe(
    "MODEL_COST_BUDGET_EXCEEDED"
  );
  expect(
    terminal.terminalReason?.code
  ).toBe(
    "MODEL_COST_BUDGET_EXCEEDED"
  );
});

test("step limit terminates owned loop before an extra action", async () => {
  const agent =
    new FixtureAgent();
  const policy:
    AgentLoopPolicy = {
      async decide() {
        return {
          type: "ACTION",
          actionIndex: 0,
          rationale:
            "Keep acting.",
          onFailure: "FAIL",
          effectRisk:
            "REVERSIBLE"
        };
      }
    };
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new FixtureBrowserRuntime(),
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      agentLoop:
        new AgentLoopExecutor({
          policy,
          iterationCeiling: 5
        }),
      executionBudget: {
        maxActions: 1,
        repeatedActionLimit: 5
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Respect step limit."
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
  expect(terminal.error?.code).toBe(
    "STEP_LIMIT_EXCEEDED"
  );
  expect(agent.actCalls).toBe(1);
});

test("unknown irreversible effect becomes BLOCKED and is not retried", async () => {
  const agent =
    new FixtureAgent({
      async act() {
        throw new Error(
          "provider timeout after commit boundary"
        );
      }
    });
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new FixtureBrowserRuntime(),
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide() {
              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Attempt once.",
                onFailure:
                  "CONTINUE",
                effectRisk:
                  "IRREVERSIBLE"
              };
            }
          }
        })
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Do not duplicate."
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
    terminal.goalStatus
  ).toBe("BLOCKED");
  expect(terminal.error?.code).toBe(
    "IRREVERSIBLE_EFFECT_UNKNOWN"
  );
  expect(agent.actCalls).toBe(1);
});

test("loop detection becomes a typed durable failure", async () => {
  const agent =
    new FixtureAgent();
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new FixtureBrowserRuntime(),
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide() {
              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Repeat.",
                onFailure: "FAIL",
                effectRisk:
                  "REVERSIBLE"
              };
            }
          }
        }),
      executionBudget: {
        maxActions: 5,
        repeatedActionLimit: 1
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Detect the loop."
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
  expect(terminal.error?.code).toBe(
    "LOOP_DETECTED"
  );
  expect(
    terminal.terminalReason?.code
  ).toBe("LOOP_DETECTED");
  expect(agent.actCalls).toBe(1);
});

test("wall-clock timeout interrupts a policy that never resolves", async () => {
  const browser =
    new FixtureBrowserRuntime();
  const agent =
    new FixtureAgent();
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime: browser,
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        ),
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            decide() {
              return new Promise(
                () => undefined
              );
            }
          }
        }),
      executionBudget: {
        maxDurationMs: 20
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Bound a hung policy."
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
  expect(terminal.error?.code).toBe(
    "RUN_TIMEOUT"
  );
  expect(agent.closeCalls).toBe(1);
  expect(
    browser.session.closeCalls
  ).toBe(1);
});

test("cancellation still aborts when cancellation-request telemetry fails", async () => {
  const browser =
    new FixtureBrowserRuntime();
  const agent =
    new FixtureAgent({
      navigate: abortWait
    });
  const engine =
    new RunEngine({
      repository:
        new FailingCancellationEventRepository(),
      browserRuntime: browser,
      agentRuntime:
        new FixtureAgentRuntime(
          agent
        )
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/",
        goal:
          "Cancel despite telemetry failure."
      }
    });

  await waitForNavigate(agent);

  await expect(
    engine.cancelRun(started.id)
  ).rejects.toThrow(
    "telemetry unavailable"
  );

  const terminal =
    await waitForTerminal(
      engine,
      started.id
    );

  expect(terminal.status).toBe(
    "CANCELLED"
  );
  expect(agent.closeCalls).toBe(1);
  expect(
    browser.session.closeCalls
  ).toBe(1);
});

interface ScreenshotSettleState {
  actionFinished: boolean;
  observedAfterAction: boolean;
}

class SettlingScreenshotBrowser
  implements BrowserSession {
  public readonly id =
    "settling-browser";
  public readonly cdpUrl =
    "ws://fixture/settling";

  public constructor(
    private readonly state:
      ScreenshotSettleState
  ) {}

  public async captureScreenshot():
    Promise<Uint8Array> {
    if (
      this.state.actionFinished &&
      !this.state.observedAfterAction
    ) {
      throw new Error(
        "page is still navigating"
      );
    }

    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  }

  public async close():
    Promise<void> {}
}

class SettlingScreenshotAgent
  implements AgentSession {
  public constructor(
    private readonly state:
      ScreenshotSettleState
  ) {}

  public async navigate():
    Promise<void> {}

  public async observe():
    Promise<AgentAction[]> {
    if (this.state.actionFinished) {
      this.state.observedAfterAction =
        true;
      return [];
    }

    return [
      {
        selector: "#next",
        description:
          "Navigate to the next page",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.state.actionFinished = true;

    return {
      success: true,
      message: "navigated",
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
    Promise<void> {}
}

test("loop screenshots wait for the next stable observation after navigation", async () => {
  const state:
    ScreenshotSettleState = {
      actionFinished: false,
      observedAfterAction: false
    };
  const artifactStore =
    new InMemoryArtifactStore();
  const engine =
    new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime: {
        async createSession() {
          return new SettlingScreenshotBrowser(
            state
          );
        }
      },
      agentRuntime: {
        async openSession() {
          return new SettlingScreenshotAgent(
            state
          );
        }
      },
      artifactStore,
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide(input) {
              if (
                input.trajectory.length ===
                0
              ) {
                return {
                  type: "ACTION",
                  actionIndex: 0,
                  rationale:
                    "Navigate once.",
                  onFailure: "FAIL",
                  effectRisk:
                    "REVERSIBLE"
                };
              }

              return {
                type: "COMPLETE",
                rationale:
                  "The destination page was observed.",
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
              "Destination observation verified."
          };
        }
      }
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/start",
        goal:
          "Navigate and verify."
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
    state.observedAfterAction
  ).toBe(true);

  const names =
    (
      await engine.listArtifacts(
        started.id
      )
    ).map(
      (artifact) => artifact.name
    );

  expect(names).toContain(
    "loop-01-after-action.jpg"
  );
});
