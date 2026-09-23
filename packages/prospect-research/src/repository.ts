import type {
  Prospect
} from "@astra/sales-domain";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchAttemptReservationInputSchema,
  ProspectResearchAttemptReservationSchema,
  ProspectResearchHumanBaselineInputSchema,
  ProspectResearchHumanBaselineSchema,
  ProspectResearchSampleOutcomeSchema,
  canonicalizeProspectResearchSampleFreeze,
  canonicalizeResearchApprovalBatchPersistence,
  type ApprovedResearchTarget,
  type ResearchApprovalBatch,
  type ProspectResearchAttempt,
  type ProspectResearchAttemptReservation,
  type ProspectResearchAttemptReservationInput,
  type ProspectResearchHumanBaseline,
  type ProspectResearchHumanBaselineInput,
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

  saveTargetBatch(
    batch:
      ResearchApprovalBatch
  ): Promise<
    ResearchApprovalBatch
  >;

  getApprovalBatch(
    batchId: string
  ): Promise<
    ResearchApprovalBatch |
    undefined
  >;

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

  reserveAcceptanceAttempt(
    input:
      ProspectResearchAttemptReservationInput
  ): Promise<
    ProspectResearchAttemptReservation
  >;

  releaseAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string,
    runId: string
  ): Promise<void>;

  getAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchAttemptReservation |
    undefined
  >;

  saveSample(
    sample: unknown
  ): Promise<
    ProspectResearchSample
  >;

  getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample |
    undefined
  >;

  saveHumanBaseline(
    baseline:
      ProspectResearchHumanBaselineInput
  ): Promise<
    ProspectResearchHumanBaseline
  >;

  getHumanBaseline(
    baselineId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  >;

  getHumanBaselineForTarget(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchHumanBaseline |
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
  readonly #now:
    () => string;
  readonly #targets =
    new Map<
      string,
      ApprovedResearchTarget
    >();
  readonly #approvalBatches =
    new Map<
      string,
      ResearchApprovalBatch
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
  readonly #humanBaselines =
    new Map<
      string,
      ProspectResearchHumanBaseline
    >();
  readonly #attemptReservations =
    new Map<
      string,
      ProspectResearchAttemptReservation
    >();
  readonly #sampleOutcomes =
    new Map<
      string,
      ProspectResearchSampleOutcome
    >();

  public constructor(
    now: () => string =
      () =>
        new Date().toISOString()
  ) {
    this.#now = now;
  }

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

  public async saveTargetBatch(
    input:
      ResearchApprovalBatch
  ): Promise<
    ResearchApprovalBatch
  > {
    const batch =
      canonicalizeResearchApprovalBatchPersistence(
        input,
        this.#now()
      );

    if (
      this.#approvalBatches
        .has(
          batch.id
        )
    ) {
      throw new Error(
        "Research approval batch already exists: " +
          batch.id
      );
    }

    const existing =
      batch.targets.find(
        (target) =>
          this.#targets.has(
            target.id
          )
      );

    if (existing !== undefined) {
      throw new Error(
        "Research target already exists: " +
          existing.id
      );
    }

    this.#approvalBatches.set(
      batch.id,
      structuredClone(batch)
    );

    for (
      const target of
      batch.targets
    ) {
      this.#targets.set(
        target.id,
        structuredClone(target)
      );
    }

    return structuredClone(
      batch
    );
  }

  public async getApprovalBatch(
    batchId: string
  ): Promise<
    ResearchApprovalBatch |
    undefined
  > {
    const batch =
      this.#approvalBatches
        .get(batchId);

    return batch === undefined
      ? undefined
      : structuredClone(batch);
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

  #reservationKey(
    sampleId: string,
    targetId: string
  ): string {
    return (
      sampleId +
      "\u0000" +
      targetId
    );
  }

  public async reserveAcceptanceAttempt(
    input:
      ProspectResearchAttemptReservationInput
  ): Promise<
    ProspectResearchAttemptReservation
  > {
    const parsed =
      ProspectResearchAttemptReservationInputSchema
        .parse(input);
    const sample =
      this.#samples.get(
        parsed.sampleId
      );

    if (
      sample === undefined
    ) {
      throw new Error(
        "Measured research sample does not exist: " +
          parsed.sampleId
      );
    }

    if (
      sample.purpose !==
        "ACCEPTANCE"
    ) {
      throw new Error(
        "Attempt reservations are only valid for Gate 13 acceptance samples."
      );
    }

    if (
      !sample.targets.some(
        (target) =>
          target.id ===
          parsed.targetId
      )
    ) {
      throw new Error(
        "Acceptance attempt target is outside the frozen sample."
      );
    }

    const baseline =
      [
        ...this.#humanBaselines
          .values()
      ].find(
        (candidate) =>
          candidate.sampleId ===
            parsed.sampleId &&
          candidate.targetId ===
            parsed.targetId
      );

    if (
      baseline === undefined ||
      baseline.source !==
        "MEASURED_HUMAN"
    ) {
      throw new Error(
        "Gate 13 acceptance attempt requires a durable measured-human baseline before reservation."
      );
    }

    const key =
      this.#reservationKey(
        parsed.sampleId,
        parsed.targetId
      );

    if (
      this.#attemptReservations
        .has(key)
    ) {
      throw new Error(
        "Gate 13 acceptance target already has a measured attempt reservation."
      );
    }

    if (
      [
        ...this.#sampleOutcomes
          .values()
      ].some(
        (outcome) =>
          outcome.sampleId ===
            parsed.sampleId &&
          outcome.targetId ===
            parsed.targetId
      )
    ) {
      throw new Error(
        "Gate 13 acceptance target already has a reviewed outcome."
      );
    }

    if (
      [
        ...this.#attempts
          .values()
      ].some(
        (attempt) =>
          attempt.target.id ===
            parsed.targetId &&
          Date.parse(
            attempt.startedAt
          ) >=
            Date.parse(
              sample.frozenAt
            )
      )
    ) {
      throw new Error(
        "Gate 13 acceptance target already has an unreserved post-freeze research attempt."
      );
    }

    if (
      [
        ...this.#attemptReservations
          .values()
      ].some(
        (reservation) =>
          reservation.runId ===
            parsed.runId
      )
    ) {
      throw new Error(
        "Gate 13 acceptance run ID is already reserved."
      );
    }

    const reservation =
      ProspectResearchAttemptReservationSchema
        .parse({
          ...parsed,
          reservedAt:
            this.#now()
        });

    this.#attemptReservations
      .set(
        key,
        structuredClone(
          reservation
        )
      );

    return structuredClone(
      reservation
    );
  }

  public async releaseAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string,
    runId: string
  ): Promise<void> {
    const key =
      this.#reservationKey(
        sampleId,
        targetId
      );
    const reservation =
      this.#attemptReservations
        .get(key);

    if (
      reservation === undefined ||
      reservation.runId !==
        runId
    ) {
      throw new Error(
        "Gate 13 acceptance attempt reservation does not match the requested release."
      );
    }

    if (
      this.#attempts.has(
        runId
      ) ||
      [
        ...this.#sampleOutcomes
          .values()
      ].some(
        (outcome) =>
          outcome.sampleId ===
            sampleId &&
          outcome.targetId ===
            targetId
      )
    ) {
      throw new Error(
        "Gate 13 acceptance attempt reservation cannot be released after measured state was persisted."
      );
    }

    this.#attemptReservations
      .delete(key);
  }

  public async getAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchAttemptReservation |
    undefined
  > {
    const reservation =
      this.#attemptReservations
        .get(
          this.#reservationKey(
            sampleId,
            targetId
          )
        );

    return reservation ===
      undefined
      ? undefined
      : structuredClone(
          reservation
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

    const applicableAcceptanceSamples =
      [
        ...this.#samples.values()
      ].filter(
        (sample) =>
          sample.purpose ===
            "ACCEPTANCE" &&
          sample.targets.some(
            (target) =>
              target.id ===
                parsed.target.id
          )
      );
    const acceptanceReservations =
      [
        ...this.#attemptReservations
          .values()
      ].filter(
        (reservation) =>
          applicableAcceptanceSamples
            .some(
              (sample) =>
                reservation.sampleId ===
                  sample.id &&
                reservation.targetId ===
                  parsed.target.id
            )
      );

    if (
      applicableAcceptanceSamples
        .length >
        0
    ) {
      const matchingReservation =
        acceptanceReservations.find(
          (reservation) =>
            reservation.runId ===
              parsed.id
        );

      if (
        matchingReservation ===
          undefined
      ) {
        throw new Error(
          "Gate 13 acceptance-era research attempt requires the exact reserved measured run."
        );
      }

      if (
        Date.parse(
          parsed.startedAt
        ) <
          Date.parse(
            matchingReservation
              .reservedAt
          )
      ) {
        throw new Error(
          "Gate 13 measured attempt cannot start before its durable reservation."
        );
      }
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
    input: unknown
  ): Promise<
    ProspectResearchSample
  > {
    const sample =
      canonicalizeProspectResearchSampleFreeze(
        input,
        this.#now()
      );

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

    if (
      sample.purpose ===
      "ACCEPTANCE"
    ) {
      const batch =
        [
          ...this.#approvalBatches
            .values()
        ].find(
          (candidate) =>
            candidate.targets.length ===
              sample.targets.length &&
            sample.targets.every(
              (target) =>
                candidate.targets
                  .some(
                    (approved) =>
                      sameApprovedResearchTarget(
                        approved,
                        target
                      )
                  )
            )
        );

      if (batch === undefined) {
        throw new Error(
          "Gate 13 acceptance sample targets must come from one atomic approval batch."
        );
      }
    }

    this.#samples.set(
      sample.id,
      structuredClone(sample)
    );

    return structuredClone(
      sample
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

  public async saveHumanBaseline(
    input:
      ProspectResearchHumanBaselineInput
  ): Promise<
    ProspectResearchHumanBaseline
  > {
    const parsed =
      ProspectResearchHumanBaselineInputSchema
        .parse(input);
    const sample =
      this.#samples.get(
        parsed.sampleId
      );

    if (sample === undefined) {
      throw new Error(
        "Measured research sample does not exist: " +
          parsed.sampleId
      );
    }

    if (
      !sample.targets.some(
        (target) =>
          target.id ===
          parsed.targetId
      )
    ) {
      throw new Error(
        "Human baseline target is outside the frozen sample."
      );
    }

    if (
      sample.purpose ===
        "ACCEPTANCE" &&
      parsed.source !==
        "MEASURED_HUMAN"
    ) {
      throw new Error(
        "Gate 13 acceptance requires a measured human baseline."
      );
    }

    if (
      this.#humanBaselines.has(
        parsed.id
      ) ||
      [
        ...this.#humanBaselines
          .values()
      ].some(
        (baseline) =>
          baseline.sampleId ===
            parsed.sampleId &&
          baseline.targetId ===
            parsed.targetId
      )
    ) {
      throw new Error(
        "Frozen research sample already has a human baseline for this target."
      );
    }

    const baseline =
      ProspectResearchHumanBaselineSchema
        .parse({
          ...parsed,
          recordedAt:
            this.#now()
        });

    this.#humanBaselines.set(
      baseline.id,
      structuredClone(
        baseline
      )
    );

    return structuredClone(
      baseline
    );
  }

  public async getHumanBaseline(
    baselineId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  > {
    const baseline =
      this.#humanBaselines.get(
        baselineId
      );

    return baseline === undefined
      ? undefined
      : structuredClone(
          baseline
        );
  }

  public async getHumanBaselineForTarget(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  > {
    const baseline =
      [
        ...this.#humanBaselines
          .values()
      ].find(
        (candidate) =>
          candidate.sampleId ===
            sampleId &&
          candidate.targetId ===
            targetId
      );

    return baseline === undefined
      ? undefined
      : structuredClone(
          baseline
        );
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
    const baseline =
      this.#humanBaselines.get(
        outcome.baselineId
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

    if (baseline === undefined) {
      throw new Error(
        "Measured research outcome human baseline does not exist: " +
          outcome.baselineId
      );
    }

    if (
      sample.purpose ===
        "ACCEPTANCE"
    ) {
      const reservation =
        this.#attemptReservations
          .get(
            this.#reservationKey(
              sample.id,
              outcome.targetId
            )
          );

      if (
        reservation === undefined ||
        reservation.runId !==
          outcome.attemptId
      ) {
        throw new Error(
          "Gate 13 acceptance outcome must reference the single reserved measured attempt."
        );
      }
    }

    validateProspectResearchSampleOutcomeContext(
      sample,
      attempt,
      baseline,
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
