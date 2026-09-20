import {
  expect,
  test
} from "vitest";

import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import {
  AgentLoopExecutor
} from "@astra/agent-loop";
import {
  InMemoryArtifactStore
} from "@astra/artifact-store";
import type {
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";

import {
  InMemoryRunRepository,
  RunEngine
} from "../src/index.js";

class LoopBrowserSession
  implements BrowserSession {
  public readonly id =
    "loop-browser";
  public readonly cdpUrl =
    "ws://browser.test/loop";
  public closeCalls = 0;

  public async captureScreenshot():
    Promise<Uint8Array> {
    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class LoopBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new LoopBrowserSession();

  public async createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    void options;
    return this.session;
  }
}

class LoopAgentSession
  implements AgentSession {
  public closeCalls = 0;
  public observeCalls = 0;
  public actCalls = 0;

  public async navigate(
    url: string
  ): Promise<void> {
    void url;
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;
    this.observeCalls += 1;

    return [
      {
        selector: "#primary",
        description:
          "Primary research action",
        method: "click"
      },
      {
        selector: "#recovery",
        description:
          "Recovery research action",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    return {
      success:
        this.actCalls > 1,
      message:
        this.actCalls > 1
          ? "recovery succeeded"
          : "recoverable failure token=loop-secret",
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

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class LoopAgentRuntime
  implements AgentRuntime {
  public readonly session =
    new LoopAgentSession();

  public async openSession(
    options: OpenAgentSessionOptions
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
    attempt < 100;
    attempt += 1
  ) {
    const run =
      await engine.getRun(runId);

    if (
      run?.status === "COMPLETED" ||
      run?.status === "FAILED"
    ) {
      return run;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }

  throw new Error(
    "Loop fixture did not reach a terminal state."
  );
}

test(
  "RunEngine persists recoverable multi-step progress without corrupting history",
  async () => {
    const repository =
      new InMemoryRunRepository();
    const browserRuntime =
      new LoopBrowserRuntime();
    const agentRuntime =
      new LoopAgentRuntime();
    const artifactStore =
      new InMemoryArtifactStore();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      artifactStore,
      agentLoop:
        new AgentLoopExecutor({
          iterationCeiling: 5,
          policy: {
            async decide(input) {
              const last =
                input.trajectory.at(-1);

              if (
                last?.actionOutcome
                  ?.success === false
              ) {
                return {
                  type: "ACTION",
                  actionIndex: 1,
                  rationale:
                    "Recover from the recorded action failure."
                };
              }

              if (
                last?.actionOutcome
                  ?.success === true
              ) {
                return {
                  type: "COMPLETE",
                  rationale:
                    "The recovery observation confirms progress is complete."
                };
              }

              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Begin the research sequence."
              };
            }
          }
        })
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/research",
          goal:
            "Complete the deterministic research sequence."
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
    expect(terminal.result).toEqual({
      completed: true,
      iterations: 3
    });

    const steps =
      await repository.listSteps(
        started.id
      );
    const actionSteps =
      steps.filter(
        (step) =>
          step.kind ===
          "AGENT_LOOP_ACTION"
      );
    const decisionSteps =
      steps.filter(
        (step) =>
          step.kind ===
          "AGENT_LOOP_DECISION"
      );

    expect(
      actionSteps.map(
        (step) =>
          (
            step.payload as {
              success: boolean;
            }
          ).success
      )
    ).toEqual([
      false,
      true
    ]);

    const failedActionPayload =
      actionSteps[0]
        ?.payload as {
        message?: string;
      };

    expect(
      failedActionPayload.message
    ).toContain(
      "recoverable failure"
    );
    expect(
      failedActionPayload.message
    ).toContain("[REDACTED]");
    expect(
      failedActionPayload.message
    ).not.toContain(
      "loop-secret"
    );

    expect(
      decisionSteps.map(
        (step) =>
          (
            step.payload as {
              decision: {
                type: string;
              };
            }
          ).decision.type
      )
    ).toEqual([
      "ACTION",
      "ACTION",
      "COMPLETE"
    ]);

    expect(
      (
        decisionSteps[1]
          ?.payload as {
          decision: {
            rationale: string;
          };
        }
      ).decision.rationale
    ).toMatch(/Recover/);

    expect(
      steps.map(
        (step) =>
          step.sequenceNumber
      )
    ).toEqual(
      steps.map(
        (_, index) => index + 1
      )
    );

    const events =
      await repository.listEvents(
        started.id
      );

    expect(
      events.at(-1)?.eventType
    ).toBe("RUN_COMPLETED");
    expect(
      new Set(
        events.map(
          (event) =>
            event.sequenceNumber
        )
      ).size
    ).toBe(events.length);

    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session.closeCalls
    ).toBe(1);

    const artifactNames =
      (
        await engine.listArtifacts(
          started.id
        )
      ).map(
        (artifact) =>
          artifact.name
      );

    expect(artifactNames).toContain(
      "loop-01-after-action.jpg"
    );
    expect(artifactNames).toContain(
      "loop-02-after-action.jpg"
    );
    expect(artifactNames).toContain(
      "run-summary.json"
    );
  }
);

test.each([
  [
    "BLOCKED",
    "AGENT_BLOCKED"
  ],
  [
    "FAIL",
    "AGENT_LOOP_FAILED"
  ]
] as const)(
  "%s loop decisions become explicit failed run outcomes",
  async (
    decisionType,
    expectedCode
  ) => {
    const repository =
      new InMemoryRunRepository();
    const browserRuntime =
      new LoopBrowserRuntime();
    const agentRuntime =
      new LoopAgentRuntime();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide() {
              return {
                type: decisionType,
                message:
                  "deterministic terminal decision"
              };
            }
          }
        })
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/research",
          goal:
            "Reach an explicit terminal state."
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
      terminal.error?.code
    ).toBe(expectedCode);

    const steps =
      await repository.listSteps(
        started.id
      );
    expect(
      steps.find(
        (step) =>
          step.kind ===
          "AGENT_LOOP_RESULT"
      )?.payload
    ).toEqual({
      kind: decisionType,
      iterations: 1
    });

    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session.closeCalls
    ).toBe(1);
  }
);

