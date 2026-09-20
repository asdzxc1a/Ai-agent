import type {
  Prospect
} from "@astra/sales-domain";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  type ApprovedResearchTarget,
  type ProspectResearchAttempt,
  type ProspectResearchSample,
  type ProspectResearchSampleOutcome
} from "./schema.js";
import {
  validateProspectResearchSampleOutcomeContext
} from "./measurement.js";
import {
  sameApprovedResearchTarget,
  validateProspectResearchAttemptForPersistence
} from "./validation.js";

export interface ProspectResearchRepository {
  saveTarget(
    target:
      ApprovedResearchTarget
  ): Promise<void>;

  getTarget(
    targetId: string
  ): Promise<
    ApprovedResearchTarget |
    undefined
  >;

  listTargets(): Promise<
    ApprovedResearchTarget[]
  >;

  saveAttempt(
    attempt:
      ProspectResearchAttempt
  ): Promise<void>;

  getAttempt(
    attemptId: string
  ): Promise<
    ProspectResearchAttempt |
    undefined
  >;

  getProspect(
    prospectId: string
  ): Promise<
    Prospect | undefined
  >;

  listAttemptsForTarget(
    targetId: string
  ): Promise<
    ProspectResearchAttempt[]
  >;

  saveSample(
    sample:
      ProspectResearchSample
  ): Promise<void>;

  getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample |
    undefined
  >;

  saveSampleOutcome(
    outcome:
      ProspectResearchSampleOutcome
  ): Promise<void>;

  listSampleOutcomes(
    sampleId: string
  ): Promise<
    ProspectResearchSampleOutcome[]
  >;
}

