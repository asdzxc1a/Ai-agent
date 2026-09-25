import {
  z
} from "zod";

import type {
  ComparatorModelReview
} from "./review.js";
import type {
  ComparatorAttempt
} from "./schema.js";

export const ComparatorReferenceCostPlanSchema =
  z.object({
    version:
      z.literal(
        "gate13-agent-comparator-reference-cost-v1"
      ),
    accounting:
      z.literal(
        "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL"
      ),
    sourceAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      ),
    rates:
      z.object({
        generatorInputUsdPerMillion:
          z.number().positive(),
        generatorOutputUsdPerMillion:
          z.number().positive(),
        reviewerInputUsdPerMillion:
          z.number().positive(),
        reviewerOutputUsdPerMillion:
          z.number().positive(),
        browserComputeUsdPerHour:
          z.number().positive()
      }).strict(),
    sources:
      z.array(
        z.object({
          label:
            z.string().min(1),
          url:
            z.string().url(),
          note:
            z.string().min(1)
        }).strict()
      ).min(1)
  }).strict();

export type ComparatorReferenceCostPlan =
  z.infer<
    typeof ComparatorReferenceCostPlanSchema
  >;

export interface ComparatorReferenceCost {
  accounting:
    "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL";
  generatorModelUsd: number | null;
  reviewerModelUsd: number | null;
  browserComputeUsd: number;
  totalKnownUsd: number;
  complete:
    boolean;
}

function tokenCost(
  inputTokens: number,
  outputTokens: number,
  inputUsdPerMillion:
    number,
  outputUsdPerMillion:
    number
): number {
  return (
    (
      inputTokens /
        1_000_000
    ) *
      inputUsdPerMillion +
    (
      outputTokens /
        1_000_000
    ) *
      outputUsdPerMillion
  );
}

export function calculateComparatorReferenceCost(
  plan:
    ComparatorReferenceCostPlan,
  attempt:
    ComparatorAttempt,
  review?:
    ComparatorModelReview
): ComparatorReferenceCost {
  const parsedPlan =
    ComparatorReferenceCostPlanSchema
      .parse(
        plan
      );
  const generatorUsage =
    attempt.workerResult
      ?.modelUsage ??
    null;
  const reviewerUsage =
    review?.modelUsage ??
    null;
  const generatorModelUsd =
    generatorUsage ===
      null
      ? null
      : tokenCost(
          generatorUsage
            .inputTokens,
          generatorUsage
            .outputTokens,
          parsedPlan.rates
            .generatorInputUsdPerMillion,
          parsedPlan.rates
            .generatorOutputUsdPerMillion
        );
  const reviewerModelUsd =
    review ===
      undefined
      ? null
      : reviewerUsage ===
          null
        ? null
        : tokenCost(
            reviewerUsage
              .inputTokens,
            reviewerUsage
              .outputTokens,
            parsedPlan.rates
              .reviewerInputUsdPerMillion,
            parsedPlan.rates
              .reviewerOutputUsdPerMillion
          );
  const browserComputeUsd =
    (
      attempt.elapsedMs /
        3_600_000
    ) *
    parsedPlan.rates
      .browserComputeUsdPerHour;
  const totalKnownUsd =
    (
      generatorModelUsd ??
      0
    ) +
    (
      reviewerModelUsd ??
      0
    ) +
    browserComputeUsd;

  return {
    accounting:
      parsedPlan.accounting,
    generatorModelUsd,
    reviewerModelUsd,
    browserComputeUsd,
    totalKnownUsd,
    complete:
      generatorModelUsd !==
        null &&
      (
        attempt.status !==
          "COMPLETED" ||
        (
          review !==
            undefined &&
          reviewerModelUsd !==
            null
        )
      )
  };
}

export interface ComparatorReferenceCostSummaryInput {
  plan:
    ComparatorReferenceCostPlan;
  attempts:
    readonly ComparatorAttempt[];
  reviews:
    readonly ComparatorModelReview[];
}

export function summarizeComparatorReferenceCosts(
  input:
    ComparatorReferenceCostSummaryInput
) {
  const reviewByTarget =
    new Map(
      input.reviews.map(
        (review) => [
          review.targetId,
          review
        ] as const
      )
    );
  const rows =
    input.attempts.map(
      (attempt) => ({
        targetId:
          attempt.targetId,
        cost:
          calculateComparatorReferenceCost(
            input.plan,
            attempt,
            reviewByTarget.get(
              attempt.targetId
            )
          )
      })
    );

  return {
    accounting:
      "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL" as const,
    attemptedCount:
      rows.length,
    generatorModelUsdKnownTotal:
      rows.reduce(
        (
          total,
          row
        ) =>
          total +
          (
            row.cost
              .generatorModelUsd ??
            0
          ),
        0
      ),
    reviewerModelUsdKnownTotal:
      rows.reduce(
        (
          total,
          row
        ) =>
          total +
          (
            row.cost
              .reviewerModelUsd ??
            0
          ),
        0
      ),
    browserComputeUsdTotal:
      rows.reduce(
        (
          total,
          row
        ) =>
          total +
          row.cost
            .browserComputeUsd,
        0
      ),
    totalKnownUsd:
      rows.reduce(
        (
          total,
          row
        ) =>
          total +
          row.cost.totalKnownUsd,
        0
      ),
    completeCostCount:
      rows.filter(
        (row) =>
          row.cost.complete
      ).length,
    generatorUsageMissingTargetIds:
      rows
        .filter(
          (row) =>
            row.cost
              .generatorModelUsd ===
              null
        )
        .map(
          (row) =>
            row.targetId
        ),
    reviewerUsageMissingTargetIds:
      input.reviews
        .filter(
          (review) =>
            review.modelUsage ===
              null
        )
        .map(
          (review) =>
            review.targetId
        )
  };
}
