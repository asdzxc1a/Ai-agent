import { randomUUID } from "node:crypto";

import type {
  AgentAction,
  AgentRuntime,
  AgentSession,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  ArtifactContent,
  ArtifactRecord,
  ArtifactStore
} from "@astra/artifact-store";
import type {
  BrowserDiagnostic,
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
  RunEventRecord,
  RunRepository
} from "./repository.js";

export interface StartRunInput {
  request: CreateRunRequest;
  outputSchema?: RuntimeSchema<Record<string, unknown>>;
}

export interface RunService {
  createRun(input: StartRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | undefined>;

  listEventsAfter(
    runId: string,
    afterSequence: number,
    limit?: number
  ): Promise<RunEventRecord[]>;

  listArtifacts(
    runId: string
  ): Promise<ArtifactRecord[]>;

  readArtifact(
    runId: string,
    artifactId: string
  ): Promise<ArtifactContent | undefined>;
}

class RunExecutionError extends Error {
  public readonly code: RunFailureCode;

  public constructor(
    code: RunFailureCode,
    message: string
  ) {
    super(message);
    this.name = "RunExecutionError";
    this.code = code;
  }
}

function failureFrom(
  error: unknown
): RunFailure {
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

function errorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "unknown artifact error";
}

function actionSummary(
  action: AgentAction | undefined
):
  | {
      selector: string;
      description: string;
      method?: string;
    }
  | undefined {
  if (action === undefined) {
    return undefined;
  }

  return {
    selector: action.selector,
    description: action.description,
    ...(action.method === undefined
      ? {}
      : {
          method: action.method
        })
  };
}

export interface RunEngineOptions {
  repository: RunRepository;
  browserRuntime: BrowserRuntime;
  agentRuntime: AgentRuntime;
  artifactStore?: ArtifactStore;
}

export class RunEngine implements RunService {
  readonly #repository: RunRepository;
  readonly #browserRuntime: BrowserRuntime;
  readonly #agentRuntime: AgentRuntime;
  readonly #artifactStore?: ArtifactStore;

