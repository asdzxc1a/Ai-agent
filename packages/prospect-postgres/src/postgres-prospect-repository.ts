import {
  Pool,
  type PoolClient,
  type PoolConfig
} from "pg";

import {
  ApprovedResearchTargetSchema,
  ProspectResearchAttemptSchema,
  sameApprovedResearchTarget,
  validateProspectResearchAttemptForPersistence,
  type ApprovedResearchTarget,
  type ProspectResearchAttempt,
  type ProspectResearchRepository
} from "@astra/prospect-research";
import {
  ProspectSchema,
  type Prospect
} from "@astra/sales-domain";

interface TargetRow {
  target: unknown;
}

interface AttemptRow {
  attempt: unknown;
}

interface ProspectRow {
  prospect: unknown;
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
}
