import type {
  ArtifactStore
} from "@astra/artifact-store";
import type {
  RunCompletionVerifier,
  RunService
} from "@astra/run-engine";

import {
  ApprovedResearchTargetSchema,
  FailedProspectResearchAttemptSchema,
  type ApprovedResearchTarget,
  type CompletedProspectResearchAttempt,
  type FailedProspectResearchAttempt,
  type LiveResearchFailureCode
} from "./schema.js";
import type {
  ProspectResearchRepository
} from "./repository.js";
import {
  buildCompletedProspectResearchAttempt,
  isApprovedResearchUrl,
  researchNetworkPolicyOptions,
  validateProspectResearchResult
} from "./validation.js";

type ResearchRunSnapshot =
  NonNullable<
    Awaited<
      ReturnType<
        RunService["getRun"]
      >
    >
  >;

export type ProspectResearchRunReader =
  Pick<
    RunService,
    "getRun"
  >;

export class ProspectResearchValidationError
  extends Error {
  public readonly errors:
    readonly string[];

  public constructor(
    errors:
      readonly string[]
  ) {
    super(
      "Prospect research validation failed: " +
        errors.join("; ")
    );
    this.name =
      "ProspectResearchValidationError";
    this.errors = [
      ...errors
    ];
  }
}

export interface RecordCompletedProspectResearchInput {
  targetId: string;
  runId: string;
  artifactIdsByEvidenceId:
    Readonly<
      Record<
        string,
        readonly string[]
      >
    >;
}

export interface RecordFailedProspectResearchInput {
  targetId: string;
  runId: string;
  code?:
    LiveResearchFailureCode;
}

export class ProspectResearchService {
  readonly #repository:
    ProspectResearchRepository;
  readonly #artifacts:
    ArtifactStore;
  readonly #runs:
    ProspectResearchRunReader;

  public constructor(
    repository:
      ProspectResearchRepository,
    artifacts: ArtifactStore,
    runs:
      ProspectResearchRunReader
  ) {
    this.#repository =
      repository;
    this.#artifacts =
      artifacts;
    this.#runs = runs;
  }

  public approvedTarget(
    input: unknown
  ): ApprovedResearchTarget {
    return ApprovedResearchTargetSchema
      .parse(input);
  }

  public async approveTarget(
    input: unknown
  ): Promise<
    ApprovedResearchTarget
  > {
    const target =
      this.approvedTarget(input);

    await this.#repository
      .saveTarget(target);

    return target;
  }

