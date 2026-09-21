import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test
} from "vitest";

import {
  calculateProspectResearchDeliveryCost
} from "@astra/prospect-research";
import type {
  ApprovedResearchTarget,
  CompletedProspectResearchAttempt,
  FailedProspectResearchAttempt,
  ProspectResearchHumanBaseline,
  ProspectResearchSample,
  ResearchApprovalBatch,
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
    "TRUNCATE prospect_research_sample_outcomes, prospect_research_acceptance_attempt_reservations, prospect_research_human_baselines, prospect_research_samples, prospect_research_attempts, prospects, approved_research_targets, prospect_research_approval_batches RESTART IDENTITY CASCADE"
  );
});

afterAll(async () => {
  await pool.end();
});

const timestamp =
  "2026-09-19T12:00:00Z";

function secondApprovedTarget() {
  const first =
    completedAttempt()
      .target;

  return {
    ...first,
    id:
      "target.pg.second",
    companyNameHint:
      "Second Systems",
    approval: {
      ...first.approval,
      id:
        "approval.pg.second"
    }
  };
}

function approvalBatch(
  targets = [
    completedAttempt()
      .target,
    secondApprovedTarget()
  ]
): ResearchApprovalBatch {
  return {
    id:
      "approval-batch.pg",
    sourceManifestId:
      "manifest.pg",
    sourceManifestSha256:
      "c".repeat(64),
    approvedBy:
      "operator",
    approvedAt:
      timestamp,
    targets
  };
}

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
      "gate13-measured-research-v7",
    purpose:
      "CALIBRATION",
    cohortDefinition:
      "PostgreSQL persistence calibration fixture; not a Gate 13 acceptance cohort.",
    selectionMethod:
      "Single deterministic persistence fixture target.",
    selectionUniverse:
      null,
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
    reviewRubricVersion:
      "gate13-brief-review-v1",
    frozenBy:
      "operator",
    frozenAt:
      "2026-09-19T12:01:00Z"
  };
}

function acceptanceTargets():
  ApprovedResearchTarget[] {
  const first =
    completedAttempt()
      .target;

  return Array.from(
    {
      length: 30
    },
    (_value, index) => {
      const suffix =
        String(
          index + 1
        ).padStart(2, "0");

      return {
        ...first,
        id:
          "target.pg.acceptance." +
          suffix,
        companyNameHint:
          "Acceptance Company " +
          suffix,
        approval: {
          ...first.approval,
          id:
            "approval.pg.acceptance." +
            suffix
        }
      };
    }
  );
}

