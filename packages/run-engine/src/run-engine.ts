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
  CreateRunRequest,
  RunFailure,
  RunFailureCode,
  RunSnapshot
} from "@astra/contracts";

import type {
  RunRepository
} from "./repository.js";

export interface StartRunInput {
  request: CreateRunRequest;
  outputSchema?: RuntimeSchema<Record<string, unknown>>;
}

export interface RunService {
  createRun(input: StartRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | undefined>;
}

class RunExecutionError extends Error {
  public readonly code: RunFailureCode;

  public constructor(code: RunFailureCode, message: string) {
    super(message);
    this.name = "RunExecutionError";
    this.code = code;
  }
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

export interface RunEngineOptions {
  repository: RunRepository;
  browserRuntime: BrowserRuntime;
  agentRuntime: AgentRuntime;
}

export class RunEngine implements RunService {
  readonly #repository: RunRepository;
  readonly #browserRuntime: BrowserRuntime;
  readonly #agentRuntime: AgentRuntime;

  public constructor({
    repository,
    browserRuntime,
    agentRuntime
  }: RunEngineOptions) {
    this.#repository = repository;
    this.#browserRuntime = browserRuntime;
    this.#agentRuntime = agentRuntime;
  }

  public async createRun(
    input: StartRunInput
  ): Promise<RunSnapshot> {
    const now = new Date().toISOString();
    const snapshot: RunSnapshot = {
      id: randomUUID(),
      status: "PENDING",
      createdAt: now,
      updatedAt: now
    };

    await this.#repository.createRun(
      snapshot,
      input.request
    );

    await this.#repository.appendEvent(
      snapshot.id,
      "RUN_CREATED",
      {
        status: "PENDING"
      }
    );

    queueMicrotask(() => {
      void this.#execute(snapshot.id, input);
    });

    return snapshot;
  }

  public getRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    return this.#repository.getRun(runId);
  }

  async #execute(
    runId: string,
    input: StartRunInput
  ): Promise<void> {
    await this.#repository.updateRun(runId, {
      status: "RUNNING"
    });

    await this.#repository.appendEvent(
      runId,
      "RUN_STARTED",
      {
        status: "RUNNING"
      }
    );

    let browser: BrowserSession | undefined;
    let agent: AgentSession | undefined;
    let result: unknown;
    let failure: RunFailure | undefined;

    try {
      browser = await this.#browserRuntime.createSession({
        headless: true
      });

      await this.#repository.appendStep(
        runId,
        "BROWSER_CREATED",
        {
          browserId: browser.id,
          viewerAvailable: browser.viewerUrl !== undefined
        }
      );

      agent = await this.#agentRuntime.openSession({
        browser
      });

      await this.#repository.appendStep(
        runId,
        "AGENT_OPENED",
        {}
      );

      await agent.navigate(input.request.url);

      await this.#repository.appendStep(
        runId,
        "NAVIGATE",
        {
          url: input.request.url
        }
      );

      const observed = await agent.observe(
        input.request.goal
      );

      await this.#repository.appendStep(
        runId,
        "OBSERVE",
        {
          actionCount: observed.length,
          actions: observed
        }
      );

      const action = observed.find(
        (candidate) =>
          candidate.method !== undefined &&
          candidate.method !== "not-supported"
      );

      if (action !== undefined) {
        const actionResult = await agent.act(action);

        await this.#repository.appendStep(
          runId,
          "ACT",
          {
            action,
            result: actionResult
          }
        );

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
          input.request.goal,
          input.outputSchema
        );

        await this.#repository.appendStep(
          runId,
          "EXTRACT",
          {
            result
          }
        );
      }
    } catch (error) {
      failure = failureFrom(error);
    } finally {
      const cleanupErrors: string[] = [];
      let agentClosed = false;
      let browserClosed = false;

      if (agent !== undefined) {
        try {
          await agent.close();
          agentClosed = true;
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
          browserClosed = true;
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error
              ? error.message
              : "browser cleanup failed"
          );
        }
      }

      try {
        await this.#repository.appendStep(
          runId,
          "CLEANUP",
          {
            agentClosed,
            browserClosed,
            cleanupErrors
          }
        );
      } catch (error) {
        if (failure === undefined) {
          cleanupErrors.push(
            error instanceof Error
              ? error.message
              : "cleanup persistence failed"
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
      await this.#repository.appendEvent(
        runId,
        "RUN_FAILED",
        {
          error: failure
        }
      );

      await this.#repository.updateRun(runId, {
        status: "FAILED",
        error: failure
      });
      return;
    }

    await this.#repository.appendEvent(
      runId,
      "RUN_COMPLETED",
      {
        result
      }
    );

    await this.#repository.updateRun(runId, {
      status: "COMPLETED",
      result
    });
  }
}
