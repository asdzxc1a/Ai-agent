import { randomUUID } from "node:crypto";

import {
  AgentLoopExecutor,
  type AgentLoopPolicy
} from "@astra/agent-loop";
import type {
  AgentRuntime
} from "@astra/agent-runtime";
import type {
  ArtifactStore
} from "@astra/artifact-store";
import type {
  BrowserRuntime
} from "@astra/browser-runtime";
import {
  RunEngine,
  type RunExecutionBudget,
  type RunRepository,
  type RunService,
  type RunUsageMeterFactory
} from "@astra/run-engine";
import {
  LocalSandboxRuntime,
  SandboxedBrowserRuntime,
  type SandboxNetworkPolicyOptions,
  type SandboxRuntime
} from "@astra/sandbox-runtime";

import {
  ProspectResearchResultSchema,
  type ApprovedResearchTarget
} from "./schema.js";
import {
  ProspectResearchService,
  ProspectResearchValidationError,
  type RecordCompletedProspectResearchInput,
  type RecordFailedProspectResearchInput
} from "./service.js";
import type {
  ProspectResearchRepository
} from "./repository.js";

export interface StartApprovedProspectResearchInput {
  sampleId: string;
  targetId: string;
}

export type ProspectResearchSandboxRuntimeFactory =
  (
    policy:
      SandboxNetworkPolicyOptions
  ) => SandboxRuntime;

export interface ProspectResearchWorkflowOptions {
  repository:
    ProspectResearchRepository;
  runRepository:
    RunRepository;
  artifactStore:
    ArtifactStore;
  browserRuntime:
    BrowserRuntime;
  agentRuntime:
    AgentRuntime;
  sandboxRuntimeFactory?:
    ProspectResearchSandboxRuntimeFactory;
  executionBudget?:
    RunExecutionBudget;
  createUsageMeter?:
    RunUsageMeterFactory;
  diagnosticsTimeoutMs?: number;
  cleanupTimeoutMs?: number;
}

class ReadOnlyProspectResearchPolicy
  implements AgentLoopPolicy {
  public async decide(
    input: Parameters<
      AgentLoopPolicy["decide"]
    >[0]
  ) {
    void input;

    return {
      type: "COMPLETE" as const,
      rationale:
        "Gate 13 public research is read-only. Observe the approved page, execute no page action, then extract the research result."
    };
  }
}

function researchGoal(
  target:
    ApprovedResearchTarget
): string {
  const companyHint =
    target.companyNameHint ===
      null
      ? ""
      : (
          " The approved company hint is " +
          target.companyNameHint +
          "."
        );
  const icp =
    target.icpContext === null
      ? ""
      : (
          " Operator ICP context: " +
          target.icpContext
        );

  return (
    "Research only the operator-approved public page at " +
    target.startUrl +
    "." +
    companyHint +
    icp +
    " Return a prospect-research result using only facts visible on the current public page. " +
    "Keep hypotheses explicitly inferred, preserve uncertainty, keep unavailable fields unknown, and do not claim evidence from a page you did not observe. " +
    "Do not submit forms, contact anyone, authenticate, or perform any external side effect."
  );
}

function samePageUrl(
  left: string,
  right: string
): boolean {
  try {
    const leftUrl =
      new URL(left);
    const rightUrl =
      new URL(right);

    leftUrl.hash = "";
    rightUrl.hash = "";

    return (
      leftUrl.href ===
      rightUrl.href
    );
  } catch {
    return false;
  }
}

