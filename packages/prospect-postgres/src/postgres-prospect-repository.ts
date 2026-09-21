import {
  Pool,
  type PoolClient,
  type PoolConfig
} from "pg";

import {
  ApprovedResearchTargetSchema,
  ResearchApprovalBatchSchema,
  ProspectResearchAttemptSchema,
  ProspectResearchHumanBaselineInputSchema,
  ProspectResearchHumanBaselineSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  sameApprovedResearchTarget,
  validateProspectResearchAttemptForPersistence,
  validateProspectResearchSampleOutcomeContext,
  type ApprovedResearchTarget,
  type ResearchApprovalBatch,
  type ProspectResearchAttempt,
  type ProspectResearchHumanBaseline,
  type ProspectResearchHumanBaselineInput,
  type ProspectResearchRepository,
  type ProspectResearchSample,
  type ProspectResearchSampleOutcome
} from "@astra/prospect-research";
import {
  ProspectSchema,
  type Prospect
} from "@astra/sales-domain";

interface TargetRow {
  target: unknown;
  approval_batch_id?:
    string | null;
}

interface ApprovalBatchRow {
  batch: unknown;
}

interface AttemptRow {
  attempt: unknown;
}

interface ProspectRow {
  prospect: unknown;
}

interface SampleRow {
  sample: unknown;
}

interface SampleOutcomeRow {
  outcome: unknown;
}

interface HumanBaselineRow {
  baseline: unknown;
  recorded_at:
    Date | string;
}

export function createProspectPostgresPool(
  config: PoolConfig
): Pool {
  return new Pool(config);
}

