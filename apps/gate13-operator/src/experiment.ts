import {
  createHash
} from "node:crypto";

import { z } from "zod";

import {
  ProspectResearchAstraHumanTimeSchema,
  ProspectResearchDeliveryCostPlanSchema,
  ProspectResearchHumanBaselineInputSchema,
  ProspectResearchSampleOutcomeSchema,
  ProspectResearchSampleSchema,
  ResearchApprovalBatchSchema,
  calculateProspectResearchDeliveryCost,
  requiredMaterialClaimAuditCount,
  sameApprovedResearchTarget,
  validateProspectResearchSampleOutcomeContext,
  type ProspectResearchAttempt,
  type ProspectResearchDeliveryCostEvidence,
  type ProspectResearchDeliveryCostPlan,
  type ProspectResearchHumanBaseline,
  type ProspectResearchSample,
  type ProspectResearchSampleOutcome,
  type ResearchApprovalBatch
} from "@astra/prospect-research";

import {
  GATE13_APPROVAL_TARGET_COUNT,
  GATE13_APPROVAL_UNIVERSE_ID,
  buildGate13ApprovalBatchFromManifest,
  previewGate13ApprovalManifest
} from "./approval.js";

export const GATE13_UNIVERSE_PATH =
  "docs/project/data/gate13-us-transportation-universe-2026-09-17.json";

const UniverseMemberSchema =
  z.object({
    ticker:
      z.string().trim().min(1).max(32),
    name:
      z.string().trim().min(1).max(240),
    targetId:
      z.string().trim().min(1).max(128)
  }).strict();

export const Gate13UniverseSchema =
  z.object({
    id:
      z.literal(
        GATE13_APPROVAL_UNIVERSE_ID
      ),
    purpose:
      z.literal(
        "ACCEPTANCE_CANDIDATE_UNIVERSE"
      ),
    sourceName:
      z.string().trim().min(1),
    sourceUrl:
      z.string().url(),
    sourceAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      ),
    sourceDeclaredEquityCount:
      z.literal(
        GATE13_APPROVAL_TARGET_COUNT
      ),
    benchmarkName:
      z.string().trim().min(1),
    benchmarkUrl:
      z.string().url(),
    selectionStrategy:
      z.literal(
        "COMPLETE_UNIVERSE"
      ),
    inclusionRule:
      z.string().trim().min(1),
    market:
      z.string().trim().min(1),
    niche:
      z.string().trim().min(1),
    members:
      z.array(
        UniverseMemberSchema
      ).length(
        GATE13_APPROVAL_TARGET_COUNT
      )
  }).strict()
    .superRefine(
      (universe, context) => {
        const ids =
          universe.members.map(
            (member) =>
              member.targetId
          );

        if (
          new Set(ids).size !==
            ids.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["members"],
            message:
              "Gate 13 universe target IDs must be unique"
          });
        }
      }
    );

export type Gate13Universe =
  z.infer<
    typeof Gate13UniverseSchema
  >;

export interface BuildGate13AcceptanceSampleInput {
  manifestText: string;
  universeText: string;
  approvalBatch: ResearchApprovalBatch;
  sampleId: string;
  frozenBy: string;
  frozenAt: string;
  maxDeliveryCostUsdPerBrief: number;
  deliveryCostPlan:
    ProspectResearchDeliveryCostPlan;
  costCeilingRationale: string;
  humanBaselineDescription: string;
}

export interface BuildGate13HumanBaselineInput {
  sampleId: string;
  targetId: string;
  preparedBy: string;
  humanPreparationMinutes: number;
  toolingDescription: string;
  notes: string | null;
}

const OutcomeReviewSchema =
  z.object({
    reviewedBy:
      z.string().trim().min(1).max(240),
    reviewMode:
      z.enum([
        "BLIND",
        "UNBLINDED"
      ]),
    unsupportedMaterialClaims:
      z.number()
        .int()
        .nonnegative(),
    corrections:
      z.object({
        minor:
          z.number()
            .int()
            .nonnegative(),
        major:
          z.number()
            .int()
            .nonnegative(),
        critical:
          z.number()
            .int()
            .nonnegative()
      }).strict(),
    requestedFieldsTotal:
      z.number()
        .int()
        .positive(),
    requestedFieldsCovered:
      z.number()
        .int()
        .nonnegative(),
    astraHumanTime:
      ProspectResearchAstraHumanTimeSchema,
    endToEndDurationMs:
      z.number()
        .int()
        .positive(),
    unauthorizedActions:
      z.number()
        .int()
        .nonnegative(),
    notes:
      z.string()
        .trim()
        .min(1)
        .max(4000)
        .nullable()
  }).strict();

