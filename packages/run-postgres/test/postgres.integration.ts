import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import type { CreateRunRequest, RunSnapshot } from "@astra/contracts";
import {
  AgentLoopExecutor
} from "../../agent-loop/src/index.js";
import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "../../agent-runtime/src/index.js";
import type {
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "../../browser-runtime/src/index.js";
import {
  RunEngine
} from "../../run-engine/src/index.js";

import {
  createPostgresPool,
  PostgresRunRepository,
  runPostgresMigrations
} from "../src/index.js";

const connectionString = process.env.TEST_DATABASE_URL;

if (connectionString === undefined) {
  throw new Error("TEST_DATABASE_URL is required.");
}

const pool = createPostgresPool({
  connectionString,
  max: 4
});

const repository = new PostgresRunRepository(pool);

beforeAll(async () => {
  await runPostgresMigrations(pool);
  await runPostgresMigrations(pool);
});

beforeEach(async () => {
  await pool.query(
    "TRUNCATE run_events, run_steps, runs RESTART IDENTITY CASCADE"
  );
});

afterAll(async () => {
  await pool.end();
});

function pendingRun(id: string): RunSnapshot {
  const now = new Date().toISOString();

  return {
    id,
    status: "PENDING",
    createdAt: now,
    updatedAt: now
  };
}

const request: CreateRunRequest = {
  url: "http://fixture.test/",
  goal: "Run durable repository test."
};

test("PostgresRunRepository persists ordered run state, steps, and events", async () => {
  const runId = randomUUID();

  await repository.createRun(
    pendingRun(runId),
    request
  );

  expect(await repository.getRequest(runId)).toEqual(request);
  expect((await repository.getRun(runId))?.status).toBe("PENDING");

  await repository.updateRun(runId, {
    status: "RUNNING"
  });

  const step1 = await repository.appendStep(
    runId,
    "NAVIGATE",
    { url: request.url }
  );
  const step2 = await repository.appendStep(
    runId,
    "ACT",
    { success: true }
  );

  expect([
    step1.sequenceNumber,
    step2.sequenceNumber
  ]).toEqual([1, 2]);

  const event1 = await repository.appendEvent(
    runId,
    "RUN_CREATED",
    { status: "PENDING" }
  );
  const event2 = await repository.appendEvent(
    runId,
    "RUN_STARTED",
    { status: "RUNNING" }
  );

  expect([
    event1.sequenceNumber,
    event2.sequenceNumber
  ]).toEqual([1, 2]);

  await expect(
    repository.updateRun(runId, {
      status: "COMPLETED"
    })
  ).rejects.toThrow(
    "COMPLETED runs must contain a validated result."
  );

  const completed = await repository.updateRun(
    runId,
    {
      status: "COMPLETED",
      result: {
        count: 1,
        status: "clicked"
      }
    }
  );

  expect(completed.result).toEqual({
    count: 1,
    status: "clicked"
  });

  expect(
    (await repository.listSteps(runId)).map(
      (step) => step.sequenceNumber
    )
  ).toEqual([1, 2]);

  expect(
    (await repository.listEvents(runId)).map(
      (event) => event.sequenceNumber
    )
  ).toEqual([1, 2]);

  const afterFirstEvent = await repository.listEventsAfter(
    runId,
    1,
    10
  );

  expect(
    afterFirstEvent.map(
      (event) => event.sequenceNumber
    )
  ).toEqual([2]);

  const failedId = randomUUID();
  await repository.createRun(
    pendingRun(failedId),
    request
  );

  const failed = await repository.updateRun(
    failedId,
    {
      status: "FAILED",
      error: {
        code: "EXECUTION_FAILED",
        message: "fixture failure"
      }
    }
  );

  expect(failed.error).toEqual({
    code: "EXECUTION_FAILED",
    message: "fixture failure"
  });

  expect((await repository.getRun(failedId))?.error).toEqual(
    failed.error
  );
});

class DurableLoopBrowserSession
  implements BrowserSession {
  public readonly id =
    "durable-loop-browser";
  public readonly cdpUrl =
    "ws://browser.test/durable-loop";
  public closeCalls = 0;

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class DurableLoopBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new DurableLoopBrowserSession();

  public async createSession(
    options?: BrowserSessionOptions
  ): Promise<BrowserSession> {
    void options;
    return this.session;
  }
}

class DurableLoopAgentSession
  implements AgentSession {
  public actCalls = 0;
  public closeCalls = 0;

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
        selector: "#next",
        description:
          "Next deterministic research step",
        method: "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;
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

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class DurableLoopAgentRuntime
  implements AgentRuntime {
  public readonly session =
    new DurableLoopAgentSession();

  public async openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    void options;
    return this.session;
  }
}

async function waitForDurableTerminal(
  runId: string
) {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    const run =
      await repository.getRun(runId);

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
    "Durable loop run did not reach terminal state."
  );
}

test(
  "PostgreSQL preserves ordered owned-loop progress across repository instances",
  async () => {
    const browserRuntime =
      new DurableLoopBrowserRuntime();
    const agentRuntime =
      new DurableLoopAgentRuntime();

    const engine = new RunEngine({
      repository,
      browserRuntime,
      agentRuntime,
      agentLoop:
        new AgentLoopExecutor({
          iterationCeiling: 5,
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
                    "Three durable research actions are recorded."
                };
              }

              return {
                type: "ACTION",
                actionIndex: 0,
                rationale:
                  "Persist the next research action."
              };
            }
          }
        })
    });

    const started =
      await engine.createRun({
        request: {
          url:
            "http://fixture.test/research",
          goal:
            "Complete three durable research actions."
        }
      });

    const terminal =
      await waitForDurableTerminal(
        started.id
      );

    expect(terminal.status).toBe(
      "COMPLETED"
    );
    expect(terminal.result).toEqual({
      completed: true,
      iterations: 4
    });

    const reloaded =
      new PostgresRunRepository(pool);
    const steps =
      await reloaded.listSteps(
        started.id
      );
    const events =
      await reloaded.listEvents(
        started.id
      );

    expect(
      steps.filter(
        (step) =>
          step.kind ===
          "AGENT_LOOP_ACTION"
      )
    ).toHaveLength(3);
    expect(
      steps.filter(
        (step) =>
          step.kind ===
          "AGENT_LOOP_DECISION"
      ).map(
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
      steps.map(
        (step) =>
          step.sequenceNumber
      )
    ).toEqual(
      steps.map(
        (_, index) => index + 1
      )
    );
    expect(
      events.some(
        (event) =>
          event.eventType ===
          "RUN_PROGRESS"
      )
    ).toBe(true);
    expect(
      events.at(-1)?.eventType
    ).toBe("RUN_COMPLETED");

    expect(
      browserRuntime.session
        .closeCalls
    ).toBe(1);
    expect(
      agentRuntime.session.closeCalls
    ).toBe(1);
  }
);