export class PostgresProspectResearchRepository
  implements ProspectResearchRepository {
  readonly #pool: Pool;

  public constructor(pool: Pool) {
    this.#pool = pool;
  }

  public async saveTarget(
    input:
      ApprovedResearchTarget
  ): Promise<void> {
    const target =
      ApprovedResearchTargetSchema
        .parse(input);

    await this.#pool.query(
      `
        INSERT INTO approved_research_targets (
          id,
          target,
          approved_at
        )
        VALUES ($1, $2::jsonb, $3)
      `,
      [
        target.id,
        JSON.stringify(target),
        target.approval
          .approvedAt
      ]
    );
  }

  public async saveTargetBatch(
    input:
      ResearchApprovalBatch
  ): Promise<void> {
    const batch =
      ResearchApprovalBatchSchema
        .parse(input);
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          INSERT INTO prospect_research_approval_batches (
            id,
            source_manifest_id,
            source_manifest_sha256,
            batch,
            approved_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5)
        `,
        [
          batch.id,
          batch.sourceManifestId,
          batch.sourceManifestSha256,
          JSON.stringify(batch),
          batch.approvedAt
        ]
      );

      for (
        const target of
        batch.targets
      ) {
        await client.query(
          `
            INSERT INTO approved_research_targets (
              id,
              target,
              approved_at,
              approval_batch_id
            )
            VALUES ($1, $2::jsonb, $3, $4)
          `,
          [
            target.id,
            JSON.stringify(target),
            target.approval
              .approvedAt,
            batch.id
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query(
        "ROLLBACK"
      ).catch(
        () => undefined
      );
      throw error;
    } finally {
      client.release();
    }
  }

  public async getApprovalBatch(
    batchId: string
  ): Promise<
    ResearchApprovalBatch |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT batch
          FROM prospect_research_approval_batches
          WHERE id = $1
        `,
        [batchId]
      );
    const row =
      result.rows[0] as
        | ApprovalBatchRow
        | undefined;

    return row === undefined
      ? undefined
      : ResearchApprovalBatchSchema
          .parse(row.batch);
  }

  public async getTarget(
    targetId: string
  ): Promise<
    ApprovedResearchTarget |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT target
          FROM approved_research_targets
          WHERE id = $1
        `,
        [targetId]
      );
    const row =
      result.rows[0] as
        | TargetRow
        | undefined;

    return row === undefined
      ? undefined
      : ApprovedResearchTargetSchema
          .parse(row.target);
  }

  public async listTargets(): Promise<
    ApprovedResearchTarget[]
  > {
    const result =
      await this.#pool.query(
        `
          SELECT target
          FROM approved_research_targets
          ORDER BY approved_at ASC, id ASC
        `
      );

    return result.rows.map(
      (row) =>
        ApprovedResearchTargetSchema
          .parse(
            (
              row as
                TargetRow
            ).target
          )
    );
  }

  public async saveAttempt(
    input:
      ProspectResearchAttempt
  ): Promise<void> {
    const attempt =
      validateProspectResearchAttemptForPersistence(
        input
      );
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");
      await this.#assertApprovedTarget(
        client,
        attempt
      );
      await this.#insertAttempt(
        client,
        attempt
      );

      if (
        attempt.status ===
        "COMPLETED"
      ) {
        await this.#upsertProspect(
          client,
          attempt
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query(
        "ROLLBACK"
      ).catch(
        () => undefined
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async #assertApprovedTarget(
    client: PoolClient,
    attempt:
      ProspectResearchAttempt
  ): Promise<void> {
    const result =
      await client.query(
        `
          SELECT target
          FROM approved_research_targets
          WHERE id = $1
          FOR SHARE
        `,
        [attempt.target.id]
      );
    const row =
      result.rows[0] as
        | TargetRow
        | undefined;

    if (row === undefined) {
      throw new Error(
        "Research target was not approved before the attempt."
      );
    }

    const approved =
      ApprovedResearchTargetSchema
        .parse(row.target);

    if (
      !sameApprovedResearchTarget(
        approved,
        attempt.target
      )
    ) {
      throw new Error(
        "Research attempt target differs from the stored approval."
      );
    }
  }

  async #insertAttempt(
    client: PoolClient,
    attempt:
      ProspectResearchAttempt
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO prospect_research_attempts (
          id,
          target_id,
          prospect_id,
          status,
          attempt,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        attempt.id,
        attempt.target.id,
        attempt.status ===
          "COMPLETED"
          ? attempt.report
              .prospect.id
          : null,
        attempt.status,
        JSON.stringify(attempt),
        attempt.createdAt
      ]
    );
  }

  async #upsertProspect(
    client: PoolClient,
    attempt:
      Extract<
        ProspectResearchAttempt,
        {
          status: "COMPLETED";
        }
      >
  ): Promise<void> {
    const prospect =
      ProspectSchema.parse(
        attempt.report.prospect
      );

    await client.query(
      `
        INSERT INTO prospects (
          id,
          domain,
          company_name,
          prospect,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (id)
        DO UPDATE SET
          domain = EXCLUDED.domain,
          company_name = EXCLUDED.company_name,
          prospect = EXCLUDED.prospect,
          updated_at = EXCLUDED.updated_at
      `,
      [
        prospect.id,
        prospect.domain,
        prospect.companyName,
        JSON.stringify(
          prospect
        ),
        attempt.createdAt,
        attempt.report
          .researchedAt
      ]
    );
  }

  public async getAttempt(
    attemptId: string
  ): Promise<
    ProspectResearchAttempt |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT attempt
          FROM prospect_research_attempts
          WHERE id = $1
        `,
        [attemptId]
      );
    const row =
      result.rows[0] as
        | AttemptRow
        | undefined;

    return row === undefined
      ? undefined
      : ProspectResearchAttemptSchema
          .parse(row.attempt);
  }

  public async getProspect(
    prospectId: string
  ): Promise<
    Prospect | undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT prospect
          FROM prospects
          WHERE id = $1
        `,
        [prospectId]
      );
    const row =
      result.rows[0] as
        | ProspectRow
        | undefined;

    return row === undefined
      ? undefined
      : ProspectSchema.parse(
          row.prospect
        );
  }

  public async listAttemptsForTarget(
    targetId: string
  ): Promise<
    ProspectResearchAttempt[]
  > {
    const result =
      await this.#pool.query(
        `
          SELECT attempt
          FROM prospect_research_attempts
          WHERE target_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [targetId]
      );

    return result.rows.map(
      (row) =>
        ProspectResearchAttemptSchema
          .parse(
            (
              row as
                AttemptRow
            ).attempt
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
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");
      const approvalBatchIds =
        new Set<string>();

      for (
        const target of
        sample.targets
      ) {
        const result =
          await client.query(
            `
              SELECT
                target,
                approval_batch_id
              FROM approved_research_targets
              WHERE id = $1
              FOR SHARE
            `,
            [target.id]
          );
        const row =
          result.rows[0] as
            | TargetRow
            | undefined;

        if (row === undefined) {
          throw new Error(
            "Measured research sample target was not approved: " +
              target.id
          );
        }

        const approved =
          ApprovedResearchTargetSchema
            .parse(
              row.target
            );

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

        if (
          row.approval_batch_id !==
          undefined &&
          row.approval_batch_id !==
          null
        ) {
          approvalBatchIds.add(
            row.approval_batch_id
          );
        }
      }

      if (
        sample.purpose ===
        "ACCEPTANCE"
      ) {
        if (
          approvalBatchIds.size !== 1
        ) {
          throw new Error(
            "Gate 13 acceptance sample targets must come from one atomic approval batch."
          );
        }

        const [
          approvalBatchId
        ] =
          approvalBatchIds;
        const batchResult =
          await client.query(
            `
              SELECT batch
              FROM prospect_research_approval_batches
              WHERE id = $1
              FOR SHARE
            `,
            [
              approvalBatchId
            ]
          );
        const batchRow =
          batchResult.rows[0] as
            | ApprovalBatchRow
            | undefined;

        if (batchRow === undefined) {
          throw new Error(
            "Gate 13 acceptance approval batch does not exist."
          );
        }

        const batch =
          ResearchApprovalBatchSchema
            .parse(
              batchRow.batch
            );

        if (
          batch.targets.length !==
            sample.targets.length ||
          !sample.targets.every(
            (target) =>
              batch.targets.some(
                (approved) =>
                  sameApprovedResearchTarget(
                    approved,
                    target
                  )
              )
          )
        ) {
          throw new Error(
            "Gate 13 acceptance sample differs from its approval batch."
          );
        }
      }

      await client.query(
        `
          INSERT INTO prospect_research_samples (
            id,
            sample,
            frozen_at
          )
          VALUES ($1, $2::jsonb, $3)
        `,
        [
          sample.id,
          JSON.stringify(sample),
          sample.frozenAt
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query(
        "ROLLBACK"
      ).catch(
        () => undefined
      );
      throw error;
    } finally {
      client.release();
    }
  }

  public async getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT sample
          FROM prospect_research_samples
          WHERE id = $1
        `,
        [sampleId]
      );
    const row =
      result.rows[0] as
        | SampleRow
        | undefined;

    return row === undefined
      ? undefined
      : ProspectResearchSampleSchema
          .parse(row.sample);
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
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");

      const sampleResult =
        await client.query(
          `
            SELECT sample
            FROM prospect_research_samples
            WHERE id = $1
            FOR SHARE
          `,
          [parsed.sampleId]
        );
      const sampleRow =
        sampleResult.rows[0] as
          | SampleRow
          | undefined;

      if (sampleRow === undefined) {
        throw new Error(
          "Measured research sample does not exist: " +
            parsed.sampleId
        );
      }

      const sample =
        ProspectResearchSampleSchema
          .parse(
            sampleRow.sample
          );

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

      const insert =
        await client.query(
          `
            INSERT INTO prospect_research_human_baselines (
              id,
              sample_id,
              target_id,
              baseline
            )
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING recorded_at
          `,
          [
            parsed.id,
            parsed.sampleId,
            parsed.targetId,
            JSON.stringify(
              parsed
            )
          ]
        );
      const recordedAt =
        (
          insert.rows[0] as
            {
              recorded_at:
                Date | string;
            }
        ).recorded_at;
      const baseline =
        ProspectResearchHumanBaselineSchema
          .parse({
            ...parsed,
            recordedAt:
              recordedAt instanceof Date
                ? recordedAt.toISOString()
                : new Date(
                    recordedAt
                  ).toISOString()
          });

      await client.query("COMMIT");
      return baseline;
    } catch (error) {
      await client.query(
        "ROLLBACK"
      ).catch(
        () => undefined
      );
      throw error;
    } finally {
      client.release();
    }
  }

  public async getHumanBaseline(
    baselineId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT
            baseline,
            recorded_at
          FROM prospect_research_human_baselines
          WHERE id = $1
        `,
        [baselineId]
      );
    const row =
      result.rows[0] as
        | HumanBaselineRow
        | undefined;

    if (row === undefined) {
      return undefined;
    }

    return ProspectResearchHumanBaselineSchema
      .parse({
        ...(
          row.baseline as
            Record<
              string,
              unknown
            >
        ),
        recordedAt:
          row.recorded_at instanceof Date
            ? row.recorded_at
                .toISOString()
            : new Date(
                row.recorded_at
              ).toISOString()
      });
  }

  public async getHumanBaselineForTarget(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  > {
    const result =
      await this.#pool.query(
        `
          SELECT
            baseline,
            recorded_at
          FROM prospect_research_human_baselines
          WHERE sample_id = $1
            AND target_id = $2
        `,
        [
          sampleId,
          targetId
        ]
      );
    const row =
      result.rows[0] as
        | HumanBaselineRow
        | undefined;

    if (row === undefined) {
      return undefined;
    }

    return ProspectResearchHumanBaselineSchema
      .parse({
        ...(
          row.baseline as
            Record<
              string,
              unknown
            >
        ),
        recordedAt:
          row.recorded_at instanceof Date
            ? row.recorded_at
                .toISOString()
            : new Date(
                row.recorded_at
              ).toISOString()
      });
  }

  public async saveSampleOutcome(
    input:
      ProspectResearchSampleOutcome
  ): Promise<void> {
    const outcome =
      ProspectResearchSampleOutcomeSchema
        .parse(input);
    const client =
      await this.#pool.connect();

    try {
      await client.query("BEGIN");

      const sampleResult =
        await client.query(
          `
            SELECT sample
            FROM prospect_research_samples
            WHERE id = $1
            FOR SHARE
          `,
          [outcome.sampleId]
        );
      const sampleRow =
        sampleResult.rows[0] as
          | SampleRow
          | undefined;

      if (sampleRow === undefined) {
        throw new Error(
          "Measured research sample does not exist: " +
            outcome.sampleId
        );
      }

      const attemptResult =
        await client.query(
          `
            SELECT attempt
            FROM prospect_research_attempts
            WHERE id = $1
            FOR SHARE
          `,
          [outcome.attemptId]
        );
      const attemptRow =
        attemptResult.rows[0] as
          | AttemptRow
          | undefined;

      if (attemptRow === undefined) {
        throw new Error(
          "Measured research outcome attempt does not exist: " +
            outcome.attemptId
        );
      }

      const baselineResult =
        await client.query(
          `
            SELECT
              baseline,
              recorded_at
            FROM prospect_research_human_baselines
            WHERE id = $1
            FOR SHARE
          `,
          [outcome.baselineId]
        );
      const baselineRow =
        baselineResult.rows[0] as
          | HumanBaselineRow
          | undefined;

      if (baselineRow === undefined) {
        throw new Error(
          "Measured research outcome human baseline does not exist: " +
            outcome.baselineId
        );
      }

      const baseline =
        ProspectResearchHumanBaselineSchema
          .parse({
            ...(
              baselineRow.baseline as
                Record<
                  string,
                  unknown
                >
            ),
            recordedAt:
              baselineRow.recorded_at instanceof Date
                ? baselineRow
                    .recorded_at
                    .toISOString()
                : new Date(
                    baselineRow
                      .recorded_at
                  ).toISOString()
          });

      validateProspectResearchSampleOutcomeContext(
        ProspectResearchSampleSchema
          .parse(
            sampleRow.sample
          ),
        ProspectResearchAttemptSchema
          .parse(
            attemptRow.attempt
          ),
        baseline,
        outcome
      );

      await client.query(
        `
          INSERT INTO prospect_research_sample_outcomes (
            id,
            sample_id,
            target_id,
            attempt_id,
            outcome,
            reviewed_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [
          outcome.id,
          outcome.sampleId,
          outcome.targetId,
          outcome.attemptId,
          JSON.stringify(outcome),
          outcome.reviewedAt
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query(
        "ROLLBACK"
      ).catch(
        () => undefined
      );
      throw error;
    } finally {
      client.release();
    }
  }

  public async listSampleOutcomes(
    sampleId: string
  ): Promise<
    ProspectResearchSampleOutcome[]
  > {
    const result =
      await this.#pool.query(
        `
          SELECT outcome
          FROM prospect_research_sample_outcomes
          WHERE sample_id = $1
          ORDER BY reviewed_at ASC, id ASC
        `,
        [sampleId]
      );

    return result.rows.map(
      (row) =>
        ProspectResearchSampleOutcomeSchema
          .parse(
            (
              row as
                SampleOutcomeRow
            ).outcome
          )
    );
  }
}