export type Gate13OutcomeReview =
  z.infer<
    typeof OutcomeReviewSchema
  >;

const Gate13RunSummaryCostSchema =
  z.object({
    runId:
      z.string().trim().min(1),
    timings:
      z.object({
        totalMs:
          z.number()
            .int()
            .positive()
      }).passthrough(),
    modelUsage:
      z.object({
        promptTokens:
          z.number()
            .int()
            .nonnegative(),
        completionTokens:
          z.number()
            .int()
            .nonnegative(),
        reasoningTokens:
          z.number()
            .int()
            .nonnegative(),
        cachedInputTokens:
          z.number()
            .int()
            .nonnegative(),
        inferenceTimeMs:
          z.number()
            .finite()
            .nonnegative()
      }).strict()
        .optional()
  }).passthrough();

function parseJson(
  text: string,
  label: string
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      label + " must be valid JSON."
    );
  }
}

export function parseGate13Universe(
  universeText: string
): Gate13Universe {
  return Gate13UniverseSchema
    .parse(
      parseJson(
        universeText,
        "Gate 13 universe"
      )
    );
}

export function parseGate13DeliveryCostPlan(
  planText: string
): ProspectResearchDeliveryCostPlan {
  return ProspectResearchDeliveryCostPlanSchema
    .parse(
      parseJson(
        planText,
        "Gate 13 delivery cost plan"
      )
    );
}

export function parseGate13OutcomeReview(
  reviewText: string
): Gate13OutcomeReview {
  return OutcomeReviewSchema
    .parse(
      parseJson(
        reviewText,
        "Gate 13 outcome review"
      )
    );
}

function stableId(
  prefix: string,
  values:
    readonly string[]
): string {
  const digest =
    createHash("sha256")
      .update(
        values.join("\u0000"),
        "utf8"
      )
      .digest("hex")
      .slice(0, 24);

  return prefix + "." + digest;
}

function assertExactMembership(
  expected:
    readonly string[],
  actual:
    readonly string[],
  label: string
): void {
  const expectedSet =
    new Set(expected);
  const actualSet =
    new Set(actual);

  if (
    expectedSet.size !==
      expected.length ||
    actualSet.size !==
      actual.length ||
    expected.length !==
      actual.length ||
    expected.some(
      (id) =>
        !actualSet.has(id)
    ) ||
    actual.some(
      (id) =>
        !expectedSet.has(id)
    )
  ) {
    throw new Error(
      label +
        " must contain the exact canonical 43-target membership."
    );
  }
}

function assertCanonicalApprovalBatch(
  manifestText: string,
  universe:
    Gate13Universe,
  input:
    ResearchApprovalBatch
): ResearchApprovalBatch {
  const batch =
    ResearchApprovalBatchSchema
      .parse(input);
  const manifest =
    previewGate13ApprovalManifest(
      manifestText
    );
  const expected =
    buildGate13ApprovalBatchFromManifest({
      manifestText,
      batchId:
        batch.id,
      approvedBy:
        batch.approvedBy,
      approvedAt:
        batch.approvedAt
    });

  if (
    batch.sourceManifestId !==
      manifest.manifest.id ||
    batch.sourceManifestSha256 !==
      manifest.sha256
  ) {
    throw new Error(
      "Approval batch is not bound to the exact canonical Gate 13 manifest."
    );
  }

  assertExactMembership(
    universe.members.map(
      (member) =>
        member.targetId
    ),
    manifest.manifest.targets.map(
      (target) =>
        target.targetId
    ),
    "Gate 13 manifest"
  );

  assertExactMembership(
    expected.targets.map(
      (target) =>
        target.id
    ),
    batch.targets.map(
      (target) =>
        target.id
    ),
    "Gate 13 approval batch"
  );

  for (
    const expectedTarget of
    expected.targets
  ) {
    const actual =
      batch.targets.find(
        (target) =>
          target.id ===
          expectedTarget.id
      );

    if (
      actual === undefined ||
      !sameApprovedResearchTarget(
        expectedTarget,
        actual
      )
    ) {
      throw new Error(
        "Approval batch target differs from the canonical manifest-derived target: " +
          expectedTarget.id
      );
    }
  }

  return batch;
}

