import type {
  ArtifactStore
} from "@astra/artifact-store";

import {
  ApprovedResearchTargetSchema,
  CompletedProspectResearchAttemptSchema,
  FailedProspectResearchAttemptSchema,
  type ApprovedResearchTarget,
  type CompletedProspectResearchAttempt,
  type FailedProspectResearchAttempt
} from "./schema.js";
import type {
  ProspectResearchRepository
} from "./repository.js";
import {
  researchNetworkPolicyOptions,
  sameApprovedResearchTarget,
  validateProspectResearch
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

export class ProspectResearchService {
  readonly #repository:
    ProspectResearchRepository;
  readonly #artifacts:
    ArtifactStore;

  public constructor(
    repository:
      ProspectResearchRepository,
    artifacts: ArtifactStore
  ) {
    this.#repository =
      repository;
    this.#artifacts =
      artifacts;
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

  async #targetErrors(
    target:
      ApprovedResearchTarget
  ): Promise<string[]> {
    const approved =
      await this.#repository
        .getTarget(target.id);

    if (approved === undefined) {
      return [
        "research target was not approved before the attempt"
      ];
    }

    if (
      !sameApprovedResearchTarget(
        approved,
        target
      )
    ) {
      return [
        "research attempt target differs from the stored approval"
      ];
    }

    return [];
  }

  public async networkPolicy(
    targetId: string
  ) {
    const target =
      await this.#repository
        .getTarget(targetId);

    if (target === undefined) {
      throw new ProspectResearchValidationError([
        "research target was not approved before network policy creation"
      ]);
    }

    return researchNetworkPolicyOptions(
      target
    );
  }

  public async recordCompleted(
    input: unknown
  ): Promise<
    CompletedProspectResearchAttempt
  > {
    const attempt =
      CompletedProspectResearchAttemptSchema
        .parse(input);
    const errors = [
      ...(
        await this.#targetErrors(
          attempt.target
        )
      ),
      ...validateProspectResearch(
        attempt.target,
        attempt.report
      )
    ];

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
    input: unknown
  ): Promise<
    FailedProspectResearchAttempt
  > {
    const attempt =
      FailedProspectResearchAttemptSchema
        .parse(input);
    const errors =
      await this.#targetErrors(
        attempt.target
      );

    if (errors.length > 0) {
      throw new ProspectResearchValidationError(
        errors
      );
    }

    await this.#repository
      .saveAttempt(attempt);

    return attempt;
  }
}
