import { randomUUID } from "node:crypto";

import type {
  AgentAction,
  AgentRuntime,
  AgentSession,
  AgentUsageMeter,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  AgentLoopExecutor,
  AgentLoopProgressEvent
} from "@astra/agent-loop";
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
  GoalStatus,
  RunFailure,
  RunFailureCode,
  RunSnapshot,
  RunTerminalReason
} from "@astra/contracts";

import {
  constOutputCompletionVerifier,
  loopBlockedCode,
  loopFailureCode,
  normalizeRunExecutionBudget,
  toAgentLoopLimits,
  usageLimitFailure,
  type NormalizedRunExecutionBudget,
  type RunCompletionVerifier,
  type RunExecutionBudget,
  type RunUsageMeterFactory
} from "./execution-control.js";

import type {
  RunEventRecord,
  RunRepository
} from "./repository.js";

export interface StartRunInput {
  request: CreateRunRequest;
  outputSchema?: RuntimeSchema<Record<string, unknown>>;
  completionVerifier?: RunCompletionVerifier;
}

export interface RunService {
  createRun(input: StartRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | undefined>;
  cancelRun(runId: string): Promise<RunSnapshot | undefined>;

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

class RunCancelledError extends Error {
  public constructor() {
    super("Run cancellation was requested.");
    this.name = "RunCancelledError";
  }
}

function effectiveError(
  error: unknown,
  signal: AbortSignal
): unknown {
  if (
    signal.aborted &&
    signal.reason !== undefined
  ) {
    return signal.reason;
  }

  return error;
}

function throwIfAborted(
  signal: AbortSignal
): void {
  if (signal.aborted) {
    throw effectiveError(
      new RunCancelledError(),
      signal
    );
  }
}

function failureGoalStatus(
  code: RunFailureCode
): GoalStatus {
  switch (code) {
    case "AGENT_BLOCKED":
    case "IRREVERSIBLE_EFFECT_UNKNOWN":
    case "IRREVERSIBLE_EFFECT_COMMITTED":
      return "BLOCKED";
    default:
      return "FAILED";
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

interface RunTerminalState {
  status:
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  goalStatus: GoalStatus;
  terminalReason: RunTerminalReason;
  failure?: RunFailure;
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
  agentLoop?: AgentLoopExecutor;
  completionVerifier?: RunCompletionVerifier;
  executionBudget?: RunExecutionBudget;
  createUsageMeter?: RunUsageMeterFactory;
}

export class RunEngine implements RunService {
  readonly #repository: RunRepository;
  readonly #browserRuntime: BrowserRuntime;
  readonly #agentRuntime: AgentRuntime;
  readonly #artifactStore?: ArtifactStore;
  readonly #agentLoop?: AgentLoopExecutor;
  readonly #completionVerifier?: RunCompletionVerifier;
  readonly #executionBudget:
    NormalizedRunExecutionBudget;
  readonly #createUsageMeter?: RunUsageMeterFactory;
  readonly #controllers =
    new Map<string, AbortController>();

  public constructor({
    repository,
    browserRuntime,
    agentRuntime,
    artifactStore,
    agentLoop,
    completionVerifier,
    executionBudget,
    createUsageMeter
  }: RunEngineOptions) {
    this.#repository = repository;
    this.#browserRuntime = browserRuntime;
    this.#agentRuntime = agentRuntime;

    if (artifactStore !== undefined) {
      this.#artifactStore = artifactStore;
    }

    if (agentLoop !== undefined) {
      this.#agentLoop = agentLoop;
    }

    if (completionVerifier !== undefined) {
      this.#completionVerifier =
        completionVerifier;
    }

    this.#executionBudget =
      normalizeRunExecutionBudget(
        executionBudget
      );

    if (createUsageMeter !== undefined) {
      this.#createUsageMeter =
        createUsageMeter;
    }

    if (
      (
        this.#executionBudget
          .maxModelTokens !==
          undefined ||
        this.#executionBudget
          .maxModelCostUsd !==
          undefined
      ) &&
      this.#createUsageMeter === undefined
    ) {
      throw new TypeError(
        "Model usage/cost budgets require createUsageMeter."
      );
    }
  }

  public async createRun(
    input: StartRunInput
  ): Promise<RunSnapshot> {
    const now = new Date().toISOString();
    const runId = randomUUID();
    const snapshot: RunSnapshot = {
      id: runId,
      status: "PENDING",
      goalStatus: "IN_PROGRESS",
      createdAt: now,
      updatedAt: now
    };
    const controller =
      new AbortController();
    const usageMeter =
      this.#createUsageMeter?.(
        runId
      );

    this.#controllers.set(
      runId,
      controller
    );

    try {
      await this.#repository.createRun(
        snapshot,
        input.request
      );

      await this.#repository.appendEvent(
        snapshot.id,
        "RUN_CREATED",
        {
          status: "PENDING",
          goalStatus:
            "IN_PROGRESS"
        }
      );
    } catch (error) {
      this.#controllers.delete(
        runId
      );
      throw error;
    }

