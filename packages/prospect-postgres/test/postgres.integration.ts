import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test
} from "vitest";

import type {
  CompletedProspectResearchAttempt,
  FailedProspectResearchAttempt
} from "@astra/prospect-research";

import {
  createProspectPostgresPool,
  PostgresProspectResearchRepository,
  runProspectPostgresMigrations
} from "../src/index.js";

const connectionString =
  process.env.TEST_DATABASE_URL;

if (
  connectionString === undefined
) {
  throw new Error(
    "TEST_DATABASE_URL is required."
  );
}

const pool =
  createProspectPostgresPool({
    connectionString,
    max: 4
  });

beforeAll(async () => {
  await runProspectPostgresMigrations(
    pool
  );
  await runProspectPostgresMigrations(
    pool
  );
});

beforeEach(async () => {
  await pool.query(
    "TRUNCATE prospect_research_attempts, prospects, approved_research_targets RESTART IDENTITY CASCADE"
  );
});

afterAll(async () => {
  await pool.end();
});

const timestamp =
  "2026-09-19T12:00:00Z";

function completedAttempt():
  CompletedProspectResearchAttempt {
  return {
    id: "run_pg",
    target: {
      id: "target.pg",
      domain: "example.com",
      startUrl:
        "https://example.com/",
      approvedDomains: [
        "example.com"
      ],
      companyNameHint:
        "Example Systems",
      icpContext: null,
      approval: {
        id: "approval.pg",
        scope:
          "public_research_only",
        approvedBy:
          "operator",
        approvedAt: timestamp
      }
    },
    createdAt: timestamp,
    status: "COMPLETED",
    report: {
      id: "run_pg",
      runId: "run_pg",
      targetId: "target.pg",
      researchedAt: timestamp,
      prospect: {
        id: "target.pg",
        domain: "example.com",
        companyName:
          null,
        fit: "unknown",
        disqualifiers: [],
        evidenceIds: [
          "e.pg"
        ],
        hypothesisIds: []
      },
      companySummary: [
        {
          id: "claim.pg",
          kind:
            "observed_fact",
          statement:
            "Example Systems builds automation software.",
          evidenceIds: [
            "e.pg"
          ]
        }
      ],
      transformationOpportunities: [],
      buyingSignals: [],
      unknowns: [
        {
          id: "unknown.pg",
          field: "budgetSignal",
          reason:
            "No public budget signal was observed."
        }
      ],
      evidence: [
        {
          id: "e.pg",
          sourceUrl:
            "https://example.com/about",
          observation:
            "Example Systems builds automation software.",
          capturedAt: timestamp,
          uncertainty: "none",
          uncertaintyNote: null,
          artifactIds: [
            "artifact.pg"
          ],
          captureReceipts: [
            {
              artifactId:
                "artifact.pg",
              captureVersion:
                "page-evidence-v1",
              pageUrl:
                "https://example.com/about",
              capturedAt:
                timestamp,
              pageContentSha256:
                "a".repeat(64),
              screenshotSha256:
                "b".repeat(64)
            }
          ]
        }
      ]
    }
  };
}

function failedAttempt():
  FailedProspectResearchAttempt {
  return {
    id: "run_pg_failed",
    target: {
      id: "target.pg",
      domain: "example.com",
      startUrl:
        "https://example.com/",
      approvedDomains: [
        "example.com"
      ],
      companyNameHint:
        "Example Systems",
      icpContext: null,
      approval: {
        id: "approval.pg",
        scope:
          "public_research_only",
        approvedBy:
          "operator",
        approvedAt: timestamp
      }
    },
    createdAt:
      "2026-09-19T12:05:00Z",
    status: "FAILED",
    runId:
      "run_pg_failed",
    failure: {
      kind:
        "LIVE_RESEARCH_FAILURE",
      code: "ACCESS_BLOCKED",
      message:
        "Approved public site blocked automated access."
    }
  };
}

test(
  "PostgresProspectResearchRepository persists completed prospects and classified failures across repository instances",
  async () => {
    const first =
      new PostgresProspectResearchRepository(
        pool
      );

    const completed =
      completedAttempt();
    const failed =
      failedAttempt();

    await first.saveTarget(
      completed.target
    );
    expect(
      await first.getTarget(
        "target.pg"
      )
    ).toEqual(
      completed.target
    );
    expect(
      await first.listTargets()
    ).toEqual([
      completed.target
    ]);

    await first.saveAttempt(
      completed
    );
    await first.saveAttempt(failed);

    const second =
      new PostgresProspectResearchRepository(
        pool
      );

    expect(
      await second.getAttempt(
        completed.id
      )
    ).toEqual(completed);
    expect(
      await second.getAttempt(
        failed.id
      )
    ).toEqual(failed);
    expect(
      await second.getProspect(
        "target.pg"
      )
    ).toEqual(
      completed.report.prospect
    );
    expect(
      await second.listAttemptsForTarget(
        "target.pg"
      )
    ).toEqual([
      completed,
      failed
    ]);
  }
);

test(
  "PostgresProspectResearchRepository never silently overwrites an attempt id",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const attempt =
      completedAttempt();

    await repository.saveTarget(
      attempt.target
    );
    await expect(
      repository.saveTarget(
        attempt.target
      )
    ).rejects.toThrow();

    await repository.saveAttempt(
      attempt
    );

    await expect(
      repository.saveAttempt(
        attempt
      )
    ).rejects.toThrow();
  }
);

test(
  "PostgresProspectResearchRepository rejects attempts that widen a stored approval",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const attempt =
      completedAttempt();

    await repository.saveTarget(
      attempt.target
    );

    const widened:
      CompletedProspectResearchAttempt = {
        ...attempt,
        id:
          "run_pg_widened",
        target: {
          ...attempt.target,
          approvedDomains: [
            ...attempt.target
              .approvedDomains,
            "other-example.com"
          ]
        },
        report: {
          ...attempt.report,
          id:
            "run_pg_widened",
          runId:
            "run_pg_widened"
        }
      };

    await expect(
      repository.saveAttempt(
        widened
      )
    ).rejects.toThrow(
      "Research attempt target differs from the stored approval."
    );
  }
);


test(
  "PostgresProspectResearchRepository rejects direct protected-state forgery",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const attempt =
      completedAttempt();

    await repository.saveTarget(
      attempt.target
    );

    const forged:
      CompletedProspectResearchAttempt = {
        ...attempt,
        id:
          "run_pg_forged",
        report: {
          ...attempt.report,
          id:
            "run_pg_forged",
          runId:
            "run_pg_forged",
          prospect: {
            ...attempt.report
              .prospect,
            id:
              "prospect.forged",
            fit: "strong"
          }
        }
      };

    await expect(
      repository.saveAttempt(
        forged
      )
    ).rejects.toThrow(
      "Durable prospect research attempt failed validation"
    );
  }
);
