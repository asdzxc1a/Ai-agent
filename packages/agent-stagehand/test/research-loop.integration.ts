import { z } from "zod";
import {
  expect,
  test
} from "vitest";

import {
  AgentLoopExecutor,
  type AgentLoopPolicy
} from "@astra/agent-loop";
import {
  InMemoryArtifactStore
} from "@astra/artifact-store";
import {
  SteelBrowserRuntime
} from "@astra/browser-steel";
import {
  InMemoryRunRepository,
  RunEngine
} from "@astra/run-engine";

import {
  createStagehandAgentRuntimeForTesting
} from "../src/testing.js";
import {
  ResearchFixtureLLMClient
} from "./research-fixture-llm.js";

const steelBaseUrl =
  process.env.STEEL_BASE_URL ??
  "http://127.0.0.1:3000";
const fixtureUrl =
  process.env.RESEARCH_FIXTURE_URL ??
  "http://host.docker.internal:4174";

const researchResultSchema =
  z.object({
    company:
      z.literal("Acme"),
    workflow:
      z.literal(
        "manual-handoffs"
      ),
    status:
      z.literal("complete")
  });

class ResearchLoopPolicy
  implements AgentLoopPolicy {
  public async decide(
    input: Parameters<
      AgentLoopPolicy["decide"]
    >[0]
  ) {
    const successfulActions =
      input.trajectory.filter(
        (entry) =>
          entry.actionOutcome
            ?.success === true
      ).length;

    if (
      successfulActions >= 3 &&
      input.observedActions.length ===
        0
    ) {
      return {
        type: "COMPLETE" as const,
        rationale:
          "The complete research trajectory is visible."
      };
    }

    if (
      input.observedActions.length ===
        0
    ) {
      return {
        type: "BLOCKED" as const,
        message:
          "No next research action before completion.",
        rationale:
          "Do not claim completion early."
      };
    }

    return {
      type: "ACTION" as const,
      actionIndex: 0,
      rationale:
        "Execute the observed next research action.",
      onFailure: "FAIL" as const
    };
  }
}

async function waitForTerminal(
  engine: RunEngine,
  runId: string,
  timeoutMs = 40_000
) {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run =
      await engine.getRun(runId);

    if (
      run?.status === "COMPLETED" ||
      run?.status === "FAILED" ||
      run?.status === "CANCELLED"
    ) {
      return run;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 50);
      }
    );
  }

  const last =
    await engine.getRun(runId);

  throw new Error(
    "Multi-step research run did not reach a terminal state within " +
      String(timeoutMs) +
      "ms; last status=" +
      String(
        last?.status ??
          "missing"
      ) +
      "."
  );
}

test(
  "owned loop completes three-action Stagehand research and persists progress",
  async () => {
    const repository =
      new InMemoryRunRepository();
    const artifactStore =
      new InMemoryArtifactStore();
    const engine =
      new RunEngine({
        repository,
        browserRuntime:
          new SteelBrowserRuntime({
            baseUrl:
              steelBaseUrl,
            skipFingerprintInjection:
              true
          }),
        agentRuntime:
          createStagehandAgentRuntimeForTesting(
            () =>
              new ResearchFixtureLLMClient()
          ),
        artifactStore,
        executionTimeoutMs:
          30_000,
        completionVerifier: {
          async verify(input) {
            const parsed =
              researchResultSchema.safeParse(
                input.candidateResult
              );
            const successfulActions =
              input.trajectory.filter(
                (entry) =>
                  entry.actionOutcome
                    ?.success === true
              ).length;

            return (
              parsed.success &&
              successfulActions === 3
            )
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
                    "Research completion evidence did not match the deterministic task."
                };
          }
        },
        agentLoop:
          new AgentLoopExecutor({
            policy:
              new ResearchLoopPolicy(),
            iterationCeiling: 8
          })
      });

    const started =
      await engine.createRun({
        request: {
          url:
            fixtureUrl +
            "/research",
          goal:
            "Research Acme through the deterministic company and operations pages, then return the final research result."
        },
        outputSchema:
          researchResultSchema
      });

    const terminal =
      await waitForTerminal(
        engine,
        started.id
      );

    expect(
      terminal.status
    ).toBe("COMPLETED");
    expect(
      terminal.goalState
    ).toBe("COMPLETED");
    expect(
      terminal.terminalReason
        ?.code
    ).toBe("GOAL_VERIFIED");
    expect(
      terminal.result
    ).toEqual({
      company: "Acme",
      workflow:
        "manual-handoffs",
      status: "complete"
    });

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
    const decisions =
      steps.filter(
        (step) =>
          step.kind ===
          "AGENT_LOOP_DECISION"
      );

    expect(actions).toHaveLength(3);
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
      true,
      true,
      true
    ]);

    expect(
      actions.map(
        (step) =>
          (
            step.payload as {
              effect: string;
            }
          ).effect
      )
    ).toEqual([
      "committed",
      "committed",
      "committed"
    ]);

    expect(
      steps.some(
        (step) =>
          step.kind ===
          "GOAL_VERIFIED"
      )
    ).toBe(true);

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
      "ACTION",
      "COMPLETE"
    ]);

    expect(
      steps.some(
        (step) =>
          step.kind ===
          "EXTRACT"
      )
    ).toBe(true);

    expect(
      JSON.stringify(
        steps.filter(
          (step) =>
            step.kind.startsWith(
              "AGENT_LOOP_"
            )
        )
      )
    ).not.toContain(
      "arguments"
    );

    const events =
      await repository.listEvents(
        started.id
      );

    expect(
      events.some(
        (event) =>
          event.eventType ===
          "RUN_PROGRESS"
      )
    ).toBe(true);
    expect(
      events.at(-1)
        ?.eventType
    ).toBe(
      "RUN_COMPLETED"
    );

    const artifacts =
      await engine.listArtifacts(
        started.id
      );
    const names = new Set(
      artifacts.map(
        (artifact) =>
          artifact.name
      )
    );

    expect(names).toContain(
      "loop-01-after-action.jpg"
    );
    expect(names).toContain(
      "loop-02-after-action.jpg"
    );
    expect(names).toContain(
      "loop-03-after-action.jpg"
    );
  },
  300_000
);
