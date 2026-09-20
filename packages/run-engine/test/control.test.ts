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
  InMemoryRunRepository,
  RunEngine
} from "../src/index.js";

class ControlBrowserSession
  implements BrowserSession {
  public readonly id =
    "control-browser";
  public readonly cdpUrl =
    "ws://fixture/control";
  public closeCalls = 0;

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class ControlBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new ControlBrowserSession();

  public async createSession():
    Promise<BrowserSession> {
    return this.session;
  }
}

class ControlAgentSession
  implements AgentSession {
  public closeCalls = 0;
  public observeCalls = 0;
  public actCalls = 0;
  public hangObserve = false;
  public hangAct = false;
  public failClose = false;
  public actionSuccess = true;
  public extracted:
    unknown = {
      answer: "wrong"
    };
  public usageCost = 0;
  public costPerObserve = 0;

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
    this.usageCost +=
      this.costPerObserve;

    if (this.hangObserve) {
      return new Promise<
        AgentAction[]
      >(() => undefined);
    }

    return [
      {
        selector: "#next",
        description:
          "Next action",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    if (this.hangAct) {
      return new Promise<
        AgentActionResult
      >(() => undefined);
    }

    return {
      success:
        this.actionSuccess,
      message:
        this.actionSuccess
          ? "acted"
          : "provider failed",
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse(
      this.extracted
    );
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;

    if (this.failClose) {
      throw new Error(
        "agent cleanup failed"
      );
    }
  }
}

class ControlAgentRuntime
  implements AgentRuntime {
  public readonly session =
    new ControlAgentSession();

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
      run?.status === "FAILED" ||
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
    "Control run did not reach terminal state."
  );
}

async function waitForObserve(
  runtime:
    ControlAgentRuntime
): Promise<void> {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    if (
      runtime.session
        .observeCalls > 0
    ) {
      return;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 2);
      }
    );
  }

  throw new Error(
    "Agent never entered observe."
  );
}

const repeatPolicy = {
  async decide() {
    return {
      type: "ACTION" as const,
      actionIndex: 0,
      rationale:
        "Continue deterministic work.",
      onFailure:
        "CONTINUE" as const
    };
  }
};

test(
  "completion verifier rejects a wrong but schema-valid result",
  async () => {
    const browserRuntime =
      new ControlBrowserRuntime();
    const agentRuntime =
      new ControlAgentRuntime();
    const repository =
      new InMemoryRunRepository();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      completionVerifier: {
        async verify(input) {
          const value =
            input.candidateResult as {
              answer?: unknown;
            };

          return value.answer ===
            "right"
            ? {
                verified:
                  true as const
              }
            : {
                verified:
                  false as const,
                goalState:
                  "FAILED" as const,
                message:
                  "Semantic completion evidence does not match the requested goal."
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
            "Return the right answer."
        },
        outputSchema: {
          parse(input) {
            const value =
              input as {
                answer?: unknown;
              };

            if (
              typeof value.answer !==
              "string"
            ) {
              throw new Error(
                "answer must be a string"
              );
            }

            return {
              answer:
                value.answer
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
    expect(
      terminal.goalState
    ).toBe("FAILED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe(
      "COMPLETION_REJECTED"
    );
    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session
        .closeCalls
    ).toBe(1);
  }
);

test(
  "action success alone cannot complete without an owned verifier",
  async () => {
    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime:
        new ControlAgentRuntime()
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/",
          goal: "Click once."
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
      terminal.terminalReason
        ?.code
    ).toBe(
      "COMPLETION_REJECTED"
    );
  }
);

test(
  "wall-clock timeout aborts active work and cleans resources",
  async () => {
    const browserRuntime =
      new ControlBrowserRuntime();
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .hangObserve = true;

    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
          };
        }
      },
      executionTimeoutMs: 20
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/",
          goal:
            "Time out deterministically."
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
      terminal.goalState
    ).toBe("BLOCKED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe(
      "EXECUTION_TIMEOUT"
    );
    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session
        .closeCalls
    ).toBe(1);
  }
);

test(
  "explicit cancellation propagates to active loop and persists RUN_CANCELLED",
  async () => {
    const browserRuntime =
      new ControlBrowserRuntime();
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .hangObserve = true;
    const repository =
      new InMemoryRunRepository();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
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
            "Cancel deterministically."
        }
      });

    await waitForObserve(
      agentRuntime
    );

    const cancelled =
      await engine.cancelRun(
        started.id
      );

    expect(
      cancelled?.kind
    ).toBe("CANCELLED");
    expect(
      cancelled?.run.status
    ).toBe("CANCELLED");
    expect(
      cancelled?.run.goalState
    ).toBe("BLOCKED");
    expect(
      cancelled?.run
        .terminalReason?.code
    ).toBe("CANCELLED");

    const events =
      await repository.listEvents(
        started.id
      );

    expect(
      events.at(-1)?.eventType
    ).toBe("RUN_CANCELLED");
    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session
        .closeCalls
    ).toBe(1);
  }
);

test(
  "step-limit termination persists BLOCKED goal state",
  async () => {
    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime:
        new ControlAgentRuntime(),
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy,
          budget: {
            maxSteps: 1
          }
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
          };
        }
      }
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/",
          goal: "Bound steps."
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
      terminal.goalState
    ).toBe("BLOCKED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe(
      "STEP_LIMIT_EXCEEDED"
    );
  }
);