function acceptanceSample():
  ProspectResearchSample {
  const targets =
    acceptanceTargets();

  return {
    id:
      "sample.pg.acceptance",
    status: "FROZEN",
    protocolVersion:
      "gate13-measured-research-v7",
    purpose:
      "ACCEPTANCE",
    cohortDefinition:
      "Thirty deterministic U.S. transportation acceptance fixtures.",
    selectionMethod:
      "Complete deterministic fixture universe.",
    selectionUniverse: {
      id:
        "universe.pg.acceptance",
      sourceName:
        "Deterministic Postgres acceptance universe",
      sourceUrl:
        "https://example.test/postgres-acceptance-universe.csv",
      methodologyUrl:
        "https://example.test/postgres-acceptance-methodology",
      sourceAsOfDate:
        "2026-09-19",
      sourceDeclaredCount:
        30,
      candidateTargetIds:
        targets.map(
          (target) =>
            target.id
        ),
      selectionStrategy:
        "COMPLETE_UNIVERSE",
      selectionSeed:
        null
    },
    marketScope:
      "SINGLE_MARKET",
    marketDescription:
      "United States",
    humanBaselineMode:
      "NORMAL_TOOLS",
    targets,
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
    requestedFields: [
      "companyName",
      "companySummary",
      "transformationOpportunities",
      "buyingSignals"
    ],
    executionProfile: {
      version:
        "gate13-execution-profile-v1",
      agentRuntime:
        "STAGEHAND",
      agentRuntimeVersion:
        "3.7.0",
      modelName:
        "fixture/model-v1",
      modelBaseUrl:
        "http://127.0.0.1:4010/v1",
      browserRuntime:
        "STEEL",
      browserBaseUrl:
        "http://127.0.0.1:3000/",
      browserExpectedImagePin:
        "ghcr.io/steel-dev/steel-browser@sha256:" +
        "a".repeat(64),
      browserIdentityEvidence:
        "EXPECTED_IMAGE_PIN_ONLY"
    },
    deliveryCostPlan: {
      version:
        "gate13-delivery-cost-v1",
      methodologyDescription:
        "Deterministic persistence fixture allocation.",
      rates: [
        {
          id:
            "cost.pg.model",
          category:
            "MODEL",
          label:
            "Fixture model",
          meter:
            "FIXED_PER_RUN",
          unitsPerBillingUnit:
            1,
          usdPerBillingUnit:
            1,
          rounding:
            "NONE",
          sourceDescription:
            "Deterministic persistence fixture model rate.",
          sourceUrl:
            "https://example.test/model-pricing",
          sourceAsOfDate:
            "2026-09-19"
        },
        {
          id:
            "cost.pg.browser",
          category:
            "BROWSER_PROVIDER",
          label:
            "Fixture browser",
          meter:
            "FIXED_PER_RUN",
          unitsPerBillingUnit:
            1,
          usdPerBillingUnit:
            1,
          rounding:
            "NONE",
          sourceDescription:
            "Deterministic persistence fixture browser allocation.",
          sourceUrl:
            "https://example.test/browser-pricing",
          sourceAsOfDate:
            "2026-09-19"
        }
      ]
    },
    costCeilingRationale:
      "Acceptance persistence fixture ceiling.",
    humanBaselineDescription:
      "Human researcher uses normal research tools.",
    comparisonBaselineDescription:
      null,
    reviewRubricVersion:
      "gate13-brief-review-v1",
    frozenBy:
      "operator",
    frozenAt:
      "2026-09-19T12:01:00Z"
  };
}

function humanBaselineInput() {
  return {
    id:
      "baseline.pg",
    sampleId:
      "sample.pg",
    targetId:
      "target.pg",
    source:
      "FIXED_CAP" as const,
    preparedBy:
      "operator",
    humanPreparationMinutes:
      20,
    toolingDescription:
      "Scope-matched persistence fixture tools.",
    notes: null
  };
}

function measuredOutcome(
  baseline:
    ProspectResearchHumanBaseline
):
  ProspectResearchSampleOutcome {
  return {
    id: "outcome.pg",
    sampleId: "sample.pg",
    targetId: "target.pg",
    attemptId: "run_pg",
    baselineId:
      baseline.id,
    reviewRubricVersion:
      "gate13-brief-review-v1",
    attemptStatus:
      "COMPLETED",
    briefDisposition:
      "minor_edit",
    reviewedBy:
      "operator",
    reviewedAt:
      new Date(
        Date.parse(
          baseline.recordedAt
        ) + 60_000
      ).toISOString(),
    reviewMode:
      "UNBLINDED",
    baselineSource:
      baseline.source,
    baselineMeasuredAt:
      baseline.recordedAt,
    materialClaimsReviewed:
      1,
    unsupportedMaterialClaims:
      0,
    corrections: {
      minor: 1,
      major: 0,
      critical: 0
    },
    requestedFieldsTotal: 4,
    requestedFieldsCovered: 4,
    requestedFieldsCoveredIds: [
      "companyName",
      "companySummary",
      "transformationOpportunities",
      "buyingSignals"
    ],
    baselineHumanPreparationMinutes:
      baseline
        .humanPreparationMinutes,
    astraHumanTime: {
      targetSetupMinutes: 1,
      evidenceMappingAndAuditMinutes:
        4,
      correctionAndFinalizationMinutes:
        3,
      failureTriageMinutes: 0,
      otherMinutes: 0,
      measurementMethod:
        "STOPWATCH",
      otherDescription: null
    },
    endToEndDurationMs:
      5_000,
    deliveryCostUsd: 5,
    unauthorizedActions: 0,
    notes: null
  };
}