export function buildGate13AcceptanceSample(
  input:
    BuildGate13AcceptanceSampleInput
): ProspectResearchSample {
  const universe =
    parseGate13Universe(
      input.universeText
    );
  const batch =
    assertCanonicalApprovalBatch(
      input.manifestText,
      universe,
      input.approvalBatch
    );
  const targetIds =
    universe.members.map(
      (member) =>
        member.targetId
    );

  assertExactMembership(
    targetIds,
    batch.targets.map(
      (target) =>
        target.id
    ),
    "Gate 13 acceptance sample"
  );

  return ProspectResearchSampleSchema
    .parse({
      id:
        input.sampleId,
      status:
        "FROZEN",
      protocolVersion:
        "gate13-measured-research-v7",
      purpose:
        "ACCEPTANCE",
      cohortDefinition:
        "Complete " +
        GATE13_APPROVAL_TARGET_COUNT +
        "-equity iShares U.S. Transportation ETF (IYT) universe dated " +
        universe.sourceAsOfDate +
        "; U.S. transportation operations.",
      selectionMethod:
        universe.inclusionRule +
        " No discretionary exclusions, replacements, or post-hoc removals.",
      selectionUniverse: {
        id:
          universe.id,
        sourceName:
          universe.sourceName,
        sourceUrl:
          universe.sourceUrl,
        methodologyUrl:
          universe.benchmarkUrl,
        sourceAsOfDate:
          universe.sourceAsOfDate,
        sourceDeclaredCount:
          universe
            .sourceDeclaredEquityCount,
        candidateTargetIds:
          targetIds,
        selectionStrategy:
          "COMPLETE_UNIVERSE",
        selectionSeed:
          null
      },
      marketScope:
        "SINGLE_MARKET",
      marketDescription:
        universe.market +
        " — " +
        universe.niche,
      humanBaselineMode:
        "NORMAL_TOOLS",
      targets:
        batch.targets,
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
          input
            .maxDeliveryCostUsdPerBrief
      },
      deliveryCostPlan:
        input.deliveryCostPlan,
      costCeilingRationale:
        input.costCeilingRationale,
      humanBaselineDescription:
        input
          .humanBaselineDescription,
      comparisonBaselineDescription:
        null,
      reviewRubricVersion:
        "gate13-brief-review-v1",
      frozenBy:
        input.frozenBy,
      frozenAt:
        input.frozenAt
    });
}

export function buildGate13HumanBaselineInput(
  input:
    BuildGate13HumanBaselineInput
) {
  return ProspectResearchHumanBaselineInputSchema
    .parse({
      id:
        stableId(
          "baseline",
          [
            input.sampleId,
            input.targetId
          ]
        ),
      sampleId:
        input.sampleId,
      targetId:
        input.targetId,
      source:
        "MEASURED_HUMAN",
      preparedBy:
        input.preparedBy,
      humanPreparationMinutes:
        input
          .humanPreparationMinutes,
      toolingDescription:
        input.toolingDescription,
      notes:
        input.notes
    });
}

function briefDisposition(
  attempt:
    ProspectResearchAttempt,
  review:
    Gate13OutcomeReview
) {
  if (
    attempt.status ===
      "FAILED"
  ) {
    return "not_produced" as const;
  }

  if (
    review
      .unsupportedMaterialClaims >
      0 ||
    review.corrections
      .critical > 0
  ) {
    return "rejected" as const;
  }

  if (
    review.corrections
      .major > 0
  ) {
    return "major_edit" as const;
  }

  if (
    review.corrections
      .minor > 0
  ) {
    return "minor_edit" as const;
  }

  return "accepted" as const;
}

