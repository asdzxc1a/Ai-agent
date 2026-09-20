import { randomUUID } from "node:crypto";

import type {
  AgentAction,
  AgentRuntime,
  AgentSession,
  RuntimeSchema
} from "@astra/agent-runtime";
import type {
  AgentLoopExecutor,
  AgentLoopOutcome,
  AgentLoopProgressEvent,
  AgentLoopTrajectoryEntry
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
  GoalState,
  RunFailure,
  RunFailureCode,
  RunSnapshot,
  RunTerminalReason
} from "@astra/contracts";

import {
  parseCompletionVerificationResult
} from "./completion.js";
import type {
  CompletionVerifier
} from "./completion.js";
import type {
  RunEventRecord,
  RunRepository
} from "./repository.js";

export interface StartRunInput {
  request: CreateRunRequest;
  outputSchema?: RuntimeSchema<Record<string, unknown>>;
}

export type CancelRunResult =
  | {
      kind: "CANCELLED";
      run: RunSnapshot;
    }
  | {
      kind: "TERMINAL";
      run: RunSnapshot;
    }
  | {
      kind: "NOT_ACTIVE";
      run: RunSnapshot;
    };

export interface RunService {
  createRun(input: StartRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | undefined>;
  cancelRun(runId: string): Promise<CancelRunResult | undefined>;

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

type FailedGoalState =
  Extract<
    GoalState,
    "FAILED" | "BLOCKED"
  >;

interface RunFailureState {
  error: RunFailure;
  goalState: FailedGoalState;
}

interface AbortReason {
  code:
    | "CANCELLED"
    | "EXECUTION_TIMEOUT";
  message: string;
}

interface ActiveExecution {
  controller: AbortController;
  done: Promise<void>;
}

type RunTerminalState =
  | {
      status: "COMPLETED";
      goalState: "COMPLETED";
      reason: RunTerminalReason;
    }
  | {
      status: "FAILED";
      goalState: FailedGoalState;
      reason: RunTerminalReason;
      error: RunFailure;
    }
  | {
      status: "CANCELLED";
      goalState: "BLOCKED";
      reason: RunTerminalReason;
      error: RunFailure;
    };

class RunExecutionError extends Error {
  public readonly code: RunFailureCode;
  public readonly goalState:
    FailedGoalState;

  public constructor(
    code: RunFailureCode,
    message: string,
    goalState: FailedGoalState =
      "FAILED"
  ) {
    super(message);
    this.name = "RunExecutionError";
    this.code = code;
    this.goalState = goalState;
  }
}

function failureFrom(
  error: unknown
): RunFailureState {
  if (error instanceof RunExecutionError) {
    return {
      error: {
        code: error.code,
        message: error.message
      },
      goalState:
        error.goalState
    };
  }

  return {
    error: {
      code: "EXECUTION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Run execution failed."
    },
    goalState: "FAILED"
  };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function abortReasonFrom(
  signal: AbortSignal
): AbortReason {
  const reason = signal.reason;

  if (
    isRecord(reason) &&
    reason.code ===
      "EXECUTION_TIMEOUT"
  ) {
    return {
      code: "EXECUTION_TIMEOUT",
      message:
        typeof reason.message ===
          "string"
          ? reason.message
          : "Run exceeded its wall-clock timeout."
    };
  }

  return {
    code: "CANCELLED",
    message:
      isRecord(reason) &&
      typeof reason.message ===
        "string"
        ? reason.message
        : "Run cancelled."
  };
}

function abortError(): Error {
  const error =
    new Error("Run aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(
  signal: AbortSignal
): void {
  if (signal.aborted) {
    throw abortError();
  }
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  throwIfAborted(signal);

  return new Promise<T>(
    (resolve, reject) => {
      const onAbort = () => {
        reject(abortError());
      };

      signal.addEventListener(
        "abort",
        onAbort,
        { once: true }
      );

      promise.then(
        (value) => {
          signal.removeEventListener(
            "abort",
            onAbort
          );
          resolve(value);
        },
        (nested: unknown) => {
          signal.removeEventListener(
            "abort",
            onAbort
          );
          reject(nested);
        }
      );
    }
  );
}

function failureCodeFromReason(
  reason: RunTerminalReason
): RunFailureCode {
  return reason.code ===
    "GOAL_VERIFIED"
    ? "AGENT_LOOP_FAILED"
    : reason.code;
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
  completionVerifier?:
    CompletionVerifier;
  executionTimeoutMs?: number;
}

export class RunEngine implements RunService {
  readonly #repository: RunRepository;
  readonly #browserRuntime: BrowserRuntime;
  readonly #agentRuntime: AgentRuntime;
  readonly #artifactStore?: ArtifactStore;
  readonly #agentLoop?: AgentLoopExecutor;
  readonly #completionVerifier?:
    CompletionVerifier;
  readonly #executionTimeoutMs?:
    number;
  readonly #activeExecutions =
    new Map<string, ActiveExecution>();

  public constructor({
    repository,
    browserRuntime,
    agentRuntime,
    artifactStore,
    agentLoop,
    completionVerifier,
    executionTimeoutMs
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

    if (
      completionVerifier !==
      undefined
    ) {
      this.#completionVerifier =
        completionVerifier;
    }

    if (
      executionTimeoutMs !==
      undefined
    ) {
      if (
        !Number.isFinite(
          executionTimeoutMs
        ) ||
        executionTimeoutMs <= 0
      ) {
        throw new RangeError(
          "executionTimeoutMs must be a positive finite number."
        );
      }

      this.#executionTimeoutMs =
        executionTimeoutMs;
    }
  }

  public async createRun(
    input: StartRunInput
  ): Promise<RunSnapshot> {
    const now = new Date().toISOString();
    const snapshot: RunSnapshot = {
      id: randomUUID(),
      status: "PENDING",
      goalState: "IN_PROGRESS",
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

    const controller =
      new AbortController();
    let resolveDone:
      (() => void) | undefined;
    const done =
      new Promise<void>((resolve) => {
        resolveDone = resolve;
      });

    this.#activeExecutions.set(
      snapshot.id,
      {
        controller,
        done
      }
    );

    queueMicrotask(() => {
      void this.#execute(
        snapshot.id,
        input,
        controller
      )
        .catch(() => undefined)
        .finally(() => {
          this.#activeExecutions.delete(
            snapshot.id
          );
          resolveDone?.();
        });
    });

    return snapshot;
  }

  public async cancelRun(
    runId: string
  ): Promise<CancelRunResult | undefined> {
    const current =
      await this.#repository.getRun(
        runId
      );

    if (current === undefined) {
      return undefined;
    }

    if (
      current.status ===
        "COMPLETED" ||
      current.status === "FAILED" ||
      current.status ===
        "CANCELLED"
    ) {
      return {
        kind: "TERMINAL",
        run: current
      };
    }

    const active =
      this.#activeExecutions.get(
        runId
      );

    if (active === undefined) {
      return {
        kind: "NOT_ACTIVE",
        run: current
      };
    }

    if (
      !active.controller.signal
        .aborted
    ) {
      active.controller.abort({
        code: "CANCELLED",
        message:
          "Run cancelled by request."
      });
    }

    await active.done;

    const cancelled =
      await this.#repository.getRun(
        runId
      );

    if (cancelled === undefined) {
      return undefined;
    }

    if (
      cancelled.status ===
      "CANCELLED"
    ) {
      return {
        kind: "CANCELLED",
        run: cancelled
      };
    }

    if (
      cancelled.status ===
        "COMPLETED" ||
      cancelled.status ===
        "FAILED"
    ) {
      return {
        kind: "TERMINAL",
        run: cancelled
      };
    }

    return {
      kind: "NOT_ACTIVE",
      run: cancelled
    };
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
          goalState:
            terminal.goalState,
          terminalReason:
            terminal.reason,
          action:
            actionSummary(
              selectedAction
            ),
          timings,
          diagnosticCount,
          ...(
            "error" in terminal
              ? {
                  failure:
                    terminal.error
                }
              : {}
          ),
          artifactErrors
        }
      });
    } catch {
      // Artifact capture is intentionally best-effort.
    }
  }

  async #verifyCompletion(
    input: StartRunInput,
    candidateResult: unknown,
    trajectory:
      readonly AgentLoopTrajectoryEntry[],
    signal: AbortSignal
  ): Promise<void> {
    if (
      this.#completionVerifier ===
      undefined
    ) {
      throw new RunExecutionError(
        "COMPLETION_REJECTED",
        "No owned completion verifier accepted the run result."
      );
    }

    const rawVerification =
      await abortable(
        this.#completionVerifier.verify({
          url: input.request.url,
          goal: input.request.goal,
          candidateResult,
          source:
            this.#agentLoop ===
            undefined
              ? "ONE_STEP"
              : "AGENT_LOOP",
          trajectory:
            structuredClone(
              trajectory
            ),
          signal
        }),
        signal
      );

    let verification;

    try {
      verification =
        parseCompletionVerificationResult(
          rawVerification
        );
    } catch {
      throw new RunExecutionError(
        "COMPLETION_REJECTED",
        "Completion verifier returned an invalid decision."
      );
    }

    if (!verification.verified) {
      throw new RunExecutionError(
        "COMPLETION_REJECTED",
        verification.message,
        verification.goalState
      );
    }
  }

  async #persistLoopProgress(
    runId: string,
    browser: BrowserSession | undefined,
    progress: AgentLoopProgressEvent,
    artifactErrors: string[]
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

    await this.#captureScreenshot(
      runId,
      browser,
      "loop-" +
        String(progress.iteration).padStart(2, "0") +
        "-after-action.jpg",
      artifactErrors
    );
  }

  async #execute(
    runId: string,
    input: StartRunInput,
    controller: AbortController
  ): Promise<void> {
    const signal =
      controller.signal;
    const totalStartedAt =
      Date.now();
    const timings:
      Record<string, number> = {};
    const artifactErrors:
      string[] = [];

    let timeoutHandle:
      ReturnType<
        typeof setTimeout
      > | undefined;

    if (
      this.#executionTimeoutMs !==
      undefined
    ) {
      timeoutHandle = setTimeout(
        () => {
          if (!signal.aborted) {
            controller.abort({
              code:
                "EXECUTION_TIMEOUT",
              message:
                "Run exceeded its wall-clock timeout."
            });
          }
        },
        this.#executionTimeoutMs
      );
    }

    let browser:
      BrowserSession | undefined;
    let agent:
      AgentSession | undefined;
    let result: unknown;
    let failure:
      RunFailureState | undefined;
    let abortReason:
      AbortReason | undefined;
    let selectedAction:
      AgentAction | undefined;
    let diagnosticCount: number;
    let trajectory:
      readonly AgentLoopTrajectoryEntry[] =
      [];

    try {
      throwIfAborted(signal);

      await this.#repository.updateRun(
        runId,
        {
          status: "RUNNING"
        }
      );

      await this.#repository.appendEvent(
        runId,
        "RUN_STARTED",
        {
          status: "RUNNING",
          goalState:
            "IN_PROGRESS"
        }
      );

      let startedAt = Date.now();
      browser =
        await this.#browserRuntime.createSession({
          headless: true,
          signal
        });
      timings.browserCreateMs =
        Date.now() - startedAt;

      throwIfAborted(signal);

      await this.#repository.appendStep(
        runId,
        "BROWSER_CREATED",
        {
          browserId: browser.id,
          viewerAvailable:
            browser.viewerUrl !==
            undefined
        }
      );

      startedAt = Date.now();
      agent =
        await this.#agentRuntime.openSession({
          browser,
          signal
        });
      timings.agentOpenMs =
        Date.now() - startedAt;

      throwIfAborted(signal);

      await this.#repository.appendStep(
        runId,
        "AGENT_OPENED",
        {}
      );

      startedAt = Date.now();
      await abortable(
        agent.navigate(
          input.request.url
        ),
        signal
      );
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

      if (
        this.#agentLoop !==
        undefined
      ) {
        startedAt = Date.now();

        const loopResult:
          AgentLoopOutcome =
          await this.#agentLoop.execute({
            session: agent,
            goal:
              input.request.goal,
            signal,
            onProgress: async (
              progress
            ) => {
              if (
                progress.type ===
                "ACTED"
              ) {
                selectedAction = {
                  ...progress
                    .outcome.action
                };
              }

              await this.#persistLoopProgress(
                runId,
                browser,
                progress,
                artifactErrors
              );
            }
          });

        timings.loopMs =
          Date.now() - startedAt;
        trajectory =
          loopResult.trajectory;

        await this.#repository.appendStep(
          runId,
          "AGENT_LOOP_RESULT",
          {
            kind:
              loopResult.type,
            iterations:
              loopResult.iterations,
            ...(loopResult.type ===
            "COMPLETE"
              ? {}
              : {
                  reasonCode:
                    loopResult.reason
                      .code
                })
          }
        );

        if (
          loopResult.type ===
          "BLOCKED"
        ) {
          throw new RunExecutionError(
            failureCodeFromReason(
              loopResult.reason
            ),
            loopResult.message,
            "BLOCKED"
          );
        }

        if (
          loopResult.type ===
          "FAIL"
        ) {
          throw new RunExecutionError(
            failureCodeFromReason(
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
          await abortable(
            agent.observe(
              input.request.goal
            ),
            signal
          );
        timings.observeMs =
          Date.now() -
          startedAt;

        await this.#repository.appendStep(
          runId,
          "OBSERVE",
          {
            actionCount:
              observed.length,
            actions: observed
          }
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
            await abortable(
              agent.act(
                selectedAction
              ),
              signal
            );
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
                actionSummary(
                  selectedAction
                ),
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
          await abortable(
            agent.extract(
              input.request.goal,
              input.outputSchema
            ),
            signal
          );
        timings.extractMs =
          Date.now() -
          startedAt;

        await this.#repository.appendStep(
          runId,
          "EXTRACT",
          {
            result
          }
        );
      }

      if (result === undefined) {
        throw new RunExecutionError(
          "COMPLETION_REJECTED",
          "Run produced no candidate result for completion verification."
        );
      }

      startedAt = Date.now();
      await this.#verifyCompletion(
        input,
        result,
        trajectory,
        signal
      );
      timings.verifyMs =
        Date.now() - startedAt;

      await this.#repository.appendStep(
        runId,
        "GOAL_VERIFIED",
        {
          verified: true
        }
      );
    } catch (error) {
      if (
        error instanceof
        RunExecutionError
      ) {
        failure =
          failureFrom(error);
      } else if (
        signal.aborted
      ) {
        abortReason =
          abortReasonFrom(
            signal
          );
      } else {
        failure =
          failureFrom(error);
      }

      await this.#captureScreenshot(
        runId,
        browser,
        "failure.jpg",
        artifactErrors
      );
    } finally {
      if (
        timeoutHandle !==
        undefined
      ) {
        clearTimeout(
          timeoutHandle
        );
      }

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
        cleanupErrors.length > 0
      ) {
        failure = {
          error: {
            code:
              "CLEANUP_FAILED",
            message:
              cleanupErrors.join(
                "; "
              )
          },
          goalState: "FAILED"
        };
        abortReason = undefined;
      }
    }

    timings.totalMs =
      Date.now() -
      totalStartedAt;

    let terminal:
      RunTerminalState;

    if (failure !== undefined) {
      terminal = {
        status: "FAILED",
        goalState:
          failure.goalState,
        reason: {
          code:
            failure.error.code,
          message:
            failure.error.message
        },
        error: failure.error
      };
    } else if (
      abortReason !== undefined
    ) {
      const error:
        RunFailure = {
          code:
            abortReason.code,
          message:
            abortReason.message
        };

      terminal =
        abortReason.code ===
        "CANCELLED"
          ? {
              status:
                "CANCELLED",
              goalState:
                "BLOCKED",
              reason:
                abortReason,
              error
            }
          : {
              status: "FAILED",
              goalState:
                "BLOCKED",
              reason:
                abortReason,
              error
            };
    } else {
      terminal = {
        status: "COMPLETED",
        goalState:
          "COMPLETED",
        reason: {
          code:
            "GOAL_VERIFIED",
          message:
            "Owned completion verifier accepted the run result."
        }
      };
    }

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
          goalState:
            terminal.goalState,
          reason:
            terminal.reason
        }
      );

      await this.#repository.updateRun(
        runId,
        {
          status: "CANCELLED",
          goalState:
            terminal.goalState,
          terminalReason:
            terminal.reason,
          error:
            terminal.error
        }
      );
      return;
    }

    if (
      terminal.status ===
      "FAILED"
    ) {
      await this.#repository.appendEvent(
        runId,
        "RUN_FAILED",
        {
          goalState:
            terminal.goalState,
          reason:
            terminal.reason,
          error:
            terminal.error
        }
      );

      await this.#repository.updateRun(
        runId,
        {
          status: "FAILED",
          goalState:
            terminal.goalState,
          terminalReason:
            terminal.reason,
          error:
            terminal.error
        }
      );
      return;
    }

    await this.#repository.appendEvent(
      runId,
      "RUN_COMPLETED",
      {
        goalState:
          terminal.goalState,
        reason:
          terminal.reason,
        result
      }
    );

    await this.#repository.updateRun(
      runId,
      {
        status: "COMPLETED",
        goalState:
          "COMPLETED",
        terminalReason:
          terminal.reason,
        result
      }
    );
  }

}
