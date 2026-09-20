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

class FakeBrowser
  implements BrowserSession {
  public readonly id = "loop-browser";
  public readonly cdpUrl =
    "ws://fixture/loop";

  public async close(): Promise<void> {}
}

class FakeBrowserRuntime
  implements BrowserRuntime {
  public async createSession():
    Promise<BrowserSession> {
    return new FakeBrowser();
  }
}

class RecoveringSession
  implements AgentSession {
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
    return [
      {
        selector: "#primary",
        description: "Primary",
        method: "click",
        arguments: [
          "secret-argument"
        ]
      },
      {
        selector: "#recovery",
        description: "Recovery",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    if (this.actCalls === 1) {
      return {
        success: false,
        message:
          "temporary provider detail",
        actions: [action]
      };
    }

    return {
      success: true,
      message: "recovered",
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

class RecoveringRuntime
  implements AgentRuntime {
  public readonly session =
    new RecoveringSession();

  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return this.session;
  }
}

function recoveryPolicy():
  AgentLoopPolicy {
  return {
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
            "Recover with the alternate action.",
          onFailure: "FAIL"
        };
      }

      if (
        input.trajectory.some(
          (entry) =>
            entry.actionOutcome
              ?.success === true
        )
      ) {
        return {
          type: "COMPLETE",
          rationale:
            "The recovery action completed the owned loop.",
          result: {
            complete: true
          }
        };
      }

      return {
        type: "ACTION",
        actionIndex: 0,
        rationale:
          "Try the primary action.",
        onFailure: "CONTINUE"
      };
    }
  };
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
    "Loop fixture did not finish."
  );
}

test("RunEngine persists recoverable multi-step progress without corrupting terminal state", async () => {
  const repository =
    new InMemoryRunRepository();
  const runtime =
    new RecoveringRuntime();
  const engine =
    new RunEngine({
      repository,
      browserRuntime:
        new FakeBrowserRuntime(),
      agentRuntime: runtime,
      completionVerifier: {
        async verify() {
          return { verified: true };
        }
      },
      agentLoop:
        new AgentLoopExecutor({
          policy:
            recoveryPolicy(),
          effectPolicy: {
            classify(input) {
              return input.success
                ? "committed"
                : "none";
            }
          },
          iterationCeiling: 5
        })
    });

  const started =
    await engine.createRun({
      request: {
        url:
          "https://fixture.test/research",
        goal:
          "Complete the deterministic research task."
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
    complete: true
  });
  expect(
    runtime.session.actCalls
  ).toBe(2);

  const steps =
    await repository.listSteps(
      started.id
    );
  const actions =
    steps.filter(
      (step) =>
        step.kind ===
        "AGENT_LOOP_ACTION"
    );
  expect(actions).toHaveLength(2);
  expect(
    actions.map(
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
  expect(
    (
      actions[0]?.payload as {
        recoverable: boolean;
      }
    ).recoverable
  ).toBe(true);

  const decisions =
    steps.filter(
      (step) =>
        step.kind ===
        "AGENT_LOOP_DECISION"
    );

  expect(
    decisions.map(
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

  const durableLoopText =
    JSON.stringify(
      steps.filter(
        (step) =>
          step.kind.startsWith(
            "AGENT_LOOP_"
          )
      )
    );

  expect(
    durableLoopText
  ).not.toContain(
    "secret-argument"
  );
  expect(
    durableLoopText
  ).not.toContain(
    "temporary provider detail"
  );
});