  public constructor({
    repository,
    browserRuntime,
    agentRuntime,
    artifactStore
  }: RunEngineOptions) {
    this.#repository = repository;
    this.#browserRuntime = browserRuntime;
    this.#agentRuntime = agentRuntime;

    if (artifactStore !== undefined) {
      this.#artifactStore = artifactStore;
    }
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
      void this.#execute(
        snapshot.id,
        input
      );
    });

    return snapshot;
  }

  public getRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    return this.#repository.getRun(runId);
  }

  public listEventsAfter(
    runId: string,
    afterSequence: number,
    limit?: number
  ): Promise<RunEventRecord[]> {
    return this.#repository.listEventsAfter(
      runId,
      afterSequence,
      limit
    );
  }

  public async listArtifacts(
    runId: string
  ): Promise<ArtifactRecord[]> {
    if (this.#artifactStore === undefined) {
      return [];
    }

    return this.#artifactStore.listArtifacts(
      runId
    );
  }

  public async readArtifact(
    runId: string,
    artifactId: string
  ): Promise<ArtifactContent | undefined> {
    if (this.#artifactStore === undefined) {
      return undefined;
    }

    return this.#artifactStore.readArtifact(
      runId,
      artifactId
    );
  }

  async #captureScreenshot(
    runId: string,
    browser: BrowserSession | undefined,
    name: string,
    artifactErrors: string[]
  ): Promise<void> {
    if (
      this.#artifactStore === undefined ||
      browser?.captureScreenshot === undefined
    ) {
      return;
    }

    try {
      const data =
        await browser.captureScreenshot({
          fullPage: true
        });

      await this.#artifactStore.putArtifact({
        runId,
        kind: "SCREENSHOT",
        name,
        mediaType: "image/jpeg",
        data
      });
    } catch (error) {
      artifactErrors.push(
        `${name}: ${errorMessage(error)}`
      );
    }
  }

  async #captureDiagnostics(
    runId: string,
    browser: BrowserSession | undefined,
    artifactErrors: string[]
  ): Promise<BrowserDiagnostic[]> {
    if (browser?.getDiagnostics === undefined) {
      return [];
    }

    let diagnostics: BrowserDiagnostic[];

    try {
      diagnostics =
        await browser.getDiagnostics();
    } catch (error) {
      artifactErrors.push(
        `browser-diagnostics: ${errorMessage(error)}`
      );
      return [];
    }

    if (
      this.#artifactStore !== undefined &&
      diagnostics.length > 0
    ) {
      try {
        await this.#artifactStore.putJsonArtifact({
          runId,
          kind: "DIAGNOSTICS",
          name: "browser-diagnostics.json",
          value: {
            diagnostics
          }
        });
      } catch (error) {
        artifactErrors.push(
          `browser-diagnostics.json: ${errorMessage(error)}`
        );
      }
    }

    return diagnostics;
  }

  async #writeSummary(
    runId: string,
    input: StartRunInput,
    failure: RunFailure | undefined,
    selectedAction: AgentAction | undefined,
    timings: Record<string, number>,
    diagnosticCount: number,
    artifactErrors: string[]
  ): Promise<void> {
    if (this.#artifactStore === undefined) {
      return;
    }

    try {
      await this.#artifactStore.putJsonArtifact({
        runId,
        kind: "RUN_SUMMARY",
        name: "run-summary.json",
        value: {
          runId,
          url: input.request.url,
          status:
            failure === undefined
              ? "COMPLETED"
              : "FAILED",
          action: actionSummary(selectedAction),
          timings,
          diagnosticCount,
          ...(failure === undefined
            ? {}
            : {
                failure
              }),
          artifactErrors
        }
      });
    } catch {
      // Artifact capture is intentionally best-effort.
    }
  }

  async #execute(
    runId: string,
    input: StartRunInput
  ): Promise<void> {
    const totalStartedAt = Date.now();
    const timings: Record<string, number> = {};
    const artifactErrors: string[] = [];

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
    let selectedAction: AgentAction | undefined;
    let diagnosticCount: number;

    try {
      let startedAt = Date.now();
      browser =
        await this.#browserRuntime.createSession({
          headless: true
        });
      timings.browserCreateMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "BROWSER_CREATED",
        {
          browserId: browser.id,
          viewerAvailable:
            browser.viewerUrl !== undefined
        }
      );

      startedAt = Date.now();
      agent =
        await this.#agentRuntime.openSession({
          browser
        });
      timings.agentOpenMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "AGENT_OPENED",
        {}
      );

      startedAt = Date.now();
      await agent.navigate(input.request.url);
      timings.navigateMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "NAVIGATE",
        {
          url: input.request.url
        }
      );

      await this.#captureScreenshot(
        runId,
        browser,
        "after-navigation.jpg",
        artifactErrors
      );

      startedAt = Date.now();
      const observed = await agent.observe(
        input.request.goal
      );
      timings.observeMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "OBSERVE",
        {
          actionCount: observed.length,
          actions: observed
        }
      );

      selectedAction = observed.find(
        (candidate) =>
          candidate.method !== undefined &&
          candidate.method !== "not-supported"
      );

      if (selectedAction !== undefined) {
        startedAt = Date.now();
        const actionResult =
          await agent.act(selectedAction);
        timings.actMs =
          Date.now() - startedAt;

        await this.#repository.appendStep(
          runId,
          "ACT",
          {
            action: selectedAction,
            result: actionResult
          }
        );

        if (!actionResult.success) {
          throw new RunExecutionError(
            "ACTION_FAILED",
            actionResult.message
          );
        }

        await this.#captureScreenshot(
          runId,
          browser,
          "after-action.jpg",
          artifactErrors
        );

        if (input.outputSchema === undefined) {
          result = {
            acted: true,
            action: selectedAction,
            message: actionResult.message
          };
        }
      } else if (
        input.outputSchema === undefined
      ) {
        throw new RunExecutionError(
          "NO_ACTION_FOUND",
          "The agent found no actionable element for the goal."
        );
      }

      if (input.outputSchema !== undefined) {
        startedAt = Date.now();
        result = await agent.extract(
          input.request.goal,
          input.outputSchema
        );
        timings.extractMs =
          Date.now() - startedAt;

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

      await this.#captureScreenshot(
        runId,
        browser,
        "failure.jpg",
        artifactErrors
      );
    } finally {
      const cleanupErrors: string[] = [];
      let agentClosed = false;
      let browserClosed = false;

      const diagnostics =
        await this.#captureDiagnostics(
          runId,
          browser,
          artifactErrors
        );
      diagnosticCount = diagnostics.length;

      const cleanupStartedAt = Date.now();

      if (agent !== undefined) {
        try {
          await agent.close();
          agentClosed = true;
        } catch (error) {
          cleanupErrors.push(
            errorMessage(error)
          );
        }
      }

      if (browser !== undefined) {
        try {
          await browser.close();
          browserClosed = true;
        } catch (error) {
          cleanupErrors.push(
            errorMessage(error)
          );
        }
      }

      timings.cleanupMs =
        Date.now() - cleanupStartedAt;

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
            errorMessage(error)
          );
        }
      }

      if (
        failure === undefined &&
        cleanupErrors.length > 0
      ) {
        failure = {
          code: "CLEANUP_FAILED",
          message: cleanupErrors.join("; ")
        };
      }
    }

    timings.totalMs =
      Date.now() - totalStartedAt;

    await this.#writeSummary(
      runId,
      input,
      failure,
      selectedAction,
      timings,
      diagnosticCount,
      artifactErrors
    );

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