test(
  "successful actions and loop COMPLETE do not complete a run when goal verification fails",
  async () => {
    const repository =
      new InMemoryRunRepository();
    const engine = new RunEngine({
      repository,
      browserRuntime:
        new LoopBrowserRuntime(),
      agentRuntime:
        new LoopAgentRuntime(),
      agentLoop:
        new AgentLoopExecutor({
          policy: {
            async decide(input) {
              const last =
                input.trajectory.at(-1);

              if (
                last?.actionOutcome
                  ?.success === false
              ) {
                return {
                  type: "ACTION",
                  actionIndex: 1,
                  rationale:
                    "Recover before verifying the goal."
                };
              }

              if (
                last?.actionOutcome
                  ?.success === true
              ) {
                return {
                  type: "COMPLETE",
                  rationale:
                    "The loop believes the interaction is complete."
                };
              }

              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Start the interaction."
              };
            }
          }
        })
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/research",
          goal:
            "Verify the research result."
        },
        outputSchema: {
          parse() {
            throw new Error(
              "goal verification failed"
            );
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
    expect(
      terminal.error?.code
    ).toBe("EXECUTION_FAILED");
    expect(
      terminal.error?.message
    ).toBe(
      "goal verification failed"
    );

    const steps =
      await repository.listSteps(
        started.id
      );
    const successfulAction =
      steps.find(
        (step) =>
          step.kind ===
            "AGENT_LOOP_ACTION" &&
          (
            step.payload as {
              success: boolean;
            }
          ).success
      );

    expect(
      successfulAction
    ).toBeDefined();
    expect(
      steps.find(
        (step) =>
          step.kind ===
          "AGENT_LOOP_RESULT"
      )?.payload
    ).toEqual({
      kind: "COMPLETE",
      iterations: 3
    });

    const events =
      await repository.listEvents(
        started.id
      );

    expect(
      events.at(-1)?.eventType
    ).toBe("RUN_FAILED");
  }
);