function acceptanceAttempt(
  sample:
    ProspectResearchSample,
  runId =
    "run.pg.acceptance.01"
): CompletedProspectResearchAttempt {
  const target =
    sample.targets[0]!;
  const startedAt =
    "2026-09-19T12:16:00Z";
  const researchedAt =
    "2026-09-19T12:16:05Z";

  return {
    id:
      runId,
    target,
    startedAt,
    createdAt:
      researchedAt,
    runDurationMs:
      5_000,
    unauthorizedActions:
      0,
    status:
      "COMPLETED",
    report: {
      id:
        runId,
      runId,
      targetId:
        target.id,
      researchedAt,
      prospect: {
        id:
          target.id,
        domain:
          target.domain,
        companyName:
          null,
        fit: "unknown",
        disqualifiers: [],
        evidenceIds: [
          "e.pg.acceptance"
        ],
        hypothesisIds: []
      },
      companySummary: [
        {
          id:
            "claim.pg.acceptance",
          kind:
            "observed_fact",
          statement:
            "Acceptance Company has a public transportation operations page.",
          evidenceIds: [
            "e.pg.acceptance"
          ]
        }
      ],
      transformationOpportunities:
        [],
      buyingSignals: [],
      unknowns: [
        {
          id:
            "unknown.pg.acceptance.company",
          field:
            "companyName",
          reason:
            "No exact company name was supported by the fixture page."
        },
        {
          id:
            "unknown.pg.acceptance.opportunities",
          field:
            "transformationOpportunities",
          reason:
            "No transformation opportunity was supported by the fixture page."
        },
        {
          id:
            "unknown.pg.acceptance.signals",
          field:
            "buyingSignals",
          reason:
            "No buying signal was supported by the fixture page."
        }
      ],
      evidence: [
        {
          id:
            "e.pg.acceptance",
          sourceUrl:
            target.startUrl,
          observation:
            "Acceptance Company has a public transportation operations page.",
          capturedAt:
            researchedAt,
          uncertainty:
            "none",
          uncertaintyNote:
            null,
          artifactIds: [
            "artifact.pg.acceptance"
          ],
          captureReceipts: [
            {
              artifactId:
                "artifact.pg.acceptance",
              captureVersion:
                "page-evidence-v1",
              semanticSettled:
                true,
              pageUrl:
                target.startUrl,
              capturedAt:
                researchedAt,
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

function acceptanceOutcome(
  sample:
    ProspectResearchSample,
  baseline:
    ProspectResearchHumanBaseline,
  attempt:
    CompletedProspectResearchAttempt
):
  ProspectResearchSampleOutcome {
  const plan =
    sample.deliveryCostPlan;

  if (
    plan === undefined
  ) {
    throw new Error(
      "Acceptance fixture requires a cost plan."
    );
  }

  const deliveryCostEvidence =
    calculateProspectResearchDeliveryCost(
      plan,
      {
        modelUsage:
          null,
        runDurationMs:
          attempt.runDurationMs!
      },
      attempt.id
    );

  return {
    id:
      "outcome.pg.acceptance.01",
    sampleId:
      sample.id,
    targetId:
      attempt.target.id,
    attemptId:
      attempt.id,
    baselineId:
      baseline.id,
    reviewRubricVersion:
      sample.reviewRubricVersion,
    attemptStatus:
      "COMPLETED",
    briefDisposition:
      "accepted",
    reviewedBy:
      "operator",
    reviewedAt:
      "2026-09-19T12:17:00Z",
    reviewMode:
      "UNBLINDED",
    baselineSource:
      baseline.source,
    baselineMeasuredAt:
      baseline.recordedAt,
    materialClaimsReviewed:
      1,
    unsupportedMaterialClaims:
      0,
    corrections: {
      minor: 0,
      major: 0,
      critical: 0
    },
    requestedFieldsTotal:
      4,
    requestedFieldsCovered:
      4,
    requestedFieldsCoveredIds: [
      "companyName",
      "companySummary",
      "transformationOpportunities",
      "buyingSignals"
    ],
    baselineHumanPreparationMinutes:
      baseline
        .humanPreparationMinutes,
    astraHumanTime: {
      targetSetupMinutes: 1,
      evidenceMappingAndAuditMinutes:
        3,
      correctionAndFinalizationMinutes:
        1,
      failureTriageMinutes: 0,
      otherMinutes: 0,
      measurementMethod:
        "STOPWATCH",
      otherDescription: null
    },
    endToEndDurationMs:
      attempt.runDurationMs!,
    deliveryCostUsd:
      deliveryCostEvidence.totalUsd,
    deliveryCostEvidence,
    unauthorizedActions:
      attempt.unauthorizedActions!,
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
  "PostgresProspectResearchRepository rejects acceptance freeze assembled from individual approvals",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const sample =
      acceptanceSample();

    for (
      const target of
      sample.targets
    ) {
      await repository
        .saveTarget(target);
    }

    await expect(
      repository.saveSample(
        sample
      )
    ).rejects.toThrow(
      "must come from one atomic approval batch"
    );
  }
);

test(
  "PostgresProspectResearchRepository freezes acceptance after one exact approval batch",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const sample =
      acceptanceSample();
    const batch =
      approvalBatch(
        sample.targets
      );

    await repository
      .saveTargetBatch(
        batch
      );

    await expect(
      repository.saveSample(
        sample
      )
    ).resolves.toBeUndefined();

    await expect(
      repository.getSample(
        sample.id
      )
    ).resolves.toEqual(
      sample
    );
  }
);

test(
  "PostgresProspectResearchRepository reserves exactly one measured acceptance run per target",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const sample =
      acceptanceSample();
    const target =
      sample.targets[0]!;
    const batch =
      approvalBatch(
        sample.targets
      );

    await repository
      .saveTargetBatch(
        batch
      );
    await repository
      .saveSample(
        sample
      );
    const baseline =
      await repository
        .saveHumanBaseline({
          id:
            "baseline.pg.acceptance.01",
          sampleId:
            sample.id,
          targetId:
            target.id,
          source:
            "MEASURED_HUMAN",
          preparedBy:
            "human.researcher",
          humanPreparationMinutes:
            18,
          toolingDescription:
            "Normal human research tools.",
          notes: null
        });

    const reservation =
      await repository
        .reserveAcceptanceAttempt({
          sampleId:
            sample.id,
          targetId:
            target.id,
          runId:
            "run.pg.acceptance.01"
        });

    expect(
      reservation
    ).toMatchObject({
      sampleId:
        sample.id,
      targetId:
        target.id,
      runId:
        "run.pg.acceptance.01"
    });

    await expect(
      repository
        .reserveAcceptanceAttempt({
          sampleId:
            sample.id,
          targetId:
            target.id,
          runId:
            "run.pg.acceptance.retry"
        })
    ).rejects.toThrow(
      "already has a measured attempt reservation"
    );

    const second =
      new PostgresProspectResearchRepository(
        pool
      );

    await expect(
      second
        .getAcceptanceAttemptReservation(
          sample.id,
          target.id
        )
    ).resolves.toEqual(
      reservation
    );

    await expect(
      repository.saveAttempt(
        acceptanceAttempt(
          sample,
          "run.pg.acceptance.retry"
        )
      )
    ).rejects.toThrow(
      "does not match the reserved Gate 13 acceptance run"
    );

    const attempt =
      acceptanceAttempt(
        sample
      );

    await expect(
      repository.saveAttempt(
        attempt
      )
    ).resolves.toBeUndefined();

    await expect(
      repository
        .releaseAcceptanceAttemptReservation(
          sample.id,
          target.id,
          attempt.id
        )
    ).rejects.toThrow(
      "cannot be released after measured state was persisted"
    );


    const measured =
      acceptanceOutcome(
        sample,
        baseline,
        attempt
      );

    await expect(
      repository
        .saveSampleOutcome(
          measured
        )
    ).resolves.toBeUndefined();

    await expect(
      new PostgresProspectResearchRepository(
        pool
      ).listSampleOutcomes(
        sample.id
      )
    ).resolves.toEqual([
      measured
    ]);
  }
);

test(
  "PostgresProspectResearchRepository releases an unused acceptance reservation for a pre-run failure",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const sample =
      acceptanceSample();
    const target =
      sample.targets[0]!;

    await repository
      .saveTargetBatch(
        approvalBatch(
          sample.targets
        )
      );
    await repository
      .saveSample(
        sample
      );
    await repository
      .saveHumanBaseline({
        id:
          "baseline.pg.acceptance.release",
        sampleId:
          sample.id,
        targetId:
          target.id,
        source:
          "MEASURED_HUMAN",
        preparedBy:
          "human.researcher",
        humanPreparationMinutes:
          18,
        toolingDescription:
          "Normal human research tools.",
        notes: null
      });

    await repository
      .reserveAcceptanceAttempt({
        sampleId:
          sample.id,
        targetId:
          target.id,
        runId:
          "run.pg.acceptance.precreate"
      });

    await repository
      .releaseAcceptanceAttemptReservation(
        sample.id,
        target.id,
        "run.pg.acceptance.precreate"
      );

    await expect(
      repository
        .getAcceptanceAttemptReservation(
          sample.id,
          target.id
        )
    ).resolves.toBeUndefined();

    await expect(
      repository
        .reserveAcceptanceAttempt({
          sampleId:
            sample.id,
          targetId:
            target.id,
          runId:
            "run.pg.acceptance.after-release"
        })
    ).resolves.toMatchObject({
      runId:
        "run.pg.acceptance.after-release"
    });
  }
);

test(
  "PostgresProspectResearchRepository persists approval batches and targets atomically",
  async () => {
    const first =
      new PostgresProspectResearchRepository(
        pool
      );
    const batch =
      approvalBatch();

    await first.saveTargetBatch(
      batch
    );

    const second =
      new PostgresProspectResearchRepository(
        pool
      );

    await expect(
      second.getApprovalBatch(
        batch.id
      )
    ).resolves.toEqual(
      batch
    );
    expect(
      (
        await second.listTargets()
      ).map(
        (target) => target.id
      )
    ).toEqual([
      "target.pg",
      "target.pg.second"
    ]);
  }
);

test(
  "PostgresProspectResearchRepository rolls back the whole approval batch on a duplicate target",
  async () => {
    const repository =
      new PostgresProspectResearchRepository(
        pool
      );
    const first =
      completedAttempt()
        .target;
    const second =
      secondApprovedTarget();

    await repository.saveTarget(
      first
    );

    const batch =
      approvalBatch([
        second,
        first
      ]);

    await expect(
      repository.saveTargetBatch(
        batch
      )
    ).rejects.toThrow();

    await expect(
      repository.getApprovalBatch(
        batch.id
      )
    ).resolves.toBeUndefined();
    await expect(
      repository.getTarget(
        second.id
      )
    ).resolves.toBeUndefined();
    await expect(
      repository.getTarget(
        first.id
      )
    ).resolves.toEqual(
      first
    );
  }
);

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
    const baseline =
      await first
        .saveHumanBaseline(
          humanBaselineInput()
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
      measuredOutcome(
        baseline
      )
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
      await second.getHumanBaseline(
        baseline.id
      )
    ).toEqual(
      baseline
    );
    expect(
      await second.getHumanBaselineForTarget(
        "sample.pg",
        "target.pg"
      )
    ).toEqual(
      baseline
    );
    expect(
      await second.listSampleOutcomes(
        "sample.pg"
      )
    ).toEqual([
      measuredOutcome(
        baseline
      )
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
    const baseline =
      await repository
        .saveHumanBaseline(
          humanBaselineInput()
        );
    await repository.saveAttempt(
      completed
    );
    await repository.saveSampleOutcome(
      measuredOutcome(
        baseline
      )
    );

    await expect(
      repository.saveSampleOutcome({
        ...measuredOutcome(
          baseline
        ),
        id:
          "outcome.pg.duplicate"
      })
    ).rejects.toThrow();
  }
);

test(
  "PostgresProspectResearchRepository owns baseline time and rejects outcome baseline forgery",
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
    await repository.saveSample(
      frozenSample()
    );
    const baseline =
      await repository
        .saveHumanBaseline(
          humanBaselineInput()
        );

    expect(
      Date.parse(
        baseline.recordedAt
      )
    ).not.toBeNaN();

    await expect(
      repository.saveHumanBaseline({
        ...humanBaselineInput(),
        id:
          "baseline.pg.duplicate"
      })
    ).rejects.toThrow();

    await repository.saveAttempt(
      completed
    );

    await expect(
      repository.saveSampleOutcome({
        ...measuredOutcome(
          baseline
        ),
        materialClaimsReviewed:
          0
      })
    ).rejects.toThrow(
      "must equal the durable observed-evidence audit count: 1"
    );

    await expect(
      repository.saveSampleOutcome({
        ...measuredOutcome(
          baseline
        ),
        baselineHumanPreparationMinutes:
          99
      })
    ).rejects.toThrow(
      "differs from durable baseline truth"
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