  async #requireTarget(
    targetId: string,
    missingMessage: string
  ): Promise<
    ApprovedResearchTarget
  > {
    const target =
      await this.#repository
        .getTarget(targetId);

    if (target === undefined) {
      throw new ProspectResearchValidationError([
        missingMessage
      ]);
    }

    return target;
  }

  async #requireRun(
    runId: string
  ): Promise<
    ResearchRunSnapshot
  > {
    const run =
      await this.#runs
        .getRun(runId);

    if (run === undefined) {
      throw new ProspectResearchValidationError([
        "research run was not found: " +
          runId
      ]);
    }

    return run;
  }

  async #assertAttemptAvailable(
    attemptId: string
  ): Promise<void> {
    const existing =
      await this.#repository
        .getAttempt(attemptId);

    if (existing !== undefined) {
      throw new ProspectResearchValidationError([
        "research attempt already exists: " +
          attemptId
      ]);
    }
  }

  #failureCode(
    run: ResearchRunSnapshot,
    requested:
      LiveResearchFailureCode |
      undefined
  ): LiveResearchFailureCode {
    if (
      run.status ===
      "CANCELLED"
    ) {
      if (
        requested !== undefined &&
        requested !== "CANCELLED"
      ) {
        throw new ProspectResearchValidationError([
          "cancelled research run must be classified as CANCELLED"
        ]);
      }

      return "CANCELLED";
    }

    if (
      run.status !== "FAILED"
    ) {
      throw new ProspectResearchValidationError([
        "only FAILED or CANCELLED runs can be persisted as live-research failures"
      ]);
    }

    const terminalCode =
      run.terminalReason?.code;

    if (
      terminalCode ===
      "RUN_TIMEOUT"
    ) {
      if (
        requested !== undefined &&
        requested !== "TIMEOUT"
      ) {
        throw new ProspectResearchValidationError([
          "RUN_TIMEOUT must be classified as TIMEOUT"
        ]);
      }

      return "TIMEOUT";
    }

    if (
      terminalCode ===
      "CLEANUP_FAILED"
    ) {
      if (
        requested !== undefined &&
        requested !==
          "CLEANUP_FAILED"
      ) {
        throw new ProspectResearchValidationError([
          "CLEANUP_FAILED must retain its live-research failure code"
        ]);
      }

      return "CLEANUP_FAILED";
    }

    if (
      requested === undefined
    ) {
      throw new ProspectResearchValidationError([
        "failed research run requires an explicit server-side live-research failure code"
      ]);
    }

    if (
      requested === "CANCELLED"
    ) {
      throw new ProspectResearchValidationError([
        "FAILED research run cannot be classified as CANCELLED"
      ]);
    }

    return requested;
  }

  public async networkPolicy(
    targetId: string
  ) {
    const target =
      await this.#requireTarget(
        targetId,
        "research target was not approved before network policy creation"
      );

    return researchNetworkPolicyOptions(
      target
    );
  }

  public async completionVerifier(
    targetId: string
  ): Promise<
    RunCompletionVerifier
  > {
    const target =
      await this.#requireTarget(
        targetId,
        "research target was not approved before completion verifier creation"
      );

    return {
      verify(input) {
        if (
          !isApprovedResearchUrl(
            target,
            input.request.url
          )
        ) {
          return {
            verified: false,
            message:
              "Research run URL is outside the stored approved domains."
          };
        }

        try {
          validateProspectResearchResult(
            target,
            input.result
          );

          return {
            verified: true,
            message:
              "Prospect research result passed semantic grounding validation."
          };
        } catch {
          return {
            verified: false,
            message:
              "Prospect research result failed semantic grounding validation."
          };
        }
      }
    };
  }

  public async recordCompleted(
    input:
      RecordCompletedProspectResearchInput
  ): Promise<
    CompletedProspectResearchAttempt
  > {
    const target =
      await this.#requireTarget(
        input.targetId,
        "research target was not approved before the attempt"
      );
    const run =
      await this.#requireRun(
        input.runId
      );

    if (
      run.status !==
        "COMPLETED" ||
      run.goalStatus !==
        "COMPLETED" ||
      run.terminalReason?.code !==
        "GOAL_COMPLETED" ||
      run.result === undefined
    ) {
      throw new ProspectResearchValidationError([
        "only a verifier-accepted completed run can be persisted as prospect research"
      ]);
    }

    let result;

    try {
      result =
        validateProspectResearchResult(
          target,
          run.result
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "research result failed validation"
      ]);
    }

    await this.#assertAttemptAvailable(
      run.id
    );

    const artifacts =
      await this.#artifacts
        .listArtifacts(
          run.id
        );
    const artifactById =
      new Map(
        artifacts.map(
          (artifact) =>
            [artifact.id, artifact] as const
        )
      );
    const errors: string[] = [];
    const capturedAtByEvidenceId =
      new Map<string, string>();
    const artifactIdsByEvidenceId =
      new Map<
        string,
        readonly string[]
      >();
    const expectedEvidenceIds =
      result.evidence.map(
        (evidence) =>
          evidence.id
      );
    const suppliedEvidenceIds =
      Object.keys(
        input
          .artifactIdsByEvidenceId
      );

    if (
      expectedEvidenceIds.length !==
        suppliedEvidenceIds.length ||
      expectedEvidenceIds.some(
        (evidenceId) =>
          !suppliedEvidenceIds
            .includes(
              evidenceId
            )
      )
    ) {
      errors.push(
        "server-owned artifact mapping must exactly match research evidence ids"
      );
    }

    for (
      const evidence of
      result.evidence
    ) {
      const suppliedArtifactIds =
        input
          .artifactIdsByEvidenceId[
            evidence.id
          ];
      const screenshotCaptureTimes:
        string[] = [];

      if (
        !Array.isArray(
          suppliedArtifactIds
        ) ||
        suppliedArtifactIds
          .length === 0
      ) {
        errors.push(
          "research evidence requires server-owned artifact IDs: " +
            evidence.id
        );
        continue;
      }

      if (
        new Set(
          suppliedArtifactIds
        ).size !==
          suppliedArtifactIds
            .length
      ) {
        errors.push(
          "research evidence artifact IDs must be unique: " +
            evidence.id
        );
      }

      for (
        const artifactId of
        suppliedArtifactIds
      ) {
        if (
          typeof artifactId !==
          "string"
        ) {
          errors.push(
            "research evidence artifact ID must be a string: " +
              evidence.id
          );
          continue;
        }

        const artifact =
          artifactById.get(
            artifactId
          );

        if (artifact === undefined) {
          errors.push(
            "research evidence references missing run artifact: " +
              evidence.id +
              " -> " +
              artifactId
          );
          continue;
        }

        if (
          artifact.kind ===
          "SCREENSHOT"
        ) {
          screenshotCaptureTimes.push(
            artifact.createdAt
          );
        }
      }

      if (
        screenshotCaptureTimes
          .length === 0
      ) {
        errors.push(
          "research evidence requires a screenshot artifact: " +
            evidence.id
        );
        continue;
      }

      screenshotCaptureTimes
        .sort();
      capturedAtByEvidenceId.set(
        evidence.id,
        screenshotCaptureTimes[0]!
      );
      artifactIdsByEvidenceId.set(
        evidence.id,
        [...suppliedArtifactIds]
      );
    }

    if (errors.length > 0) {
      throw new ProspectResearchValidationError(
        errors
      );
    }

    let attempt:
      CompletedProspectResearchAttempt;

    try {
      attempt =
        buildCompletedProspectResearchAttempt({
          target,
          runId:
            run.id,
          researchedAt:
            run.updatedAt,
          capturedAtByEvidenceId,
          artifactIdsByEvidenceId,
          result
        });
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "research attempt failed validation"
      ]);
    }

    await this.#artifacts
      .putJsonArtifact({
        runId:
          attempt.report.runId,
        kind:
          "RESEARCH_EVIDENCE",
        name:
          "prospect-research-" +
          attempt.id +
          ".json",
        value: attempt,
        metadata: {
          attemptId:
            attempt.id,
          prospectId:
            attempt.report
              .prospect.id,
          targetId:
            attempt.target.id
        }
      });

    await this.#repository
      .saveAttempt(attempt);

    return attempt;
  }

  public async recordFailure(
    input:
      RecordFailedProspectResearchInput
  ): Promise<
    FailedProspectResearchAttempt
  > {
    const target =
      await this.#requireTarget(
        input.targetId,
        "research target was not approved before the attempt"
      );
    const run =
      await this.#requireRun(
        input.runId
      );
    const code =
      this.#failureCode(
        run,
        input.code
      );
    const message =
      run.error?.message ??
      run.terminalReason?.message;

    if (
      message === undefined ||
      message.trim().length === 0
    ) {
      throw new ProspectResearchValidationError([
        "terminal research run has no server-owned failure message"
      ]);
    }

    const attempt =
      FailedProspectResearchAttemptSchema
        .parse({
          id:
            run.id,
          target,
          createdAt:
            run.updatedAt,
          status: "FAILED",
          runId:
            run.id,
          failure: {
            kind:
              "LIVE_RESEARCH_FAILURE",
            code,
            message
          }
        });

    await this.#assertAttemptAvailable(
      attempt.id
    );

    await this.#repository
      .saveAttempt(attempt);

    return attempt;
  }
}