test(
  "cost-budget termination persists BLOCKED goal state",
  async () => {
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .costPerObserve = 0.6;

    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy,
          usageMeter: {
            getUsage() {
              return {
                modelTokens: 0,
                estimatedCostUsd:
                  agentRuntime
                    .session
                    .usageCost
              };
            }
          },
          budget: {
            maxEstimatedCostUsd:
              1
          }
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
          };
        }
      }
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "https://fixture.test/",
          goal: "Bound cost."
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
      terminal.goalState
    ).toBe("BLOCKED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe(
      "MODEL_COST_BUDGET_EXCEEDED"
    );
  }
);

test(
  "unknown effect after failed action blocks retry durably",
  async () => {
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .actionSuccess = false;

    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy,
          effectPolicy: {
            classify() {
              return "unknown";
            }
          }
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
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
            "Do not retry uncertain effects."
        }
      });

    const terminal =
      await waitForTerminal(
        engine,
        started.id
      );

    expect(
      agentRuntime.session.actCalls
    ).toBe(1);
    expect(terminal.status).toBe(
      "FAILED"
    );
    expect(
      terminal.goalState
    ).toBe("BLOCKED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe(
      "ACTION_EFFECT_UNKNOWN"
    );
  }
);


test(
  "cancellation during an in-flight action persists unknown effect instead of CANCELLED",
  async () => {
    const browserRuntime =
      new ControlBrowserRuntime();
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .hangAct = true;
    const repository =
      new InMemoryRunRepository();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
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
            "Cancel during action."
        }
      });

    for (
      let attempt = 0;
      attempt < 100;
      attempt += 1
    ) {
      if (
        agentRuntime.session
          .actCalls > 0
      ) {
        break;
      }

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            2
          );
        }
      );
    }

    expect(
      agentRuntime.session
        .actCalls
    ).toBe(1);

    const cancelled =
      await engine.cancelRun(
        started.id
      );

    expect(
      cancelled?.kind
    ).toBe("TERMINAL");
    expect(
      cancelled?.run.status
    ).toBe("FAILED");
    expect(
      cancelled?.run.goalState
    ).toBe("BLOCKED");
    expect(
      cancelled?.run
        .terminalReason?.code
    ).toBe(
      "ACTION_EFFECT_UNKNOWN"
    );

    const actionStep =
      (
        await repository.listSteps(
          started.id
        )
      ).find(
        (step) =>
          step.kind ===
          "AGENT_LOOP_ACTION"
      );

    expect(
      (
        actionStep?.payload as {
          effect?: string;
        }
      ).effect
    ).toBe("unknown");
  }
);

test(
  "cleanup failure overrides cancellation and cancelRun reports the actual terminal state",
  async () => {
    const browserRuntime =
      new ControlBrowserRuntime();
    const agentRuntime =
      new ControlAgentRuntime();
    agentRuntime.session
      .hangObserve = true;
    agentRuntime.session
      .failClose = true;

    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          policy:
            repeatPolicy
        }),
      completionVerifier: {
        async verify() {
          return {
            verified: true
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
            "Cancel with cleanup failure."
        }
      });

    await waitForObserve(
      agentRuntime
    );

    const cancelled =
      await engine.cancelRun(
        started.id
      );

    expect(
      cancelled?.kind
    ).toBe("TERMINAL");
    expect(
      cancelled?.run.status
    ).toBe("FAILED");
    expect(
      cancelled?.run
        .terminalReason?.code
    ).toBe(
      "CLEANUP_FAILED"
    );
    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session
        .closeCalls
    ).toBe(1);
  }
);

test(
  "cancellation fails closed when durable RUNNING state is not active in this process",
  async () => {
    const repository =
      new InMemoryRunRepository();
    const now =
      new Date().toISOString();
    const runId =
      "00000000-0000-4000-8000-000000000099";

    await repository.createRun(
      {
        id: runId,
        status: "RUNNING",
        goalState:
          "IN_PROGRESS",
        createdAt: now,
        updatedAt: now
      },
      {
        url:
          "https://fixture.test/",
        goal:
          "Persisted active run."
      }
    );

    const engine = new RunEngine({
      repository,
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime:
        new ControlAgentRuntime(),
      completionVerifier: {
        async verify() {
          return {
            verified: true
          };
        }
      }
    });

    const cancelled =
      await engine.cancelRun(
        runId
      );

    expect(
      cancelled?.kind
    ).toBe("NOT_ACTIVE");
    expect(
      cancelled?.run.status
    ).toBe("RUNNING");
    expect(
      cancelled?.run.goalState
    ).toBe(
      "IN_PROGRESS"
    );
  }
);

test(
  "malformed completion-verifier output fails closed",
  async () => {
    const engine = new RunEngine({
      repository:
        new InMemoryRunRepository(),
      browserRuntime:
        new ControlBrowserRuntime(),
      agentRuntime:
        new ControlAgentRuntime(),
      completionVerifier: {
        async verify() {
          return {
            verified: "yes"
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
            "Reject malformed verification."
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
      terminal.terminalReason
        ?.code
    ).toBe(
      "COMPLETION_REJECTED"
    );
    expect(
      terminal.terminalReason
        ?.message
    ).toBe(
      "Completion verifier returned an invalid decision."
    );
  }
);
