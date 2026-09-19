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
          onFailure: "FAIL",
          effectRisk: "REVERSIBLE"
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
          onFailure: "FAIL",
          effectRisk: "REVERSIBLE"
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
          onFailure: "FAIL",
          effectRisk: "REVERSIBLE"
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
        onFailure: "CONTINUE",
        effectRisk: "REVERSIBLE"
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
              onFailure: "FAIL",
              effectRisk:
                "REVERSIBLE"
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
              onFailure: "FAIL",
              effectRisk:
                "REVERSIBLE"
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
              onFailure: "MAYBE",
              effectRisk: "REVERSIBLE"
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

class ThrowingIrreversibleSession
  extends LoopFixtureSession {
  public override async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;
    void action;

    throw new Error(
      "provider timed out after send"
    );
  }
}

test("unknown irreversible effects block automatic retry", async () => {
  const session =
    new ThrowingIrreversibleSession();
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal:
          "Do not duplicate an irreversible action.",
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale:
                "Attempt the irreversible action once.",
              onFailure: "CONTINUE",
              effectRisk:
                "IRREVERSIBLE"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe(
    "BLOCKED"
  );
  if (outcome.type !== "BLOCKED") {
    throw new Error(
      "Expected blocked outcome."
    );
  }

  expect(outcome.reason).toBe(
    "IRREVERSIBLE_EFFECT_UNKNOWN"
  );
  expect(session.actCalls).toBe(1);
});

test("action budget terminates before an extra action", async () => {
  const session =
    new LoopFixtureSession();
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal:
          "Respect the action budget.",
        limits: {
          maxActions: 1,
          repeatedActionLimit: 5
        },
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale:
                "Keep acting until bounded.",
              onFailure: "FAIL",
              effectRisk:
                "REVERSIBLE"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe(
    "FAIL"
  );
  if (outcome.type !== "FAIL") {
    throw new Error(
      "Expected bounded failure."
    );
  }

  expect(outcome.reason).toBe(
    "STEP_LIMIT_EXCEEDED"
  );
  expect(session.actCalls).toBe(1);
});

test("repeated identical actions trigger loop detection", async () => {
  const session =
    new LoopFixtureSession();
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal:
          "Detect an action loop.",
        limits: {
          maxActions: 5,
          repeatedActionLimit: 1
        },
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale:
                "Repeat the same action.",
              onFailure: "FAIL",
              effectRisk:
                "REVERSIBLE"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe(
    "FAIL"
  );
  if (outcome.type !== "FAIL") {
    throw new Error(
      "Expected loop failure."
    );
  }

  expect(outcome.reason).toBe(
    "LOOP_DETECTED"
  );
  expect(session.actCalls).toBe(1);
});

test("model cost budget fails before further execution", async () => {
  const session =
    new LoopFixtureSession();
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal:
          "Respect model spend.",
        limits: {
          maxModelCostUsd: 0.5
        },
        usageMeter: {
          snapshot() {
            return {
              modelTokens: 100,
              modelCostUsd: 0.51
            };
          }
        },
        policy: {
          async decide() {
            return {
              type: "ACTION",
              actionIndex: 0,
              rationale:
                "This decision should never run.",
              onFailure: "FAIL",
              effectRisk:
                "REVERSIBLE"
            };
          }
        }
      }
    );

  expect(outcome.type).toBe(
    "FAIL"
  );
  if (outcome.type !== "FAIL") {
    throw new Error(
      "Expected budget failure."
    );
  }

  expect(outcome.reason).toBe(
    "MODEL_COST_BUDGET_EXCEEDED"
  );
  expect(session.actCalls).toBe(0);
});

test("model token budget is independently enforced", async () => {
  const session =
    new LoopFixtureSession();
  const outcome =
    await executeAgentLoop(
      session,
      {
        goal:
          "Respect token budget.",
        limits: {
          maxModelTokens: 99
        },
        usageMeter: {
          snapshot() {
            return {
              modelTokens: 100,
              modelCostUsd: 0
            };
          }
        },
        policy: {
          async decide() {
            return {
              type: "FAIL",
              message:
                "This decision should not run."
            };
          }
        }
      }
    );

  expect(outcome.type).toBe(
    "FAIL"
  );
  if (outcome.type !== "FAIL") {
    throw new Error(
      "Expected budget failure."
    );
  }

  expect(outcome.reason).toBe(
    "MODEL_TOKEN_BUDGET_EXCEEDED"
  );
  expect(session.actCalls).toBe(0);
});

test("policy failure detail is excluded from progress", async () => {
  const events:
    AgentLoopProgressEvent[] = [];
  const outcome =
    await executeAgentLoop(
      new LoopFixtureSession(),
      {
        goal: "Fail closed.",
        policy: {
          async decide() {
            throw new Error(
              "provider-secret-detail"
            );
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
  expect(
    JSON.stringify(events)
  ).not.toContain(
    "provider-secret-detail"
  );
  expect(events.at(-1)).toMatchObject({
    type: "DECISION_REJECTED",
    message:
      "Agent-loop policy decision was rejected."
  });
});
