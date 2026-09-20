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
  type AgentLoopActionEffectPolicy,
  type AgentLoopUsageMeter
} from "../src/index.js";

class ControlSession
  implements AgentSession {
  public actCalls = 0;
  public observeCalls = 0;
  public costPerObserve = 0;
  public usageCost = 0;
  public actionSuccess = true;
  public hangObserve = false;
  public hangAct = false;

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
        selector: "#repeat",
        description:
          "Repeat action",
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
          : "failed",
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

const repeatPolicy = {
  async decide() {
    return {
      type: "ACTION" as const,
      actionIndex: 0,
      rationale:
        "Repeat deterministic action.",
      onFailure:
        "CONTINUE" as const
    };
  }
};

test(
  "maximum step budget blocks before an extra action executes",
  async () => {
    const session =
      new ControlSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal: "Bound steps.",
          policy: repeatPolicy,
          budget: {
            maxSteps: 2
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(2);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "STEP_LIMIT_EXCEEDED"
      );
    }
  }
);

test(
  "model cost budget terminates the loop before another action",
  async () => {
    const session =
      new ControlSession();
    session.costPerObserve = 0.6;

    const usageMeter:
      AgentLoopUsageMeter = {
        getUsage() {
          return {
            modelTokens: 0,
            estimatedCostUsd:
              session.usageCost
          };
        }
      };

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal: "Bound cost.",
          policy: repeatPolicy,
          usageMeter,
          budget: {
            maxEstimatedCostUsd: 1
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(1);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "MODEL_COST_BUDGET_EXCEEDED"
      );
    }
  }
);

test(
  "model token budget terminates deterministically",
  async () => {
    let tokens = 0;
    const usageMeter:
      AgentLoopUsageMeter = {
        getUsage() {
          tokens += 6;
          return {
            modelTokens: tokens,
            estimatedCostUsd: 0
          };
        }
      };

    const outcome =
      await executeAgentLoop(
        new ControlSession(),
        {
          goal: "Bound tokens.",
          policy: repeatPolicy,
          usageMeter,
          budget: {
            maxModelTokens: 10
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "MODEL_TOKEN_BUDGET_EXCEEDED"
      );
    }
  }
);

test(
  "repeated action selection is detected before another execution",
  async () => {
    const session =
      new ControlSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Detect repeated action loop.",
          policy: repeatPolicy,
          budget: {
            maxRepeatedActionSelections:
              2
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(2);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "LOOP_DETECTED"
      );
    }
  }
);

test(
  "unknown action effect blocks recovery instead of retrying",
  async () => {
    const session =
      new ControlSession();
    session.actionSuccess = false;

    const effectPolicy:
      AgentLoopActionEffectPolicy = {
        classify() {
          return "unknown";
        }
      };

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Do not blindly retry uncertain effects.",
          policy: repeatPolicy,
          effectPolicy
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(1);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "ACTION_EFFECT_UNKNOWN"
      );
    }

    expect(
      outcome.trajectory[0]
        ?.actionOutcome?.effect
    ).toBe("unknown");
    expect(
      outcome.trajectory[0]
        ?.actionOutcome
        ?.recoverable
    ).toBe(false);
  }
);

test(
  "abort signal interrupts a hanging observation",
  async () => {
    const session =
      new ControlSession();
    session.hangObserve = true;
    const controller =
      new AbortController();

    const execution =
      executeAgentLoop(
        session,
        {
          goal: "Cancel.",
          policy: repeatPolicy,
          signal:
            controller.signal
        }
      );

    controller.abort();

    await expect(
      execution
    ).rejects.toMatchObject({
      name: "AbortError"
    });
    expect(session.actCalls).toBe(0);
  }
);


test(
  "abort during an in-flight action records unknown effect and blocks retry",
  async () => {
    const session =
      new ControlSession();
    session.hangAct = true;
    const controller =
      new AbortController();

    const execution =
      executeAgentLoop(
        session,
        {
          goal:
            "Do not lose action-effect truth.",
          policy:
            repeatPolicy,
          signal:
            controller.signal
        }
      );

    for (
      let attempt = 0;
      attempt < 100;
      attempt += 1
    ) {
      if (
        session.actCalls > 0
      ) {
        break;
      }

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            1
          );
        }
      );
    }

    controller.abort();

    const outcome =
      await execution;

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(1);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "ACTION_EFFECT_UNKNOWN"
      );
    }

    expect(
      outcome.trajectory[0]
        ?.actionOutcome
        ?.effect
    ).toBe("unknown");
  }
);

test(
  "effect-classification failure becomes unknown effect instead of a retryable failure",
  async () => {
    const session =
      new ControlSession();
    session.actionSuccess = false;

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Fail closed on effect-classification errors.",
          policy:
            repeatPolicy,
          effectPolicy: {
            classify() {
              throw new Error(
                "classifier unavailable"
              );
            }
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(1);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "ACTION_EFFECT_UNKNOWN"
      );
    }

    expect(
      outcome.trajectory[0]
        ?.actionOutcome
        ?.effect
    ).toBe("unknown");
  }
);

test(
  "failed action without an effect classifier defaults to unknown and blocks recovery",
  async () => {
    const session =
      new ControlSession();
    session.actionSuccess = false;

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Require explicit proof of no effect before retry.",
          policy:
            repeatPolicy
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(session.actCalls).toBe(1);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "ACTION_EFFECT_UNKNOWN"
      );
    }

    expect(
      outcome.trajectory[0]
        ?.actionOutcome
        ?.effect
    ).toBe("unknown");
  }
);

test(
  "an exact token cap blocks before the first model-using phase",
  async () => {
    const session =
      new ControlSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Do not exceed an exhausted token budget.",
          policy: repeatPolicy,
          usageMeter: {
            getUsage() {
              return {
                modelTokens: 10,
                estimatedCostUsd: 0
              };
            }
          },
          budget: {
            maxModelTokens: 10
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(
      session.observeCalls
    ).toBe(0);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "MODEL_TOKEN_BUDGET_EXCEEDED"
      );
    }
  }
);

test(
  "an exact cost cap reached by observe blocks before another model decision",
  async () => {
    const session =
      new ControlSession();
    session.costPerObserve = 1;
    let decisionCalls = 0;

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Stop at the exact cost cap.",
          policy: {
            async decide() {
              decisionCalls += 1;
              return repeatPolicy.decide();
            }
          },
          usageMeter: {
            getUsage() {
              return {
                modelTokens: 0,
                estimatedCostUsd:
                  session.usageCost
              };
            }
          },
          budget: {
            maxEstimatedCostUsd: 1
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(
      session.observeCalls
    ).toBe(1);
    expect(decisionCalls).toBe(0);
    expect(session.actCalls).toBe(0);

    if (
      outcome.type ===
      "BLOCKED"
    ) {
      expect(
        outcome.reason.code
      ).toBe(
        "MODEL_COST_BUDGET_EXCEEDED"
      );
    }
  }
);

test(
  "zero model-cost budget blocks before any model-using phase",
  async () => {
    const session =
      new ControlSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Spend no model budget.",
          policy: repeatPolicy,
          usageMeter: {
            getUsage() {
              return {
                modelTokens: 0,
                estimatedCostUsd: 0
              };
            }
          },
          budget: {
            maxEstimatedCostUsd: 0
          }
        }
      );

    expect(outcome.type).toBe(
      "BLOCKED"
    );
    expect(
      session.observeCalls
    ).toBe(0);
    expect(session.actCalls).toBe(0);
  }
);
