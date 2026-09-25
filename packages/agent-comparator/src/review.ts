import {
  createHash
} from "node:crypto";

import {
  z
} from "zod";

import type {
  ComparatorAttempt
} from "./schema.js";

export const AGENT_COMPARATOR_MODEL_REVIEW_VERSION =
  "gate13-agent-comparator-model-review-v1" as const;

export const ComparatorReviewVerdictSchema =
  z.enum([
    "SUPPORTED_BY_PROVIDED_EVIDENCE",
    "PARTIALLY_SUPPORTED",
    "UNSUPPORTED",
    "UNKNOWN_ACCEPTABLE"
  ]);

export const ComparatorCorrectionSeveritySchema =
  z.enum([
    "NONE",
    "MINOR",
    "MAJOR",
    "CRITICAL"
  ]);

export const ComparatorModelReviewUsabilitySchema =
  z.enum([
    "USABLE_AS_IS",
    "USABLE_WITH_MINOR_EDIT",
    "REQUIRES_MAJOR_EDIT",
    "REJECTED"
  ]);

export const ComparatorReviewFindingSchema =
  z.object({
    fieldId:
      z.enum([
        "companyName",
        "companySummary",
        "transformationOpportunities",
        "buyingSignals"
      ]),
    verdict:
      ComparatorReviewVerdictSchema,
    material:
      z.boolean(),
    rationale:
      z.string().min(1)
  }).strict();

function validateOneFindingPerField(
  findings:
    readonly z.infer<
      typeof ComparatorReviewFindingSchema
    >[],
  context:
    z.RefinementCtx
): void {
  const expected = [
    "companyName",
    "companySummary",
    "transformationOpportunities",
    "buyingSignals"
  ] as const;
  const counts =
    new Map<
      string,
      number
    >();

  for (
    const finding of
    findings
  ) {
    counts.set(
      finding.fieldId,
      (
        counts.get(
          finding.fieldId
        ) ??
        0
      ) +
        1
    );
  }

  for (
    const fieldId of
    expected
  ) {
    if (
      counts.get(
        fieldId
      ) !==
        1
    ) {
      context.addIssue({
        code:
          "custom",
        message:
          "Model review must contain exactly one finding for " +
          fieldId +
          "."
      });
    }
  }
}

export const ComparatorModelReviewDraftSchema =
  z.object({
    findings:
      z.array(
        ComparatorReviewFindingSchema
      ).length(4),
    correctionSeverity:
      ComparatorCorrectionSeveritySchema,
    usability:
      ComparatorModelReviewUsabilitySchema,
    reviewNote:
      z.string().min(1),
    modelUsage:
      z.null()
  }).strict()
    .superRefine(
      (
        review,
        context
      ) => {
        validateOneFindingPerField(
          review.findings,
          context
        );
      }
    );

export const ComparatorReviewerIdentitySchema =
  z.object({
    harness:
      z.literal(
        "codex-cli"
      ),
    harnessVersion:
      z.string().min(1),
    model:
      z.string().min(1)
  }).strict();

export const ComparatorReviewerModelUsageSchema =
  z.object({
    source:
      z.literal(
        "CODEX_JSONL"
      ),
    inputTokens:
      z.number()
        .int()
        .nonnegative(),
    cachedInputTokens:
      z.number()
        .int()
        .nonnegative(),
    cacheWriteInputTokens:
      z.number()
        .int()
        .nonnegative(),
    outputTokens:
      z.number()
        .int()
        .nonnegative(),
    reasoningOutputTokens:
      z.number()
        .int()
        .nonnegative()
  }).strict();

export const ComparatorModelReviewSchema =
  z.object({
    version:
      z.literal(
        AGENT_COMPARATOR_MODEL_REVIEW_VERSION
      ),
    reviewType:
      z.literal(
        "MODEL_REVIEWED"
      ),
    blindInput:
      z.literal(
        "BRIEF_AND_EVIDENCE_ONLY"
      ),
    attemptId:
      z.string().min(1),
    targetId:
      z.string().min(1),
    attemptSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    protocolSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    reviewPromptSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    reviewedAt:
      z.string().datetime({
        offset: true
      }),
    reviewerIdentity:
      ComparatorReviewerIdentitySchema,
    findings:
      z.array(
        ComparatorReviewFindingSchema
      ).length(4),
    correctionSeverity:
      ComparatorCorrectionSeveritySchema,
    usability:
      ComparatorModelReviewUsabilitySchema,
    reviewNote:
      z.string().min(1),
    modelUsage:
      ComparatorReviewerModelUsageSchema.nullable(),
    humanReviewMinutes:
      z.null()
  }).strict()
    .superRefine(
      (
        review,
        context
      ) => {
        validateOneFindingPerField(
          review.findings,
          context
        );
      }
    );

export type ComparatorModelReviewDraft =
  z.infer<
    typeof ComparatorModelReviewDraftSchema
  >;
export type ComparatorModelReview =
  z.infer<
    typeof ComparatorModelReviewSchema
  >;
export type ComparatorReviewerIdentity =
  z.infer<
    typeof ComparatorReviewerIdentitySchema
  >;
export type ComparatorReviewerModelUsage =
  z.infer<
    typeof ComparatorReviewerModelUsageSchema
  >;

export function comparatorAttemptSha256(
  attempt:
    ComparatorAttempt
): string {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        attempt
      ),
      "utf8"
    )
    .digest(
      "hex"
    );
}

export interface ComparatorCohortSummaryInput {
  targetIds:
    readonly string[];
  attempts:
    readonly ComparatorAttempt[];
  reviews:
    readonly ComparatorModelReview[];
}