    queueMicrotask(() => {
      void this.#execute(
        snapshot.id,
        input,
        controller,
        usageMeter
      );
    });

    return snapshot;
  }

  public getRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    return this.#repository.getRun(runId);
  }

  public async cancelRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    const current =
      await this.#repository.getRun(
        runId
      );

    if (
      current === undefined ||
      current.status === "COMPLETED" ||
      current.status === "FAILED" ||
      current.status === "CANCELLED"
    ) {
      return current;
    }

    const controller =
      this.#controllers.get(runId);

    if (controller !== undefined) {
      if (!controller.signal.aborted) {
        try {
          await this.#repository.appendEvent(
            runId,
            "RUN_CANCELLATION_REQUESTED",
            {
              status: current.status
            }
          );
        } finally {
          controller.abort(
            new RunCancelledError()
          );
        }
      }

      return this.#repository.getRun(
        runId
      );
    }

    await this.#repository.appendEvent(
      runId,
      "RUN_CANCELLATION_REQUESTED",
      {
        status: current.status
      }
    );

    const terminalReason:
      RunTerminalReason = {
        code: "RUN_CANCELLED",
        message:
          "Run cancellation was requested while no active executor owned the run."
      };

    await this.#repository.appendEvent(
      runId,
      "RUN_CANCELLED",
      {
        terminalReason
      }
    );

    return this.#repository.updateRun(
      runId,
      {
        status: "CANCELLED",
        goalStatus: "FAILED",
        terminalReason
      }
    );
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
    if (
      this.#artifactStore === undefined ||
      browser?.getDiagnostics === undefined
    ) {
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
    terminal: RunTerminalState,
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
          status: terminal.status,
          goalStatus:
            terminal.goalStatus,
          terminalReason:
            terminal.terminalReason,
          action: actionSummary(selectedAction),
          timings,
          diagnosticCount,
          ...(terminal.failure === undefined
            ? {}
            : {
                failure:
                  terminal.failure
              }),
          artifactErrors
        }
      });
    } catch {
      // Artifact capture is intentionally best-effort.
    }
  }

  async #persistLoopProgress(
    runId: string,
    progress: AgentLoopProgressEvent
  ): Promise<void> {
    if (progress.type === "OBSERVED") {
      const payload = {
        iteration: progress.iteration,
        actionCount: progress.actions.length,
        actions: progress.actions,
        durationMs: progress.durationMs
      };

      await this.#repository.appendStep(
        runId,
        "AGENT_LOOP_OBSERVE",
        payload
      );
      await this.#repository.appendEvent(
        runId,
        "RUN_PROGRESS",
        { phase: "observe", ...payload }
      );
      return;
    }

    if (progress.type === "DECISION_REJECTED") {
      const payload = {
        iteration: progress.iteration,
        message: progress.message,
        durationMs: progress.durationMs
      };

      await this.#repository.appendStep(
        runId,
        "AGENT_LOOP_DECISION_REJECTED",
        payload
      );
      await this.#repository.appendEvent(
        runId,
        "RUN_PROGRESS",
        { phase: "decision_rejected", ...payload }
      );
      return;
    }

    if (progress.type === "LIMIT_REACHED") {
      const payload = {
        iteration: progress.iteration,
        reason: progress.reason,
        message: progress.message
      };

      await this.#repository.appendStep(
        runId,
        "AGENT_LOOP_LIMIT",
        payload
      );
      await this.#repository.appendEvent(
        runId,
        "RUN_PROGRESS",
        {
          phase: "limit",
          ...payload
        }
      );
      return;
    }

    if (progress.type === "DECIDED") {
      const decision =
        progress.decision.type === "COMPLETE"
          ? {
              type: progress.decision.type,
              rationale: progress.decision.rationale
            }
          : progress.decision;
      const payload = {
        iteration: progress.iteration,
        decision,
        durationMs: progress.durationMs
      };

      await this.#repository.appendStep(
        runId,
        "AGENT_LOOP_DECISION",
        payload
      );
      await this.#repository.appendEvent(
        runId,
        "RUN_PROGRESS",
        { phase: "decision", ...payload }
      );
      return;
    }

    const payload = {
      iteration: progress.iteration,
      action: progress.outcome.action,
      success: progress.outcome.success,
      recoverable: progress.outcome.recoverable,
      effect: progress.outcome.effect,
      effectRisk:
        progress.outcome.effectRisk,
      durationMs: progress.durationMs
    };

    await this.#repository.appendStep(
      runId,
      "AGENT_LOOP_ACTION",
      payload
    );
    await this.#repository.appendEvent(
      runId,
      "RUN_PROGRESS",
      { phase: "action", ...payload }
    );
  }

  async #assertUsageBudget(
    usageMeter:
      AgentUsageMeter | undefined
  ): Promise<void> {
    const limit =
      await usageLimitFailure(
        usageMeter,
        this.#executionBudget
      );

    if (limit !== undefined) {
      throw new RunExecutionError(
        limit.code,
        limit.message
      );
    }
  }

  async #execute(
    runId: string,
    input: StartRunInput,
    controller: AbortController,
    usageMeter:
      AgentUsageMeter | undefined
  ): Promise<void> {
    const totalStartedAt = Date.now();
    const timings: Record<string, number> = {};
    const artifactErrors: string[] = [];
    const signal =
      controller.signal;
    const timeout = setTimeout(
      () => {
        if (!signal.aborted) {
          controller.abort(
            new RunExecutionError(
              "RUN_TIMEOUT",
              "Run exceeded the wall-clock limit of " +
                String(
                  this.#executionBudget
                    .maxDurationMs
                ) +
                " ms."
            )
          );
        }
      },
      this.#executionBudget
        .maxDurationMs
    );

    let browser:
      BrowserSession | undefined;
    let agent:
      AgentSession | undefined;
    let result: unknown;
    let terminal:
      RunTerminalState | undefined;
    let verifiedCompletion = false;
    let selectedAction:
      AgentAction | undefined;
    let pendingLoopScreenshotIteration:
      number | undefined;
    let diagnosticCount: number;

    try {
      throwIfAborted(signal);

      await this.#repository.updateRun(
        runId,
        {
          status: "RUNNING",
          goalStatus:
            "IN_PROGRESS"
        }
      );

      await this.#repository.appendEvent(
        runId,
        "RUN_STARTED",
        {
          status: "RUNNING",
          goalStatus:
            "IN_PROGRESS"
        }
      );

      let startedAt = Date.now();
      browser =
        await this.#browserRuntime.createSession({
          headless: true,
          signal
        });
      throwIfAborted(signal);

      timings.browserCreateMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "BROWSER_CREATED",
        {
          browserId: browser.id,
          viewerAvailable:
            browser.viewerUrl !==
            undefined,
          ...(browser.isolationId ===
            undefined
            ? {}
            : {
                isolationId:
                  browser.isolationId
              })
        }
      );

      startedAt = Date.now();
      agent =
        await this.#agentRuntime.openSession({
          browser,
          signal
        });
      throwIfAborted(signal);

      timings.agentOpenMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "AGENT_OPENED",
        {}
      );

      startedAt = Date.now();
      await agent.navigate(
        input.request.url,
        {
          signal
        }
      );
      throwIfAborted(signal);

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

      if (this.#agentLoop !== undefined) {
        startedAt = Date.now();

        const loopResult =
          await this.#agentLoop.execute({
            session: agent,
            goal:
              input.request.goal,
            limits:
              toAgentLoopLimits(
                this.#executionBudget
              ),
            ...(usageMeter ===
              undefined
              ? {}
              : {
                  usageMeter
                }),
            signal,
            onProgress:
              async (progress) => {
                if (
                  progress.type ===
                  "ACTED"
                ) {
                  selectedAction = {
                    ...progress.outcome
                      .action
                  };
                  pendingLoopScreenshotIteration =
                    progress.iteration;
                } else if (
                  progress.type ===
                    "OBSERVED" &&
                  pendingLoopScreenshotIteration !==
                    undefined &&
                  progress.iteration >
                    pendingLoopScreenshotIteration
                ) {
                  await this.#captureScreenshot(
                    runId,
                    browser,
                    "loop-" +
                      String(
                        pendingLoopScreenshotIteration
                      ).padStart(
                        2,
                        "0"
                      ) +
                      "-after-action.jpg",
                    artifactErrors
                  );
                  pendingLoopScreenshotIteration =
                    undefined;
                }

                await this.#persistLoopProgress(
                  runId,
                  progress
                );
              }
          });
        throwIfAborted(signal);

        if (
          pendingLoopScreenshotIteration !==
          undefined
        ) {
          await this.#captureScreenshot(
            runId,
            browser,
            "loop-" +
              String(
                pendingLoopScreenshotIteration
              ).padStart(2, "0") +
              "-after-action.jpg",
            artifactErrors
          );
          pendingLoopScreenshotIteration =
            undefined;
        }

        timings.loopMs =
          Date.now() - startedAt;

        await this.#repository.appendStep(
          runId,
          "AGENT_LOOP_RESULT",
          {
            kind: loopResult.type,
            goalState:
              loopResult.goalState,
            iterations:
              loopResult.iterations,
            ...(loopResult.type ===
              "COMPLETE"
              ? {}
              : {
                  reason:
                    loopResult.reason
                })
          }
        );

        if (
          loopResult.type ===
          "BLOCKED"
        ) {
          throw new RunExecutionError(
            loopBlockedCode(
              loopResult.reason
            ),
            loopResult.message
          );
        }

        if (
          loopResult.type ===
          "FAIL"
        ) {
          throw new RunExecutionError(
            loopFailureCode(
              loopResult.reason
            ),
            loopResult.message
          );
        }

        result =
          loopResult.result;
      } else {
        startedAt = Date.now();
        const observed =
          await agent.observe(
            input.request.goal,
            {
              signal
            }
          );
        throwIfAborted(signal);

        timings.observeMs =
          Date.now() - startedAt;

        await this.#repository.appendStep(
          runId,
          "OBSERVE",
          {
            actionCount:
              observed.length,
            actions: observed
          }
        );

        await this.#assertUsageBudget(
          usageMeter
        );

        selectedAction =
          observed.find(
            (candidate) =>
              candidate.method !==
                undefined &&
              candidate.method !==
                "not-supported"
          );

        if (
          selectedAction !==
          undefined
        ) {
          startedAt = Date.now();
          const actionResult =
            await agent.act(
              selectedAction,
              {
                signal
              }
            );
          throwIfAborted(signal);

          timings.actMs =
            Date.now() -
            startedAt;

          await this.#repository.appendStep(
            runId,
            "ACT",
            {
              action:
                selectedAction,
              result:
                actionResult
            }
          );

          await this.#assertUsageBudget(
            usageMeter
          );

          if (
            !actionResult.success
          ) {
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

          if (
            input.outputSchema ===
            undefined
          ) {
            result = {
              acted: true,
              action:
                selectedAction,
              message:
                actionResult.message
            };
          }
        } else if (
          input.outputSchema ===
          undefined
        ) {
          throw new RunExecutionError(
            "NO_ACTION_FOUND",
            "The agent found no actionable element for the goal."
          );
        }
      }

      if (
        input.outputSchema !==
        undefined
      ) {
        startedAt = Date.now();
        result =
          await agent.extract(
            input.request.goal,
            input.outputSchema,
            {
              signal
            }
          );
        throwIfAborted(signal);

        timings.extractMs =
          Date.now() - startedAt;

        await this.#repository.appendStep(
          runId,
          "EXTRACT",
          {
            result
          }
        );

        await this.#assertUsageBudget(
          usageMeter
        );
      }

      if (result === undefined) {
        throw new RunExecutionError(
          "COMPLETION_REJECTED",
          "Run produced no result that could be verified."
        );
      }

      const verifier =
        input.completionVerifier ??
        this.#completionVerifier ??
        constOutputCompletionVerifier(
          input.request
        );

      if (verifier === undefined) {
        throw new RunExecutionError(
          "COMPLETION_REJECTED",
          "No completion verifier is configured for this goal."
        );
      }

      startedAt = Date.now();

      let verification:
        Awaited<
          ReturnType<
            RunCompletionVerifier[
              "verify"
            ]
          >
        >;

      try {
        verification =
          await verifier.verify({
            request:
              input.request,
            result,
            signal
          });
        throwIfAborted(signal);
        await this.#assertUsageBudget(
          usageMeter
        );
      } catch {
        throwIfAborted(signal);
        await this.#assertUsageBudget(
          usageMeter
        );
        verification = {
          verified: false,
          message:
            "Completion verifier failed to produce an accepted result."
        };
      }

      timings.verifyMs =
        Date.now() - startedAt;

      if (
        typeof verification
          .verified !==
          "boolean" ||
        typeof verification
          .message !==
          "string" ||
        verification.message.trim()
          .length === 0
      ) {
        throw new RunExecutionError(
          "COMPLETION_REJECTED",
          "Completion verifier returned an invalid verification result."
        );
      }

      await this.#repository.appendStep(
        runId,
        "COMPLETION_VERIFY",
        {
          verified:
            verification.verified,
          message:
            verification.message
        }
      );

      if (!verification.verified) {
        throw new RunExecutionError(
          "COMPLETION_REJECTED",
          verification.message
        );
      }

      verifiedCompletion = true;
    } catch (error) {
      const resolved =
        effectiveError(
          error,
          signal
        );

      if (
        resolved instanceof
          RunCancelledError
      ) {
        terminal = {
          status: "CANCELLED",
          goalStatus: "FAILED",
          terminalReason: {
            code: "RUN_CANCELLED",
            message:
              resolved.message
          }
        };
      } else {
        const failure =
          failureFrom(resolved);

        terminal = {
          status: "FAILED",
          goalStatus:
            failureGoalStatus(
              failure.code
            ),
          terminalReason: {
            code: failure.code,
            message:
              failure.message
          },
          failure
        };

        await this.#captureScreenshot(
          runId,
          browser,
          "failure.jpg",
          artifactErrors
        );
      }
    } finally {
      const cleanupErrors:
        string[] = [];
      let agentClosed = false;
      let browserClosed = false;

      const diagnostics =
        await this.#captureDiagnostics(
          runId,
          browser,
          artifactErrors
        );
      diagnosticCount =
        diagnostics.length;

      const cleanupStartedAt =
        Date.now();

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
        Date.now() -
        cleanupStartedAt;

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
        cleanupErrors.push(
          errorMessage(error)
        );
      }

      if (
        cleanupErrors.length > 0 &&
        (
          terminal === undefined ||
          terminal.status ===
            "CANCELLED"
        )
      ) {
        const failure:
          RunFailure = {
            code:
              "CLEANUP_FAILED",
            message:
              cleanupErrors.join(
                "; "
              )
          };

        terminal = {
          status: "FAILED",
          goalStatus: "FAILED",
          terminalReason: {
            code:
              failure.code,
            message:
              failure.message
          },
          failure
        };
      }
    }

    if (
      terminal === undefined &&
      signal.aborted
    ) {
      const resolved =
        effectiveError(
          new RunCancelledError(),
          signal
        );

      if (
        resolved instanceof
          RunCancelledError
      ) {
        terminal = {
          status: "CANCELLED",
          goalStatus: "FAILED",
          terminalReason: {
            code:
              "RUN_CANCELLED",
            message:
              resolved.message
          }
        };
      } else {
        const failure =
          failureFrom(resolved);

        terminal = {
          status: "FAILED",
          goalStatus:
            failureGoalStatus(
              failure.code
            ),
          terminalReason: {
            code: failure.code,
            message:
              failure.message
          },
          failure
        };
      }
    }

    timings.totalMs =
      Date.now() - totalStartedAt;

    if (terminal === undefined) {
      if (!verifiedCompletion) {
        const failure:
          RunFailure = {
            code:
              "COMPLETION_REJECTED",
            message:
              "Run reached terminal handling without verified completion."
          };

        terminal = {
          status: "FAILED",
          goalStatus: "FAILED",
          terminalReason: {
            code:
              failure.code,
            message:
              failure.message
          },
          failure
        };
      } else {
        terminal = {
          status: "COMPLETED",
          goalStatus: "COMPLETED",
          terminalReason: {
            code:
              "GOAL_COMPLETED",
            message:
              "Completion verifier accepted the run result."
          }
        };
      }
    }

    try {
      await this.#writeSummary(
        runId,
        input,
        terminal,
        selectedAction,
        timings,
        diagnosticCount,
        artifactErrors
      );

      if (
        terminal.status ===
        "CANCELLED"
      ) {
        await this.#repository.appendEvent(
          runId,
          "RUN_CANCELLED",
          {
            goalStatus:
              terminal.goalStatus,
            terminalReason:
              terminal.terminalReason
          }
        );

        await this.#repository.updateRun(
          runId,
          {
            status: "CANCELLED",
            goalStatus:
              terminal.goalStatus,
            terminalReason:
              terminal.terminalReason
          }
        );
        return;
      }

      if (
        terminal.status ===
        "FAILED"
      ) {
        const failure =
          terminal.failure;

        if (failure === undefined) {
          throw new Error(
            "FAILED terminal state requires failure detail."
          );
        }

        await this.#repository.appendEvent(
          runId,
          "RUN_FAILED",
          {
            goalStatus:
              terminal.goalStatus,
            error: failure,
            terminalReason:
              terminal.terminalReason
          }
        );

        await this.#repository.updateRun(
          runId,
          {
            status: "FAILED",
            goalStatus:
              terminal.goalStatus,
            error: failure,
            terminalReason:
              terminal.terminalReason
          }
        );
        return;
      }

      await this.#repository.appendEvent(
        runId,
        "RUN_COMPLETED",
        {
          goalStatus:
            terminal.goalStatus,
          result,
          terminalReason:
            terminal.terminalReason
        }
      );

      await this.#repository.updateRun(
        runId,
        {
          status: "COMPLETED",
          goalStatus:
            terminal.goalStatus,
          result,
          terminalReason:
            terminal.terminalReason
        }
      );
    } finally {
      clearTimeout(timeout);
      this.#controllers.delete(
        runId
      );
    }
  }

}
