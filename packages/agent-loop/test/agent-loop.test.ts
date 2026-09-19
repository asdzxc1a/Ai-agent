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
  type AgentLoopProgressEvent
} from "../src/index.js";

type ActionPlan =
  | "success"
  | "failure"
  | "throw";

class LoopFixtureSession
  implements AgentSession {
  public observeCalls = 0;
  public actCalls = 0;
  public readonly actions:
    AgentAction[] = [
      {
        selector: "#primary",
        description:
          "Primary action",
        method: "click"
      },
      {
        selector: "#recovery",
        description:
          "Recovery action",
        method: "click"
      }
    ];

  public constructor(
    private readonly plan:
      ActionPlan[] = []
  ) {}

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
    return this.actions;
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    const planned =
      this.plan[this.actCalls] ??
      "success";
    this.actCalls += 1;

    if (planned === "throw") {
      throw new Error(
        "recoverable thrown failure"
      );
    }

    return {
      success:
        planned === "success",
      message:
        planned === "success"
          ? "ok"
          : "recoverable returned failure",
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

test(
  "successful action does not complete the loop without explicit COMPLETE",
  async () => {
    const session =
      new LoopFixtureSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal: "Finish safely.",
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
                    "Take first action."
                };
              }

              return {
                type: "FAIL",
                message:
                  "Completion was not proven."
              };
            }
          }
        }
      );

    expect(session.actCalls).toBe(1);
    expect(outcome.type).toBe("FAIL");
    expect(
      outcome.trajectory
    ).toHaveLength(2);
    expect(
      outcome.trajectory[0]
        ?.actionOutcome?.success
    ).toBe(true);
  }
);

test(
  "explicit COMPLETE can follow three successful actions",
  async () => {
    const session =
      new LoopFixtureSession();
    const progress:
      AgentLoopProgressEvent[] = [];

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Research three facts.",
          policy: {
            async decide(input) {
              const successes =
                input.trajectory.filter(
                  (entry) =>
                    entry.actionOutcome
                      ?.success === true
                ).length;

              if (successes >= 3) {
                return {
                  type: "COMPLETE",
                  rationale:
                    "All three required actions are recorded."
                };
              }

              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Continue the research sequence."
              };
            }
          },
          onProgress(event) {
            progress.push(event);
            return Promise.resolve();
          }
        }
      );

    expect(outcome.type).toBe(
      "COMPLETE"
    );
    expect(session.actCalls).toBe(3);
    expect(
      session.observeCalls
    ).toBe(4);
    expect(
      outcome.trajectory
    ).toHaveLength(4);
    expect(
      progress.filter(
        (event) =>
          event.type === "ACTED"
      )
    ).toHaveLength(3);
  }
);

test.each([
  "failure",
  "throw"
] as const)(
  "%s action failure returns control to the policy",
  async (firstAttempt) => {
    const session =
      new LoopFixtureSession([
        firstAttempt,
        "success"
      ]);

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal: "Recover safely.",
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
                    "Use the recovery action."
                };
              }

              if (
                last?.actionOutcome
                  ?.success === true
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
                  "Try the primary action."
              };
            }
          }
        }
      );

    expect(outcome.type).toBe(
      "COMPLETE"
    );
    expect(session.actCalls).toBe(2);
    expect(
      outcome.trajectory.flatMap(
        (entry) =>
          entry.actionOutcome ===
          undefined
            ? []
            : [
                entry.actionOutcome
                  .success
              ]
      )
    ).toEqual([
      false,
      true
    ]);
  }
);

test(
  "malformed decisions fail closed and are diagnosed",
  async () => {
    const session =
      new LoopFixtureSession();
    const progress:
      AgentLoopProgressEvent[] = [];

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Reject malformed state.",
          policy: {
            async decide() {
              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Looks valid.",
                stagehandSessionId:
                  "provider-leak"
              };
            }
          },
          onProgress(event) {
            progress.push(event);
            return Promise.resolve();
          }
        }
      );

    expect(outcome.type).toBe(
      "FAIL"
    );
    expect(session.actCalls).toBe(0);
    expect(
      progress.at(-1)?.type
    ).toBe(
      "DECISION_REJECTED"
    );

    if (outcome.type === "FAIL") {
      expect(
        outcome.message
      ).toMatch(
        /unsupported field/
      );
    }
  }
);

test(
  "invalid observed action selection fails closed",
  async () => {
    const session =
      new LoopFixtureSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Do not invent selectors.",
          policy: {
            async decide() {
              return {
                type: "ACTION",
                actionIndex: 99,
                rationale:
                  "Invalid fixture decision."
              };
            }
          }
        }
      );

    expect(outcome.type).toBe(
      "FAIL"
    );
    expect(
      outcome.trajectory
    ).toHaveLength(1);
    expect(
      outcome.trajectory[0]
        ?.decision
    ).toMatchObject({
      type: "ACTION",
      actionIndex: 99
    });

    if (outcome.type === "FAIL") {
      expect(
        outcome.message
      ).toMatch(
        /action index 99/
      );
    }
  }
);

test(
  "iteration ceiling prevents an endless repeated-action loop",
  async () => {
    const session =
      new LoopFixtureSession();

    const outcome =
      await executeAgentLoop(
        session,
        {
          goal:
            "Never complete implicitly.",
          iterationCeiling: 2,
          policy: {
            async decide() {
              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Repeat until bounded."
              };
            }
          }
        }
      );

    expect(outcome.type).toBe(
      "FAIL"
    );
    expect(session.actCalls).toBe(2);

    if (outcome.type === "FAIL") {
      expect(
        outcome.message
      ).toMatch(
        /iteration ceiling/
      );
    }
  }
);