function median(
  values:
    readonly number[]
): number | null {
  if (
    values.length ===
      0
  ) {
    return null;
  }

  const sorted =
    [...values].sort(
      (
        left,
        right
      ) =>
        left -
        right
    );
  const middle =
    Math.floor(
      sorted.length /
        2
    );

  if (
    sorted.length %
      2 ===
      1
  ) {
    return sorted[
      middle
    ] ?? null;
  }

  const left =
    sorted[
      middle - 1
    ];
  const right =
    sorted[
      middle
    ];

  if (
    left ===
      undefined ||
    right ===
      undefined
  ) {
    return null;
  }

  return (
    left +
    right
  ) /
    2;
}

export function summarizeComparatorCohort(
  input:
    ComparatorCohortSummaryInput
) {
  const attemptByTarget =
    new Map(
      input.attempts.map(
        (attempt) => [
          attempt.targetId,
          attempt
        ] as const
      )
    );
  const reviewByTarget =
    new Map(
      input.reviews.map(
        (review) => [
          review.targetId,
          review
        ] as const
      )
    );
  const completed =
    input.attempts.filter(
      (attempt) =>
        attempt.status ===
          "COMPLETED"
    );
  const failures =
    input.attempts.filter(
      (attempt) =>
        attempt.status !==
          "COMPLETED"
    );
  const completedUsage =
    completed.flatMap(
      (attempt) =>
        attempt.workerResult
          ?.modelUsage ===
          null ||
        attempt.workerResult
          ?.modelUsage ===
          undefined
          ? []
          : [
              attempt.workerResult
                .modelUsage
            ]
    );
  const supportedValueFields =
    completed.reduce(
      (
        count,
        attempt
      ) => {
        const brief =
          attempt.workerResult
            ?.brief;

        if (
          brief ===
            undefined
        ) {
          return count;
        }

        return (
          count +
          Object.values(
            brief
          ).filter(
            (field) =>
              !field.unknown
          ).length
        );
      },
      0
    );
  const explicitUnknownFields =
    completed.reduce(
      (
        count,
        attempt
      ) => {
        const brief =
          attempt.workerResult
            ?.brief;

        if (
          brief ===
            undefined
        ) {
          return count;
        }

        return (
          count +
          Object.values(
            brief
          ).filter(
            (field) =>
              field.unknown
          ).length
        );
      },
      0
    );
  const unsupportedMaterialFindings =
    input.reviews.reduce(
      (
        count,
        review
      ) =>
        count +
        review.findings.filter(
          (finding) =>
            finding.material &&
            (
              finding.verdict ===
                "UNSUPPORTED" ||
              finding.verdict ===
                "PARTIALLY_SUPPORTED"
            )
        ).length,
      0
    );
  const usableReviews =
    input.reviews.filter(
      (review) =>
        review.usability ===
          "USABLE_AS_IS" ||
        review.usability ===
          "USABLE_WITH_MINOR_EDIT"
    );

  return {
    protocol:
      "gate13-agent-comparator-v1",
    verdict:
      "DESCRIPTIVE_ONLY",
    targetCount:
      input.targetIds.length,
    attemptedCount:
      input.attempts.length,
    completedCount:
      completed.length,
    failedCount:
      failures.filter(
        (attempt) =>
          attempt.status ===
            "FAILED"
      ).length,
    timedOutCount:
      failures.filter(
        (attempt) =>
          attempt.status ===
            "TIMED_OUT"
      ).length,
    cancelledCount:
      failures.filter(
        (attempt) =>
          attempt.status ===
            "CANCELLED"
      ).length,
    blockedCount:
      failures.filter(
        (attempt) =>
          attempt.status ===
            "BLOCKED"
      ).length,
    modelReviewedCount:
      input.reviews.length,
    reviewPendingCount:
      completed.filter(
        (attempt) =>
          !reviewByTarget.has(
            attempt.targetId
          )
      ).length,
    remainingTargetCount:
      input.targetIds.filter(
        (targetId) =>
          !attemptByTarget.has(
            targetId
          )
      ).length,
    usableWithMinorEditOrBetterCount:
      usableReviews.length,
    unsupportedMaterialFindingCount:
      unsupportedMaterialFindings,
    supportedValueFieldCount:
      supportedValueFields,
    explicitUnknownFieldCount:
      explicitUnknownFields,
    totalRequestedFieldSlots:
      completed.length *
      4,
    medianTerminalElapsedMs:
      median(
        input.attempts.map(
          (attempt) =>
            attempt.elapsedMs
        )
      ),
    medianCompletedElapsedMs:
      median(
        completed.map(
          (attempt) =>
            attempt.elapsedMs
        )
      ),
    totalInputTokens:
      completedUsage.reduce(
        (
          total,
          usage
        ) =>
          total +
          usage.inputTokens,
        0
      ),
    totalCachedInputTokens:
      completedUsage.reduce(
        (
          total,
          usage
        ) =>
          total +
          usage.cachedInputTokens,
        0
      ),
    totalOutputTokens:
      completedUsage.reduce(
        (
          total,
          usage
        ) =>
          total +
          usage.outputTokens,
        0
      ),
    totalReasoningOutputTokens:
      completedUsage.reduce(
        (
          total,
          usage
        ) =>
          total +
          usage.reasoningOutputTokens,
        0
      ),
    incompleteTargetIds:
      input.targetIds.filter(
        (targetId) =>
          !attemptByTarget.has(
            targetId
          )
      ),
    reviewPendingTargetIds:
      completed
        .filter(
          (attempt) =>
            !reviewByTarget.has(
              attempt.targetId
            )
        )
        .map(
          (attempt) =>
            attempt.targetId
        )
  };
}
