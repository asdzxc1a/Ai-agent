import { createHash } from "node:crypto";

import type {
  ArtifactStore
} from "@astra/artifact-store";
import type {
  RunCompletionVerifier,
  RunRepository,
  RunStepRecord
} from "@astra/run-engine";

import {
  ApprovedResearchTargetSchema,
  ResearchApprovalBatchSchema,
  FailedProspectResearchAttemptSchema,
  ProspectResearchAttemptReservationInputSchema,
  ProspectResearchModelUsageSchema,
  ProspectResearchHumanBaselineInputSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  type ApprovedResearchTarget,
  type ResearchApprovalBatch,
  type CompletedProspectResearchAttempt,
  type FailedProspectResearchAttempt,
  type LiveResearchFailureCode,
  type ProspectResearchAttemptReservation,
  type ProspectResearchCaptureReceipt,
  type ProspectResearchHumanBaseline,
  type ProspectResearchModelUsage,
  type ProspectResearchSample,
  type ProspectResearchSampleOutcome
} from "./schema.js";
import {
  evaluateProspectResearchSample,
  type ProspectResearchSampleEvaluation
} from "./measurement.js";
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
        RunRepository["getRun"]
      >
    >
  >;

export type ProspectResearchRunReader =
  Pick<
    RunRepository,
    "getRun" |
    "listSteps"
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

  public async approveTargetBatch(
    input: unknown
  ): Promise<
    ResearchApprovalBatch
  > {
    const batch =
      ResearchApprovalBatchSchema
        .parse(input);

    try {
      await this.#repository
        .saveTargetBatch(
          batch
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "research approval batch could not be saved"
      ]);
    }

    return batch;
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

  async #runMeasurements(
    run:
      ResearchRunSnapshot
  ): Promise<{
    runDurationMs: number;
    unauthorizedActions: number;
    modelUsage?:
      ProspectResearchModelUsage;
  }> {
    const startedAt =
      Date.parse(
        run.createdAt
      );
    const finishedAt =
      Date.parse(
        run.updatedAt
      );

    if (
      !Number.isFinite(
        startedAt
      ) ||
      !Number.isFinite(
        finishedAt
      ) ||
      finishedAt <=
        startedAt
    ) {
      throw new ProspectResearchValidationError([
        "research run timestamps cannot produce a valid server-owned duration"
      ]);
    }

    const steps:
      RunStepRecord[] =
      await this.#runs
        .listSteps(
          run.id
        );
    const unauthorizedActions =
      steps.filter(
        (step) =>
          step.kind ===
            "ACT" ||
          step.kind ===
            "AGENT_LOOP_ACTION"
      ).length;
    const modelUsageSteps =
      steps.filter(
        (step) =>
          step.kind ===
            "AGENT_MODEL_USAGE"
      );

    if (
      modelUsageSteps.length >
        1
    ) {
      throw new ProspectResearchValidationError([
        "research run contains multiple durable model-usage steps"
      ]);
    }

    let modelUsage:
      ProspectResearchModelUsage |
      undefined;

    if (
      modelUsageSteps.length ===
        1
    ) {
      try {
        modelUsage =
          ProspectResearchModelUsageSchema
            .parse(
              modelUsageSteps[0]!
                .payload
            );
      } catch {
        throw new ProspectResearchValidationError([
          "research run contains invalid durable model-usage evidence"
        ]);
      }
    }

    return {
      runDurationMs:
        finishedAt -
        startedAt,
      unauthorizedActions,
      ...(modelUsage ===
        undefined
        ? {}
        : {
            modelUsage
          })
    };
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

  public async freezeSample(
    input: unknown
  ): Promise<
    ProspectResearchSample
  > {
    const sample =
      ProspectResearchSampleSchema
        .parse(input);

    try {
      await this.#repository
        .saveSample(sample);
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "measured research sample could not be frozen"
      ]);
    }

    return sample;
  }

  public async getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample
  > {
    const sample =
      await this.#repository
        .getSample(sampleId);

    if (sample === undefined) {
      throw new ProspectResearchValidationError([
        "measured research sample does not exist: " +
          sampleId
      ]);
    }

    return sample;
  }

  public async recordHumanBaseline(
    input: unknown
  ): Promise<
    ProspectResearchHumanBaseline
  > {
    const parsed =
      ProspectResearchHumanBaselineInputSchema
        .parse(input);

    try {
      return await this.#repository
        .saveHumanBaseline(
          parsed
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "human baseline could not be recorded"
      ]);
    }
  }

  public async getHumanBaselineForTarget(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  > {
    return this.#repository
      .getHumanBaselineForTarget(
        sampleId,
        targetId
      );
  }

  public async reserveAcceptanceAttempt(
    input: unknown
  ): Promise<
    ProspectResearchAttemptReservation
  > {
    const parsed =
      ProspectResearchAttemptReservationInputSchema
        .parse(input);

    try {
      return await this.#repository
        .reserveAcceptanceAttempt(
          parsed
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "Gate 13 acceptance attempt could not be reserved"
      ]);
    }
  }

  public async releaseAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string,
    runId: string
  ): Promise<void> {
    try {
      const run =
        await this.#runs
          .getRun(
            runId
          );

      if (
        run !== undefined
      ) {
        throw new Error(
          "Gate 13 measured-attempt reservation cannot be released because its durable run exists."
        );
      }

      await this.#repository
        .releaseAcceptanceAttemptReservation(
          sampleId,
          targetId,
          runId
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "Gate 13 acceptance attempt reservation could not be released"
      ]);
    }
  }

  public getAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchAttemptReservation |
    undefined
  > {
    return this.#repository
      .getAcceptanceAttemptReservation(
        sampleId,
        targetId
      );
  }

  public async recordSampleOutcome(
    input: unknown
  ): Promise<
    ProspectResearchSampleOutcome
  > {
    const outcome =
      ProspectResearchSampleOutcomeSchema
        .parse(input);

    try {
      await this.#repository
        .saveSampleOutcome(
          outcome
        );
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "measured research outcome could not be recorded"
      ]);
    }

    return outcome;
  }

  public async sampleEvaluation(
    sampleId: string
  ): Promise<
    ProspectResearchSampleEvaluation
  > {
    const sample =
      await this.getSample(
        sampleId
      );
    const outcomes =
      await this.#repository
        .listSampleOutcomes(
          sampleId
        );

    return evaluateProspectResearchSample(
      sample,
      outcomes
    );
  }

  public getApprovedTarget(
    targetId: string
  ): Promise<ApprovedResearchTarget> {
    return this.#requireTarget(
      targetId,
      "research target was not approved before workflow execution"
    );
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
    const captureReceiptsByEvidenceId =
      new Map<
        string,
        readonly ProspectResearchCaptureReceipt[]
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
      const captureReceipts:
        ProspectResearchCaptureReceipt[] = [];

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
          const metadata =
            artifact.metadata;
          const captureVersion =
            metadata?.captureVersion;
          const semanticSettled =
            metadata?.semanticSettled;
          const pageUrl =
            metadata?.pageUrl;
          const pageContentSha256 =
            metadata
              ?.pageContentSha256;
          const screenshotSha256 =
            metadata
              ?.screenshotSha256;
          const shaPattern =
            /^[a-f0-9]{64}$/;

          if (
            captureVersion !==
              "page-evidence-v1" ||
            semanticSettled !==
              true ||
            typeof pageUrl !==
              "string" ||
            typeof pageContentSha256 !==
              "string" ||
            !shaPattern.test(
              pageContentSha256
            ) ||
            typeof screenshotSha256 !==
              "string" ||
            !shaPattern.test(
              screenshotSha256
            )
          ) {
            errors.push(
              "research screenshot is missing a server-owned page capture receipt: " +
                evidence.id +
                " -> " +
                artifactId
            );
            continue;
          }

          let sourceHref:
            string | undefined;
          let pageHref:
            string | undefined;

          try {
            sourceHref =
              new URL(
                evidence.sourceUrl
              ).href;
            pageHref =
              new URL(
                pageUrl
              ).href;
          } catch {
            sourceHref =
              undefined;
            pageHref =
              undefined;
          }

          if (
            sourceHref ===
              undefined ||
            pageHref !==
              sourceHref
          ) {
            errors.push(
              "research screenshot page URL must match evidence source URL: " +
                evidence.id +
                " -> " +
                artifactId
            );
            continue;
          }

          const content =
            await this.#artifacts
              .readArtifact(
                run.id,
                artifactId
              );

          if (
            content ===
            undefined
          ) {
            errors.push(
              "research screenshot content is unavailable: " +
                evidence.id +
                " -> " +
                artifactId
            );
            continue;
          }

          const computedScreenshotSha256 =
            createHash(
              "sha256"
            )
              .update(
                content.data
              )
              .digest("hex");

          if (
            computedScreenshotSha256 !==
              screenshotSha256
          ) {
            errors.push(
              "research screenshot hash does not match server-owned capture metadata: " +
                evidence.id +
                " -> " +
                artifactId
            );
            continue;
          }

          screenshotCaptureTimes.push(
            artifact.createdAt
          );
          captureReceipts.push({
            artifactId,
            captureVersion,
            semanticSettled,
            pageUrl,
            capturedAt:
              artifact.createdAt,
            pageContentSha256,
            screenshotSha256
          });
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
      captureReceiptsByEvidenceId.set(
        evidence.id,
        captureReceipts
          .sort(
            (left, right) =>
              left.capturedAt
                .localeCompare(
                  right.capturedAt
                )
          )
      );
    }

    if (errors.length > 0) {
      throw new ProspectResearchValidationError(
        errors
      );
    }

    const measurements =
      await this.#runMeasurements(
        run
      );
    let attempt:
      CompletedProspectResearchAttempt;

    try {
      attempt =
        buildCompletedProspectResearchAttempt({
          target,
          runId:
            run.id,
          startedAt:
            run.createdAt,
          researchedAt:
            run.updatedAt,
          runDurationMs:
            measurements
              .runDurationMs,
          unauthorizedActions:
            measurements
              .unauthorizedActions,
          ...(measurements
            .modelUsage ===
              undefined
            ? {}
            : {
                modelUsage:
                  measurements
                    .modelUsage
              }),
          capturedAtByEvidenceId,
          artifactIdsByEvidenceId,
          captureReceiptsByEvidenceId,
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

    const measurements =
      await this.#runMeasurements(
        run
      );
    const attempt =
      FailedProspectResearchAttemptSchema
        .parse({
          id:
            run.id,
          target,
          startedAt:
            run.createdAt,
          createdAt:
            run.updatedAt,
          runDurationMs:
            measurements
              .runDurationMs,
          unauthorizedActions:
            measurements
              .unauthorizedActions,
          ...(measurements
            .modelUsage ===
              undefined
            ? {}
            : {
                modelUsage:
                  measurements
                    .modelUsage
              }),
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
