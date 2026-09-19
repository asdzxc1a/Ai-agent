import type {
  Prospect
} from "@astra/sales-domain";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchAttemptSchema,
  type ApprovedResearchTarget,
  type ProspectResearchAttempt
} from "./schema.js";
import {
  sameApprovedResearchTarget
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
      ProspectResearchAttemptSchema
        .parse(attempt);

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
}