function gate13AttemptRunId(
  attempt:
    ProspectResearchAttempt
): string {
  const runId =
    attempt.status ===
      "COMPLETED"
      ? attempt.report.runId
      : attempt.runId;

  if (runId === null) {
    throw new Error(
      "Gate 13 measured outcome requires a durable run ID for cost accounting."
    );
  }

  return runId;
}

export function buildGate13DeliveryCostEvidenceFromRunSummary(
  sample:
    ProspectResearchSample,
  attempt:
    ProspectResearchAttempt,
  runSummaryText: string
): ProspectResearchDeliveryCostEvidence {
  const plan =
    sample.deliveryCostPlan;

  if (plan === undefined) {
    throw new Error(
      "Frozen sample does not contain a delivery cost plan."
    );
  }

  const summary =
    Gate13RunSummaryCostSchema
      .parse(
        parseJson(
          runSummaryText,
          "Gate 13 run summary"
        )
      );
  const runId =
    gate13AttemptRunId(
      attempt
    );

  if (
    summary.runId !==
      runId
  ) {
    throw new Error(
      "Gate 13 run summary does not match the durable research attempt."
    );
  }

  return calculateProspectResearchDeliveryCost(
    plan,
    {
      modelUsage:
        summary.modelUsage ===
          undefined
          ? null
          : {
              promptTokens:
                summary.modelUsage
                  .promptTokens,
              completionTokens:
                summary.modelUsage
                  .completionTokens,
              reasoningTokens:
                summary.modelUsage
                  .reasoningTokens,
              cachedInputTokens:
                summary.modelUsage
                  .cachedInputTokens
            },
      runDurationMs:
        summary.timings
          .totalMs
    },
    runId
  );
}

export interface BuildGate13SampleOutcomeInput {
  sample: ProspectResearchSample;
  attempt: ProspectResearchAttempt;
  baseline:
    ProspectResearchHumanBaseline;
  review: Gate13OutcomeReview;
  deliveryCostEvidence:
    ProspectResearchDeliveryCostEvidence;
  reviewedAt: string;
}

export function buildGate13SampleOutcome(
  input:
    BuildGate13SampleOutcomeInput
): ProspectResearchSampleOutcome {
  const targetId =
    input.attempt.target.id;
  const outcome =
    ProspectResearchSampleOutcomeSchema
      .parse({
        id:
          stableId(
            "outcome",
            [
              input.sample.id,
              targetId,
              input.attempt.id
            ]
          ),
        sampleId:
          input.sample.id,
        targetId,
        attemptId:
          input.attempt.id,
        baselineId:
          input.baseline.id,
        reviewRubricVersion:
          input.sample
            .reviewRubricVersion,
        attemptStatus:
          input.attempt.status,
        briefDisposition:
          briefDisposition(
            input.attempt,
            input.review
          ),
        reviewedBy:
          input.review.reviewedBy,
        reviewedAt:
          input.reviewedAt,
        materialClaimsReviewed:
          requiredMaterialClaimAuditCount(
            input.attempt
          ),
        unsupportedMaterialClaims:
          input.review
            .unsupportedMaterialClaims,
        corrections:
          input.review.corrections,
        requestedFieldsTotal:
          input.review
            .requestedFieldsTotal,
        requestedFieldsCovered:
          input.review
            .requestedFieldsCovered,
        baselineSource:
          input.baseline.source,
        baselineMeasuredAt:
          input.baseline.recordedAt,
        reviewMode:
          input.review.reviewMode,
        baselineHumanPreparationMinutes:
          input.baseline
            .humanPreparationMinutes,
        astraHumanTime:
          input.review
            .astraHumanTime,
        endToEndDurationMs:
          input.review
            .endToEndDurationMs,
        deliveryCostUsd:
          input
            .deliveryCostEvidence
            .totalUsd,
        deliveryCostEvidence:
          input
            .deliveryCostEvidence,
        unauthorizedActions:
          input.review
            .unauthorizedActions,
        notes:
          input.review.notes
      });

  return validateProspectResearchSampleOutcomeContext(
    input.sample,
    input.attempt,
    input.baseline,
    outcome
  );
}
