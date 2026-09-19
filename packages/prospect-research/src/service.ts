import {
  randomUUID
} from "node:crypto";

import type {
  ArtifactStore
} from "@astra/artifact-store";
import type {
  RunCompletionVerifier
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
  result: unknown;
}

export interface RecordFailedProspectResearchInput {
  targetId: string;
  runId: string | null;
  code: LiveResearchFailureCode;
  message: string;
}

export type ProspectResearchClock =
  () => Date;

export class ProspectResearchService {
  readonly #repository:
    ProspectResearchRepository;
  readonly #artifacts:
    ArtifactStore;
  readonly #clock:
    ProspectResearchClock;

  public constructor(
    repository:
      ProspectResearchRepository,
    artifacts: ArtifactStore,
    clock:
      ProspectResearchClock =
        () => new Date()
  ) {
    this.#repository =
      repository;
    this.#artifacts =
      artifacts;
    this.#clock = clock;
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

  #timestamp(): string {
    return this.#clock()
      .toISOString();
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

    let attempt:
      CompletedProspectResearchAttempt;

    try {
      attempt =
        buildCompletedProspectResearchAttempt({
          target,
          runId:
            input.runId,
          researchedAt:
            this.#timestamp(),
          result:
            input.result
        });
    } catch (error) {
      throw new ProspectResearchValidationError([
        error instanceof Error
          ? error.message
          : "research result failed validation"
      ]);
    }

    await this.#assertAttemptAvailable(
      attempt.id
    );

    const artifacts =
      await this.#artifacts
        .listArtifacts(
          attempt.report.runId
        );
    const artifactById =
      new Map(
        artifacts.map(
          (artifact) =>
            [artifact.id, artifact] as const
        )
      );
    const errors: string[] = [];

    for (
      const evidence of
      attempt.report.evidence
    ) {
      let hasScreenshot = false;

      for (
        const artifactId of
        evidence.artifactIds
      ) {
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
          hasScreenshot = true;
        }
      }

      if (!hasScreenshot) {
        errors.push(
          "research evidence requires a screenshot artifact: " +
            evidence.id
        );
      }
    }

    if (errors.length > 0) {
      throw new ProspectResearchValidationError(
        errors
      );
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
    const attempt =
      FailedProspectResearchAttemptSchema
        .parse({
          id:
            input.runId ??
            randomUUID(),
          target,
          createdAt:
            this.#timestamp(),
          status: "FAILED",
          runId:
            input.runId,
          failure: {
            kind:
              "LIVE_RESEARCH_FAILURE",
            code:
              input.code,
            message:
              input.message
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
