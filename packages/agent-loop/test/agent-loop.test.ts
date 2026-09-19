import {
  expect,
  test
} from "vitest";

import type {
  AgentAction,
  AgentActionResult,
  AgentSession,
  RuntimeSchema
} from "@astra/agent-runtime";

import {
  executeAgentLoop,
  type AgentLoopPolicy,
  type AgentLoopProgressEvent
} from "../src/index.js";

class LoopFixtureSession
  implements AgentSession {
  public actCalls = 0;
  public failFirstAction = false;
  public readonly actions: AgentAction[] = [
    {
      selector: "#primary",
      description: "Primary action",
      method: "click",
      arguments: ["secret-argument"]
    },
    {
      selector: "#recovery",
      description: "Recovery action",
      method: "click"
    }
  ];

  public async navigate(
    url: string
  ): Promise<void> {
    void url;
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;
    return this.actions;
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    if (
      this.failFirstAction &&
      this.actCalls === 1
    ) {
      return {
        success: false,
        message:
          "recoverable fixture failure",
        actions: [action]
      };
    }

    return {
      success: true,
      message: "ok",
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

test("successful action cannot complete without COMPLETE", async () => {
  const session =
    new LoopFixtureSession();
  const policy: AgentLoopPolicy = {
    async decide(input) {
      if (input.iteration === 1) {
        return {
          type: "ACTION",
          actionIndex: 0,
          rationale:
            "Take one action.",
          onFailure: "FAIL"
        };
      }

      return {
        type: "FAIL",
        message:
          "Completion is not proven."
      };
    }
  };

  const outcome =
    await executeAgentLoop(
      session,
      {
        goal: "Finish safely.",
        policy
      }
    );

  expect(session.actCalls).toBe(1);
  expect(outcome.type).toBe("FAIL");
});

test("explicit COMPLETE returns policy result", async () => {
  const session =
    new LoopFixtureSession();
  const policy: AgentLoopPolicy = {
    async decide(input) {
      if (
        input.trajectory.length < 2
      ) {
        return {
          type: "ACTION",
          actionIndex: 0,
          rationale: "Continue.",
          onFailure: "FAIL"
        };
      }

      return {
        type: "COMPLETE",
        rationale:
          "Two actions finished.",
        result: {
          status: "complete"
        }
      };
    }
  };

  const outcome =
    await executeAgentLoop(
      session,
      {
        goal: "Finish safely.",
        policy
      }
    );

  expect(outcome.type).toBe(
    "COMPLETE"
  );
  if (outcome.type !== "COMPLETE") {
    throw new Error(
      "Expected completion."
    );
  }

  expect(outcome.result).toEqual({
    status: "complete"
  });
  expect(session.actCalls).toBe(2);
});

test("recoverable action failure returns control to policy", async () => {
  const session =
    new LoopFixtureSession();
  session.failFirstAction = true;

  const policy: AgentLoopPolicy = {
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
            "Use recovery.",
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
            "Recovery succeeded."
        };
      }

      return {
        type: "ACTION",
        actionIndex: 0,
        rationale:
          "Try primary action.",
        onFailure: "CONTINUE"
      };
    }
  };

  const events:
    AgentLoopProgressEvent[] = [];
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal: "Recover.",
        policy,
        async onProgress(event) {
          events.push(
            structuredClone(event)
          );
        }
      }
    );

  expect(outcome.type).toBe(
    "COMPLETE"
  );
  expect(session.actCalls).toBe(2);
  expect(
    outcome.trajectory[0]
      ?.actionOutcome
      ?.recoverable
  ).toBe(true);
  expect(
    events.map(
      (event) => event.type
    )
  ).toEqual([
    "OBSERVED",
    "DECIDED",
    "ACTED",
    "OBSERVED",
    "DECIDED",
    "ACTED",
    "OBSERVED",
    "DECIDED"
  ]);
  expect(
    JSON.stringify(events)
  ).not.toContain(
    "secret-argument"
  );
});

test("terminal action failure stops immediately", async () => {
  const session =
    new LoopFixtureSession();
  session.failFirstAction = true;

  const outcome =
    await executeAgentLoop(
      session,
      {
        goal: "Fail safely.",
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale: "Try once.",
              onFailure: "FAIL"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe("FAIL");
  expect(session.actCalls).toBe(1);
});

test("invalid action selection fails closed", async () => {
  const outcome =
    await executeAgentLoop(
      new LoopFixtureSession(),
      {
        goal: "Do not invent.",
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 99,
              rationale: "Invalid.",
              onFailure: "FAIL"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe("FAIL");
  if (outcome.type === "FAIL") {
    expect(outcome.message).toMatch(
      /action index 99/
    );
  }
});

test("malformed decisions are rejected before acting", async () => {
  const session =
    new LoopFixtureSession();
  const events:
    AgentLoopProgressEvent[] = [];

  const outcome =
    await executeAgentLoop(
      session,
      {
        goal: "Reject malformed.",
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale: "Missing policy.",
              onFailure: "MAYBE"
            };
          }
        },
        async onProgress(event) {
          events.push(
            structuredClone(event)
          );
        }
      }
    );

  expect(outcome.type).toBe("FAIL");
  expect(session.actCalls).toBe(0);
  expect(
    events.at(-1)?.type
  ).toBe("DECISION_REJECTED");
});