export class InMemoryProspectResearchRepository
  implements ProspectResearchRepository {
  readonly #targets =
    new Map<
      string,
      ApprovedResearchTarget
    >();
  readonly #attempts =
    new Map<
      string,
      ProspectResearchAttempt
    >();
  readonly #prospects =
    new Map<string, Prospect>();
  readonly #samples =
    new Map<
      string,
      ProspectResearchSample
    >();
  readonly #sampleOutcomes =
    new Map<
      string,
      ProspectResearchSampleOutcome
    >();

  public async saveTarget(
    input:
      ApprovedResearchTarget
  ): Promise<void> {
    const target =
      ApprovedResearchTargetSchema
        .parse(input);

    if (
      this.#targets.has(
        target.id
      )
    ) {
      throw new Error(
        "Research target already exists: " +
          target.id
      );
    }

    this.#targets.set(
      target.id,
      structuredClone(target)
    );
  }

  public async getTarget(
    targetId: string
  ): Promise<
    ApprovedResearchTarget |
    undefined
  > {
    const target =
      this.#targets.get(
        targetId
      );

    return target === undefined
      ? undefined
      : structuredClone(
          target
        );
  }

  public async listTargets(): Promise<
    ApprovedResearchTarget[]
  > {
    return [
      ...this.#targets.values()
    ]
      .map(
        (target) =>
          structuredClone(
            target
          )
      )
      .sort(
        (left, right) =>
          left.approval
            .approvedAt
            .localeCompare(
              right.approval
                .approvedAt
            ) ||
          left.id.localeCompare(
            right.id
          )
      );
  }

  public async saveAttempt(
    attempt:
      ProspectResearchAttempt
  ): Promise<void> {
    const parsed =
      validateProspectResearchAttemptForPersistence(
        attempt
      );

    const approved =
      this.#targets.get(
        parsed.target.id
      );

    if (approved === undefined) {
      throw new Error(
        "Research target was not approved before the attempt."
      );
    }

    if (
      !sameApprovedResearchTarget(
        approved,
        parsed.target
      )
    ) {
      throw new Error(
        "Research attempt target differs from the stored approval."
      );
    }

    if (
      this.#attempts.has(
        parsed.id
      )
    ) {
      throw new Error(
        "Research attempt already exists: " +
          parsed.id
      );
    }

    this.#attempts.set(
      parsed.id,
      structuredClone(parsed)
    );

    if (
      parsed.status ===
      "COMPLETED"
    ) {
      this.#prospects.set(
        parsed.report.prospect.id,
        structuredClone(
          parsed.report.prospect
        )
      );
    }
  }

  public async getAttempt(
    attemptId: string
  ): Promise<
    ProspectResearchAttempt |
    undefined
  > {
    const attempt =
      this.#attempts.get(
        attemptId
      );

    return attempt === undefined
      ? undefined
      : structuredClone(
          attempt
        );
  }

  public async getProspect(
    prospectId: string
  ): Promise<
    Prospect | undefined
  > {
    const prospect =
      this.#prospects.get(
        prospectId
      );

    return prospect === undefined
      ? undefined
      : structuredClone(
          prospect
        );
  }

  public async listAttemptsForTarget(
    targetId: string
  ): Promise<
    ProspectResearchAttempt[]
  > {
    return [
      ...this.#attempts
        .values()
    ]
      .filter(
        (attempt) =>
          attempt.target.id ===
          targetId
      )
      .map(
        (attempt) =>
          structuredClone(
            attempt
          )
      )
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(
            right.createdAt
          ) ||
          left.id.localeCompare(
            right.id
          )
      );
  }

  public async saveSample(
    input:
      ProspectResearchSample
  ): Promise<void> {
    const sample =
      ProspectResearchSampleSchema
        .parse(input);

    if (
      this.#samples.has(
        sample.id
      )
    ) {
      throw new Error(
        "Measured research sample already exists: " +
          sample.id
      );
    }

    for (
      const target of
      sample.targets
    ) {
      const approved =
        this.#targets.get(
          target.id
        );

      if (approved === undefined) {
        throw new Error(
          "Measured research sample target was not approved: " +
            target.id
        );
      }

      if (
        !sameApprovedResearchTarget(
          approved,
          target
        )
      ) {
        throw new Error(
          "Measured research sample target differs from the stored approval: " +
            target.id
        );
      }
    }

    this.#samples.set(
      sample.id,
      structuredClone(sample)
    );
  }

  public async getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample |
    undefined
  > {
    const sample =
      this.#samples.get(
        sampleId
      );

    return sample === undefined
      ? undefined
      : structuredClone(sample);
  }

  public async saveSampleOutcome(
    input:
      ProspectResearchSampleOutcome
  ): Promise<void> {
    const outcome =
      ProspectResearchSampleOutcomeSchema
        .parse(input);
    const sample =
      this.#samples.get(
        outcome.sampleId
      );
    const attempt =
      this.#attempts.get(
        outcome.attemptId
      );

    if (sample === undefined) {
      throw new Error(
        "Measured research sample does not exist: " +
          outcome.sampleId
      );
    }

    if (attempt === undefined) {
      throw new Error(
        "Measured research outcome attempt does not exist: " +
          outcome.attemptId
      );
    }

    validateProspectResearchSampleOutcomeContext(
      sample,
      attempt,
      outcome
    );

    if (
      this.#sampleOutcomes.has(
        outcome.id
      )
    ) {
      throw new Error(
        "Measured research outcome already exists: " +
          outcome.id
      );
    }

    const duplicate =
      [
        ...this.#sampleOutcomes
          .values()
      ].find(
        (existing) =>
          existing.sampleId ===
            outcome.sampleId &&
          (
            existing.targetId ===
              outcome.targetId ||
            existing.attemptId ===
              outcome.attemptId
          )
      );

    if (duplicate !== undefined) {
      throw new Error(
        "Frozen research sample already has an outcome for this target or attempt."
      );
    }

    this.#sampleOutcomes.set(
      outcome.id,
      structuredClone(outcome)
    );
  }

  public async listSampleOutcomes(
    sampleId: string
  ): Promise<
    ProspectResearchSampleOutcome[]
  > {
    return [
      ...this.#sampleOutcomes
        .values()
    ]
      .filter(
        (outcome) =>
          outcome.sampleId ===
          sampleId
      )
      .map(
        (outcome) =>
          structuredClone(
            outcome
          )
      )
      .sort(
        (left, right) =>
          left.reviewedAt.localeCompare(
            right.reviewedAt
          ) ||
          left.id.localeCompare(
            right.id
          )
      );
  }
}
