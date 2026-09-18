import { randomUUID } from "node:crypto";

import type {
  AgentRuntime,
  AgentSession,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  BrowserRuntime,
  BrowserSession
} from "@astra/browser-runtime";
import type {
  RunFailure,
  RunFailureCode,
  RunSnapshot
} from "@astra/contracts";

export interface CreateRunInput {
  url: string;
  goal: string;
  outputSchema?: RuntimeSchema<Record<string, unknown>>;
}

class RunExecutionError extends Error {
  public readonly code: RunFailureCode;

  public constructor(code: RunFailureCode, message: string) {
    super(message);
    this.name = "RunExecutionError";
    this.code = code;
  }
}

function cloneSnapshot(snapshot: RunSnapshot): RunSnapshot {
  return {
    ...snapshot,
    ...(snapshot.error === undefined
      ? {}
      : {
          error: { ...snapshot.error }
        })
  };
}

function failureFrom(error: unknown): RunFailure {
  if (error instanceof RunExecutionError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  return {
    code: "EXECUTION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "Run execution failed."
  };
}

export class InMemoryRunService {
  readonly #browserRuntime: BrowserRuntime;
  readonly #agentRuntime: AgentRuntime;
  readonly #runs = new Map<string, RunSnapshot>();

  public constructor(
    browserRuntime: BrowserRuntime,
    agentRuntime: AgentRuntime
  ) {
    this.#browserRuntime = browserRuntime;
    this.#agentRuntime = agentRuntime;
  }

  public createRun(input: CreateRunInput): RunSnapshot {
    const now = new Date().toISOString();
    const snapshot: RunSnapshot = {
      id: randomUUID(),
      status: "PENDING",
      createdAt: now,
      updatedAt: now
    };

    this.#runs.set(snapshot.id, snapshot);

    queueMicrotask(() => {
      void this.#execute(snapshot.id, input);
    });

    return cloneSnapshot(snapshot);
  }

  public getRun(runId: string): RunSnapshot | undefined {
    const snapshot = this.#runs.get(runId);
    return snapshot === undefined
      ? undefined
      : cloneSnapshot(snapshot);
  }

  #update(
    runId: string,
    update: Partial<Omit<RunSnapshot, "id" | "createdAt">>
  ): void {
    const current = this.#runs.get(runId);

    if (current === undefined) {
      return;
    }

    this.#runs.set(runId, {
      ...current,
      ...update,
      updatedAt: new Date().toISOString()
    });
  }

  async #execute(
    runId: string,
    input: CreateRunInput
  ): Promise<void> {
    this.#update(runId, {
      status: "RUNNING"
    });

    let browser: BrowserSession | undefined;
    let agent: AgentSession | undefined;
    let result: unknown;
    let failure: RunFailure | undefined;

    try {
      browser = await this.#browserRuntime.createSession({
        headless: true
      });

      agent = await this.#agentRuntime.openSession({
        browser
      });

      await agent.navigate(input.url);

      const observed = await agent.observe(input.goal);
      const action = observed.find(
        (candidate) =>
          candidate.method !== undefined &&
          candidate.method !== "not-supported"
      );

      if (action !== undefined) {
        const actionResult = await agent.act(action);

        if (!actionResult.success) {
          throw new RunExecutionError(
            "ACTION_FAILED",
            actionResult.message
          );
        }

        if (input.outputSchema === undefined) {
          result = {
            acted: true,
            action,
            message: actionResult.message
          };
        }
      } else if (input.outputSchema === undefined) {
        throw new RunExecutionError(
          "NO_ACTION_FOUND",
          "The agent found no actionable element for the goal."
        );
      }

      if (input.outputSchema !== undefined) {
        result = await agent.extract(
          input.goal,
          input.outputSchema
        );
      }
    } catch (error) {
      failure = failureFrom(error);
    } finally {
      const cleanupErrors: string[] = [];

      if (agent !== undefined) {
        try {
          await agent.close();
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error
              ? error.message
              : "agent cleanup failed"
          );
        }
      }

      if (browser !== undefined) {
        try {
          await browser.close();
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error
              ? error.message
              : "browser cleanup failed"
          );
        }
      }

      if (failure === undefined && cleanupErrors.length > 0) {
        failure = {
          code: "CLEANUP_FAILED",
          message: cleanupErrors.join("; ")
        };
      }
    }

    if (failure !== undefined) {
      this.#update(runId, {
        status: "FAILED",
        error: failure
      });
      return;
    }

    this.#update(runId, {
      status: "COMPLETED",
      result
    });
  }
}