function isTerminal(
  status: string
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

export class ProspectResearchWorkflow {
  readonly #research:
    ProspectResearchService;
  readonly #runRepository:
    RunRepository;
  readonly #artifactStore:
    ArtifactStore;
  readonly #browserRuntime:
    BrowserRuntime;
  readonly #agentRuntime:
    AgentRuntime;
  readonly #sandboxRuntimeFactory:
    ProspectResearchSandboxRuntimeFactory;
  readonly #executionBudget?:
    RunExecutionBudget;
  readonly #createUsageMeter?:
    RunUsageMeterFactory;
  readonly #diagnosticsTimeoutMs?:
    number;
  readonly #cleanupTimeoutMs?:
    number;
  #active:
    | {
        runId: string;
        runs: RunService;
      }
    | undefined;

  public constructor(
    options:
      ProspectResearchWorkflowOptions
  ) {
    this.#runRepository =
      options.runRepository;
    this.#artifactStore =
      options.artifactStore;
    this.#browserRuntime =
      options.browserRuntime;
    this.#agentRuntime =
      options.agentRuntime;
    this.#sandboxRuntimeFactory =
      options
        .sandboxRuntimeFactory ??
      (
        (policy) =>
          new LocalSandboxRuntime(
            policy
          )
      );

    if (
      options.executionBudget !==
      undefined
    ) {
      this.#executionBudget =
        options.executionBudget;
    }

    if (
      options.createUsageMeter !==
      undefined
    ) {
      this.#createUsageMeter =
        options.createUsageMeter;
    }

    if (
      options.diagnosticsTimeoutMs !==
      undefined
    ) {
      this.#diagnosticsTimeoutMs =
        options
          .diagnosticsTimeoutMs;
    }

    if (
      options.cleanupTimeoutMs !==
      undefined
    ) {
      this.#cleanupTimeoutMs =
        options.cleanupTimeoutMs;
    }

    this.#research =
      new ProspectResearchService(
        options.repository,
        options.artifactStore,
        options.runRepository
      );
  }

  public approveTarget(
    input: unknown
  ) {
    return this.#research
      .approveTarget(input);
  }

  public approveTargetBatch(
    input: unknown
  ) {
    return this.#research
      .approveTargetBatch(
        input
      );
  }

  public getApprovedTarget(
    targetId: string
  ) {
    return this.#research
      .getApprovedTarget(
        targetId
      );
  }

  public freezeSample(
    input: unknown
  ) {
    return this.#research
      .freezeSample(input);
  }

  public getSample(
    sampleId: string
  ) {
    return this.#research
      .getSample(sampleId);
  }

  public recordHumanBaseline(
    input: unknown
  ) {
    return this.#research
      .recordHumanBaseline(
        input
      );
  }

  public recordSampleOutcome(
    input: unknown
  ) {
    return this.#research
      .recordSampleOutcome(
        input
      );
  }

  public sampleEvaluation(
    sampleId: string
  ) {
    return this.#research
      .sampleEvaluation(
        sampleId
      );
  }

  async #assertSerialAvailable():
    Promise<void> {
    if (
      this.#active ===
      undefined
    ) {
      return;
    }

    const current =
      await this.#active.runs
        .getRun(
          this.#active.runId
        );

    if (
      current === undefined ||
      isTerminal(
        current.status
      )
    ) {
      this.#active =
        undefined;
      return;
    }

    throw new ProspectResearchValidationError([
      "Gate 13 research workflow is serial; active run still owns the research executor: " +
        this.#active.runId
    ]);
  }

  public async start(
    input:
      StartApprovedProspectResearchInput
  ) {
    await this
      .#assertSerialAvailable();

    const sample =
      await this.#research
        .getSample(
          input.sampleId
        );
    const frozenTarget =
      sample.targets.find(
        (candidate) =>
          candidate.id ===
          input.targetId
      );

    if (
      frozenTarget ===
      undefined
    ) {
      throw new ProspectResearchValidationError([
        "research target is outside the frozen measured sample: " +
          input.targetId
      ]);
    }

    if (
      sample.purpose ===
      "ACCEPTANCE"
    ) {
      const baseline =
        await this.#research
          .getHumanBaselineForTarget(
            sample.id,
            input.targetId
          );

      if (baseline === undefined) {
        throw new ProspectResearchValidationError([
          "Gate 13 acceptance requires a durable human baseline before Astra starts: " +
            input.targetId
        ]);
      }
    }

    const target =
      await this.#research
        .getApprovedTarget(
          input.targetId
        );
    const [
      networkPolicy,
      baseCompletionVerifier
    ] =
      await Promise.all([
        this.#research
          .networkPolicy(
            target.id
          ),
        this.#research
          .completionVerifier(
            target.id
          )
      ]);
    const completionVerifier = {
      async verify(
        input: Parameters<
          typeof baseCompletionVerifier[
            "verify"
          ]
        >[0]
      ) {
        const base =
          await baseCompletionVerifier
            .verify(input);

        if (!base.verified) {
          return base;
        }

        const parsed =
          ProspectResearchResultSchema
            .safeParse(
              input.result
            );

        if (
          !parsed.success ||
          !parsed.data.evidence
            .every(
              (evidence) =>
                samePageUrl(
                  evidence.sourceUrl,
                  target.startUrl
                )
            )
        ) {
          return {
            verified: false,
            message:
              "Read-only Gate 13 research evidence must cite the approved start page that was actually observed."
          };
        }

        return base;
      }
    };
    const sandboxRuntime =
      this.#sandboxRuntimeFactory(
        networkPolicy
      );
    const runs =
      new RunEngine({
        repository:
          this.#runRepository,
        browserRuntime:
          new SandboxedBrowserRuntime({
            sandboxRuntime,
            browserRuntime:
              this.#browserRuntime
          }),
        agentRuntime:
          this.#agentRuntime,
        artifactStore:
          this.#artifactStore,
        agentLoop:
          new AgentLoopExecutor({
            policy:
              new ReadOnlyProspectResearchPolicy(),
            iterationCeiling: 1
          }),
        ...(this.#executionBudget ===
          undefined
          ? {}
          : {
              executionBudget:
                this.#executionBudget
            }),
        ...(this.#createUsageMeter ===
          undefined
          ? {}
          : {
              createUsageMeter:
                this.#createUsageMeter
            }),
        ...(this.#diagnosticsTimeoutMs ===
          undefined
          ? {}
          : {
              diagnosticsTimeoutMs:
                this.#diagnosticsTimeoutMs
            }),
        ...(this.#cleanupTimeoutMs ===
          undefined
          ? {}
          : {
              cleanupTimeoutMs:
                this.#cleanupTimeoutMs
            })
      });
    const runId =
      randomUUID();
    let reservedAcceptanceAttempt =
      false;

    if (
      sample.purpose ===
        "ACCEPTANCE"
    ) {
      await this.#research
        .reserveAcceptanceAttempt({
          sampleId:
            sample.id,
          targetId:
            target.id,
          runId
        });
      reservedAcceptanceAttempt =
        true;
    }

    let started;

    try {
      started =
        await runs.createRun({
          runId,
          request: {
            url:
              target.startUrl,
            goal:
              researchGoal(
                target
              )
          },
          outputSchema:
            ProspectResearchResultSchema,
          completionVerifier
        });
    } catch (error) {
      if (
        reservedAcceptanceAttempt
      ) {
        let durableRun;

        try {
          durableRun =
            await this.#runRepository
              .getRun(
                runId
              );
        } catch (
          lookupError
        ) {
          throw new AggregateError(
            [
              error,
              lookupError
            ],
            "Gate 13 run creation failed and durable run lookup could not determine whether the measured-attempt reservation is safe to release.",
            {
              cause:
                lookupError
            }
          );
        }

        if (
          durableRun ===
            undefined
        ) {
          try {
            await this.#research
              .releaseAcceptanceAttemptReservation(
                sample.id,
                target.id,
                runId
              );
          } catch (
            releaseError
          ) {
            throw new AggregateError(
              [
                error,
                releaseError
              ],
              "Gate 13 run creation failed before durable run creation and the measured-attempt reservation could not be released.",
              {
                cause:
                  releaseError
              }
            );
          }
        }
      }

      throw error;
    }

    this.#active = {
      runId:
        started.id,
      runs
    };

    return started;
  }

  public async getRun(
    runId: string
  ) {
    const run =
      await this.#runRepository
        .getRun(runId);

    if (
      this.#active?.runId ===
        runId &&
      (
        run === undefined ||
        isTerminal(
          run.status
        )
      )
    ) {
      this.#active =
        undefined;
    }

    return run;
  }

  public listArtifacts(
    runId: string
  ) {
    return this.#artifactStore
      .listArtifacts(runId);
  }

  public readArtifact(
    runId: string,
    artifactId: string
  ) {
    return this.#artifactStore
      .readArtifact(
        runId,
        artifactId
      );
  }

  public async cancelRun(
    runId: string
  ) {
    if (
      this.#active?.runId ===
      runId
    ) {
      const result =
        await this.#active.runs
          .cancelRun(runId);

      if (
        result === undefined ||
        isTerminal(
          result.status
        )
      ) {
        this.#active =
          undefined;
      }

      return result;
    }

    const current =
      await this.#runRepository
        .getRun(runId);

    if (
      current === undefined ||
      isTerminal(
        current.status
      )
    ) {
      return current;
    }

    throw new ProspectResearchValidationError([
      "active research executor is not owned by this workflow instance: " +
        runId
    ]);
  }

  public async reviewCompleted(
    input:
      RecordCompletedProspectResearchInput
  ) {
    const attempt =
      await this.#research
        .recordCompleted(input);

    if (
      this.#active?.runId ===
      input.runId
    ) {
      this.#active =
        undefined;
    }

    return attempt;
  }

  public async recordFailure(
    input:
      RecordFailedProspectResearchInput
  ) {
    const attempt =
      await this.#research
        .recordFailure(input);

    if (
      this.#active?.runId ===
      input.runId
    ) {
      this.#active =
        undefined;
    }

    return attempt;
  }
}
