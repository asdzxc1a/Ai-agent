import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test
} from "vitest";

import type {
  CompletedProspectResearchAttempt,
  FailedProspectResearchAttempt,
  ProspectResearchSample,
  ProspectResearchSampleOutcome
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
    "TRUNCATE prospect_research_sample_outcomes, prospect_research_samples, prospect_research_attempts, prospects, approved_research_targets RESTART IDENTITY CASCADE"
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
    startedAt: timestamp,
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
              semanticSettled:
                true,
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

function frozenSample():
  ProspectResearchSample {
  return {
    id: "sample.pg",
    status: "FROZEN",
    protocolVersion:
      "gate13-measured-research-v3",
    purpose:
      "CALIBRATION",
    cohortDefinition:
      "PostgreSQL persistence calibration fixture; not a Gate 13 acceptance cohort.",
    selectionMethod:
      "Single deterministic persistence fixture target.",
    marketScope:
      "SINGLE_MARKET",
    marketDescription:
      "Fixture market",
    humanBaselineMode:
      "SCOPE_MATCHED",
    targets: [
      completedAttempt()
        .target
    ],
    criteria: {
      maxUnsupportedMaterialClaims:
        0,
      minUsableBriefRate:
        0.9,
      minMedianHumanTimeReductionFraction:
        0.5,
      requireNoUnauthorizedActions:
        true,
      maxDeliveryCostUsdPerBrief:
        20
    },
    costCeilingRationale:
      "Persistence fixture ceiling.",
    humanBaselineDescription:
      "Operator researches and drafts the same brief manually.",
    comparisonBaselineDescription:
      null,
    frozenBy:
      "operator",
    frozenAt:
      "2026-09-19T12:01:00Z"
  };
}

function measuredOutcome():
  ProspectResearchSampleOutcome {
  return {
    id: "outcome.pg",
    sampleId: "sample.pg",
    targetId: "target.pg",
    attemptId: "run_pg",
    attemptStatus:
      "COMPLETED",
    briefDisposition:
      "minor_edit",
    reviewedBy:
      "operator",
    reviewedAt:
      "2026-09-19T12:10:00Z",
    reviewMode:
      "UNBLINDED",
    baselineSource:
      "FIXED_CAP",
    baselineMeasuredAt:
      "2026-09-19T11:55:00Z",
    materialClaimsReviewed:
      1,
    unsupportedMaterialClaims:
      0,
    corrections: {
      minor: 1,
      major: 0,
      critical: 0
    },
    requestedFieldsTotal: 3,
    requestedFieldsCovered: 3,
    baselineHumanPreparationMinutes:
      20,
    astraHumanReviewMinutes:
      8,
    endToEndDurationMs:
      5_000,
    deliveryCostUsd: 5,
    unauthorizedActions: 0,
    notes: null
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
    startedAt:
      "2026-09-19T12:04:00Z",
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
    await first.saveSample(
      frozenSample()
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
    await first.saveSampleOutcome(
      measuredOutcome()
    );

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
    expect(
      await second.getSample(
        "sample.pg"
      )
    ).toEqual(
      frozenSample()
    );
    expect(
      await second.listSampleOutcomes(
        "sample.pg"
      )
    ).toEqual([
      measuredOutcome()
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
  "PostgresProspectResearchRepository freezes stored target snapshots and prevents duplicate measured outcomes",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const completed =
      completedAttempt();

    await repository.saveTarget(
      completed.target
    );

    const widened:
      ProspectResearchSample = {
        ...frozenSample(),
        id:
          "sample.pg.widened",
        targets: [
          {
            ...completed.target,
            approvedDomains: [
              ...completed.target
                .approvedDomains,
              "other-example.com"
            ]
          }
        ]
      };

    await expect(
      repository.saveSample(
        widened
      )
    ).rejects.toThrow(
      "Measured research sample target differs from the stored approval"
    );

    await repository.saveSample(
      frozenSample()
    );
    await repository.saveAttempt(
      completed
    );
    await repository.saveSampleOutcome(
      measuredOutcome()
    );

    await expect(
      repository.saveSampleOutcome({
        ...measuredOutcome(),
        id:
          "outcome.pg.duplicate"
      })
    ).rejects.toThrow();
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
