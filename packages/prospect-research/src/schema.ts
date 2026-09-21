import {
  isIP
} from "node:net";

import { z } from "zod";

import {
  ProspectSchema
} from "@astra/sales-domain";

const IdentifierSchema =
  z.string()
    .trim()
    .min(1)
    .max(128)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
    );

const TextSchema =
  z.string().trim().min(1);

function validDomainName(
  value: string
): boolean {
  if (
    value.length > 253 ||
    isIP(value) !== 0 ||
    value === "localhost" ||
    value.endsWith(
      ".localhost"
    ) ||
    value.endsWith(
      ".local"
    ) ||
    value.endsWith(
      ".internal"
    ) ||
    value.includes(":")
  ) {
    return false;
  }

  const labels =
    value.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every(
    (label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        label
      )
  );
}

export const ResearchDomainSchema =
  z.string()
    .trim()
    .transform(
      (value) =>
        value
          .toLowerCase()
          .replace(/\.$/, "")
    )
    .refine(
      validDomainName,
      "research domain must be a public DNS-style domain name"
    );

function hostnameWithinDomain(
  hostname: string,
  domain: string
): boolean {
  const normalized =
    hostname
      .toLowerCase()
      .replace(/\.$/, "");

  return (
    normalized === domain ||
    normalized.endsWith(
      "." + domain
    )
  );
}

export const ResearchApprovalSchema =
  z.object({
    id: IdentifierSchema,
    scope:
      z.literal(
        "public_research_only"
      ),
    approvedBy:
      TextSchema.max(240),
    approvedAt:
      z.string().datetime({
        offset: true
      })
  }).strict();

export const ApprovedResearchTargetSchema =
  z.object({
    id: IdentifierSchema,
    domain:
      ResearchDomainSchema,
    startUrl:
      z.string().url(),
    approvedDomains:
      z.array(
        ResearchDomainSchema
      ).min(1).max(16),
    companyNameHint:
      z.string()
        .trim()
        .min(1)
        .max(240)
        .nullable(),
    icpContext:
      z.string()
        .trim()
        .min(1)
        .max(4000)
        .nullable(),
    approval:
      ResearchApprovalSchema
  }).strict()
    .superRefine(
      (target, context) => {
        if (
          !target.approvedDomains
            .includes(
              target.domain
            )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "approvedDomains"
            ],
            message:
              "approvedDomains must include the canonical company domain"
          });
        }

        let startUrl: URL | undefined;

        try {
          startUrl =
            new URL(
              target.startUrl
            );
        } catch {
          startUrl = undefined;
        }

        if (
          startUrl === undefined ||
          (
            startUrl.protocol !==
              "http:" &&
            startUrl.protocol !==
              "https:"
          ) ||
          startUrl.username.length >
            0 ||
          startUrl.password.length >
            0 ||
          (
            startUrl.port.length > 0 &&
            startUrl.port !== "80" &&
            startUrl.port !== "443"
          ) ||
          !target.approvedDomains
            .some(
              (domain) =>
                hostnameWithinDomain(
                  startUrl!.hostname,
                  domain
                )
            )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "startUrl"
            ],
            message:
              "startUrl must be an HTTP(S) URL within approvedDomains"
          });
        }

        const unique =
          new Set(
            target.approvedDomains
          );
        if (
          unique.size !==
          target.approvedDomains
            .length
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "approvedDomains"
            ],
            message:
              "approvedDomains must not contain duplicates"
          });
        }
      }
    );

export const RESEARCH_UNCERTAINTY =
  [
    "none",
    "limited",
    "material"
  ] as const;

const Sha256Schema =
  z.string()
    .regex(
      /^[a-f0-9]{64}$/
    );

export const ResearchApprovalBatchSchema =
  z.object({
    id: IdentifierSchema,
    sourceManifestId:
      IdentifierSchema,
    sourceManifestSha256:
      Sha256Schema,
    approvedBy:
      TextSchema.max(240),
    approvedAt:
      z.string().datetime({
        offset: true
      }),
    targets:
      z.array(
        ApprovedResearchTargetSchema
      ).min(1).max(50)
  }).strict()
    .superRefine(
      (batch, context) => {
        const targetIds =
          batch.targets.map(
            (target) =>
              target.id
          );
        const approvalIds =
          batch.targets.map(
            (target) =>
              target.approval.id
          );

        if (
          new Set(
            targetIds
          ).size !==
            targetIds.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "approval batch target IDs must be unique"
          });
        }

        if (
          new Set(
            approvalIds
          ).size !==
            approvalIds.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "approval batch approval IDs must be unique"
          });
        }

        batch.targets.forEach(
          (target, index) => {
            if (
              target.approval
                .approvedBy !==
                batch.approvedBy
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "targets",
                  index,
                  "approval",
                  "approvedBy"
                ],
                message:
                  "target approvedBy must match approval batch"
              });
            }

            if (
              target.approval
                .approvedAt !==
                batch.approvedAt
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "targets",
                  index,
                  "approval",
                  "approvedAt"
                ],
                message:
                  "target approvedAt must match approval batch"
              });
            }
          }
        );
      }
    );

export const ProspectResearchCaptureReceiptSchema =
  z.object({
    artifactId:
      IdentifierSchema,
    captureVersion:
      z.literal(
        "page-evidence-v1"
      ),
    semanticSettled:
      z.literal(true),
    pageUrl:
      z.string().url(),
    capturedAt:
      z.string().datetime({
        offset: true
      }),
    pageContentSha256:
      Sha256Schema,
    screenshotSha256:
      Sha256Schema
  }).strict();

export const ProspectResearchEvidenceSchema =
  z.object({
    id: IdentifierSchema,
    sourceUrl:
      z.string().url(),
    observation:
      TextSchema.max(2000),
    capturedAt:
      z.string().datetime({
        offset: true
      }),
    uncertainty:
      z.enum(
        RESEARCH_UNCERTAINTY
      ),
    uncertaintyNote:
      z.string()
        .trim()
        .min(1)
        .max(1000)
        .nullable(),
    artifactIds:
      z.array(
        IdentifierSchema
      ).min(1).max(32),
    captureReceipts:
      z.array(
        ProspectResearchCaptureReceiptSchema
      ).min(1).max(32)
  }).strict()
    .superRefine(
      (evidence, context) => {
        if (
          evidence.uncertainty ===
            "none" &&
          evidence.uncertaintyNote !==
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "uncertaintyNote"
            ],
            message:
              "uncertaintyNote must be null when uncertainty is none"
          });
        }

        if (
          evidence.uncertainty !==
            "none" &&
          evidence.uncertaintyNote ===
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "uncertaintyNote"
            ],
            message:
              "limited or material uncertainty requires a note"
          });
        }
      }
    );

export const ProspectResearchEvidenceResultSchema =
  z.object({
    id: IdentifierSchema,
    sourceUrl:
      z.string().url(),
    observation:
      TextSchema.max(2000),
    uncertainty:
      z.enum(
        RESEARCH_UNCERTAINTY
      ),
    uncertaintyNote:
      z.string()
        .trim()
        .min(1)
        .max(1000)
        .nullable()
  }).strict()
    .superRefine(
      (evidence, context) => {
        if (
          evidence.uncertainty ===
            "none" &&
          evidence.uncertaintyNote !==
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "uncertaintyNote"
            ],
            message:
              "uncertaintyNote must be null when uncertainty is none"
          });
        }

        if (
          evidence.uncertainty !==
            "none" &&
          evidence.uncertaintyNote ===
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "uncertaintyNote"
            ],
            message:
              "limited or material uncertainty requires a note"
          });
        }
      }
    );

const ClaimBase = {
  id: IdentifierSchema,
  statement:
    TextSchema.max(2000),
  evidenceIds:
    z.array(
      IdentifierSchema
    ).min(1).max(32)
};

export const ObservedResearchClaimSchema =
  z.object({
    ...ClaimBase,
    kind:
      z.literal(
        "observed_fact"
      )
  }).strict();

export const HypothesisResearchClaimSchema =
  z.object({
    ...ClaimBase,
    kind:
      z.literal(
        "inferred_hypothesis"
      ),
    confidence:
      z.number()
        .min(0)
        .max(1),
    uncertainty:
      TextSchema.max(1000)
  }).strict();

export const ProspectResearchClaimSchema =
  z.discriminatedUnion(
    "kind",
    [
      ObservedResearchClaimSchema,
      HypothesisResearchClaimSchema
    ]
  );

export const ProspectResearchUnknownSchema =
  z.object({
    id: IdentifierSchema,
    field:
      TextSchema.max(200),
    reason:
      TextSchema.max(1000)
  }).strict();

export const GroundedResearchValueSchema =
  z.object({
    value:
      TextSchema.max(240),
    evidenceIds:
      z.array(
        IdentifierSchema
      ).min(1).max(32)
  }).strict();

export const ProspectResearchResultSchema =
  z.object({
    companyName:
      GroundedResearchValueSchema
        .nullable(),
    companySummary:
      z.array(
        ProspectResearchClaimSchema
      ).min(1).max(32),
    transformationOpportunities:
      z.array(
        HypothesisResearchClaimSchema
      ).max(32),
    buyingSignals:
      z.array(
        ProspectResearchClaimSchema
      ).max(32),
    unknowns:
      z.array(
        ProspectResearchUnknownSchema
      ).max(64),
    evidence:
      z.array(
        ProspectResearchEvidenceResultSchema
      ).min(1).max(128)
  }).strict();

export const ProspectResearchReportSchema =
  z.object({
    id: IdentifierSchema,
    runId: IdentifierSchema,
    targetId: IdentifierSchema,
    researchedAt:
      z.string().datetime({
        offset: true
      }),
    prospect:
      ProspectSchema,
    companySummary:
      z.array(
        ProspectResearchClaimSchema
      ).min(1).max(32),
    transformationOpportunities:
      z.array(
        HypothesisResearchClaimSchema
      ).max(32),
    buyingSignals:
      z.array(
        ProspectResearchClaimSchema
      ).max(32),
    unknowns:
      z.array(
        ProspectResearchUnknownSchema
      ).max(64),
    evidence:
      z.array(
        ProspectResearchEvidenceSchema
      ).min(1).max(128)
  }).strict();

export const LIVE_RESEARCH_FAILURE_CODES =
  [
    "APPROVAL_VIOLATION",
    "NETWORK_POLICY_BLOCKED",
    "NAVIGATION_FAILED",
    "ACCESS_BLOCKED",
    "EXTRACTION_FAILED",
    "INSUFFICIENT_EVIDENCE",
    "TIMEOUT",
    "CANCELLED",
    "PROVIDER_FAILED",
    "CLEANUP_FAILED"
  ] as const;

export const ProspectResearchFailureSchema =
  z.object({
    kind:
      z.literal(
        "LIVE_RESEARCH_FAILURE"
      ),
    code:
      z.enum(
        LIVE_RESEARCH_FAILURE_CODES
      ),
    message:
      TextSchema.max(2000)
  }).strict();

export const ProspectResearchAttemptReservationInputSchema =
  z.object({
    sampleId:
      IdentifierSchema,
    targetId:
      IdentifierSchema,
    runId:
      IdentifierSchema
  }).strict();

export const ProspectResearchAttemptReservationSchema =
  ProspectResearchAttemptReservationInputSchema
    .extend({
      reservedAt:
        z.string().datetime({
          offset: true
        })
    })
    .strict();

export const ProspectResearchModelUsageSchema =
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
  }).strict();

const ProspectResearchBillableModelUsageSchema =
  ProspectResearchModelUsageSchema
    .omit({
      inferenceTimeMs:
        true
    });

const AttemptBase = {
  id: IdentifierSchema,
  target:
    ApprovedResearchTargetSchema,
  startedAt:
    z.string().datetime({
      offset: true
    }),
  createdAt:
    z.string().datetime({
      offset: true
    }),
  runDurationMs:
    z.number()
      .int()
      .positive()
      .optional(),
  unauthorizedActions:
    z.number()
      .int()
      .nonnegative()
      .optional(),
  modelUsage:
    ProspectResearchModelUsageSchema
      .optional()
};

export const CompletedProspectResearchAttemptSchema =
  z.object({
    ...AttemptBase,
    status:
      z.literal(
        "COMPLETED"
      ),
    report:
      ProspectResearchReportSchema
  }).strict();

export const FailedProspectResearchAttemptSchema =
  z.object({
    ...AttemptBase,
    status:
      z.literal(
        "FAILED"
      ),
    runId:
      IdentifierSchema.nullable(),
    failure:
      ProspectResearchFailureSchema
  }).strict();

export const ProspectResearchAttemptSchema =
  z.discriminatedUnion(
    "status",
    [
      CompletedProspectResearchAttemptSchema,
      FailedProspectResearchAttemptSchema
    ]
  );

export const PROSPECT_RESEARCH_BRIEF_DISPOSITIONS =
  [
    "accepted",
    "minor_edit",
    "major_edit",
    "rejected",
    "not_produced"
  ] as const;

export const PROSPECT_RESEARCH_REVIEW_RUBRIC_VERSION =
  "gate13-brief-review-v1" as const;

export const PROSPECT_RESEARCH_SAMPLE_PURPOSES =
  [
    "CALIBRATION",
    "ACCEPTANCE"
  ] as const;

export const PROSPECT_RESEARCH_BASELINE_SOURCES =
  [
    "FIXED_CAP",
    "MEASURED_HUMAN"
  ] as const;

export const PROSPECT_RESEARCH_REVIEW_MODES =
  [
    "BLIND",
    "UNBLINDED"
  ] as const;

export const PROSPECT_RESEARCH_HUMAN_BASELINE_MODES =
  [
    "SCOPE_MATCHED",
    "NORMAL_TOOLS"
  ] as const;

export const PROSPECT_RESEARCH_MARKET_SCOPES =
  [
    "SINGLE_MARKET",
    "CROSS_MARKET"
  ] as const;

export const PROSPECT_RESEARCH_SELECTION_STRATEGIES =
  [
    "COMPLETE_UNIVERSE",
    "DETERMINISTIC_SUBSET"
  ] as const;

export const PROSPECT_RESEARCH_REQUESTED_FIELDS =
  [
    "companyName",
    "companySummary",
    "transformationOpportunities",
    "buyingSignals"
  ] as const;

export const PROSPECT_RESEARCH_EXECUTION_PROFILE_VERSION =
  "gate13-execution-profile-v1" as const;

const ProspectResearchExecutionEndpointSchema =
  z.string().url()
    .superRefine(
      (value, context) => {
        const url =
          new URL(value);

        if (
          (
            url.protocol !==
              "http:" &&
            url.protocol !==
              "https:"
          ) ||
          url.username.length >
            0 ||
          url.password.length >
            0 ||
          url.search.length >
            0 ||
          url.hash.length >
            0
        ) {
          context.addIssue({
            code: "custom",
            message:
              "execution-profile endpoints must be credential-free HTTP(S) base URLs without query or fragment"
          });
        }
      }
    );

export const ProspectResearchExecutionProfileSchema =
  z.object({
    version:
      z.literal(
        PROSPECT_RESEARCH_EXECUTION_PROFILE_VERSION
      ),
    agentRuntime:
      z.literal(
        "STAGEHAND"
      ),
    agentRuntimeVersion:
      TextSchema.max(120),
    modelName:
      TextSchema.max(240),
    modelBaseUrl:
      ProspectResearchExecutionEndpointSchema
        .nullable(),
    browserRuntime:
      z.literal(
        "STEEL"
      ),
    browserBaseUrl:
      ProspectResearchExecutionEndpointSchema,
    browserExpectedImagePin:
      z.string().regex(
        /^ghcr\.io\/steel-dev\/steel-browser@sha256:[a-f0-9]{64}$/
      ),
    browserIdentityEvidence:
      z.literal(
        "EXPECTED_IMAGE_PIN_ONLY"
      )
  }).strict();

export const PROSPECT_RESEARCH_COST_CATEGORIES =
  [
    "MODEL",
    "BROWSER_PROVIDER",
    "NETWORK_PROXY",
    "CAPTCHA",
    "OTHER"
  ] as const;

export const PROSPECT_RESEARCH_COST_METERS =
  [
    "PROMPT_TOKENS",
    "COMPLETION_TOKENS",
    "REASONING_TOKENS",
    "CACHED_INPUT_TOKENS",
    "RUN_DURATION_MS",
    "FIXED_PER_RUN"
  ] as const;

export const PROSPECT_RESEARCH_COST_ROUNDING =
  [
    "NONE",
    "CEIL"
  ] as const;

export const PROSPECT_RESEARCH_COST_ACCOUNTING_VERSION =
  "gate13-delivery-cost-v1" as const;

export const ProspectResearchDeliveryCostRateSchema =
  z.object({
    id:
      IdentifierSchema,
    category:
      z.enum(
        PROSPECT_RESEARCH_COST_CATEGORIES
      ),
    label:
      TextSchema.max(240),
    meter:
      z.enum(
        PROSPECT_RESEARCH_COST_METERS
      ),
    unitsPerBillingUnit:
      z.number()
        .finite()
        .positive(),
    usdPerBillingUnit:
      z.number()
        .finite()
        .nonnegative(),
    rounding:
      z.enum(
        PROSPECT_RESEARCH_COST_ROUNDING
      ),
    sourceDescription:
      TextSchema.max(2000),
    sourceUrl:
      z.string()
        .url()
        .nullable(),
    sourceAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      )
  }).strict()
    .superRefine(
      (rate, context) => {
        if (
          rate.meter ===
            "FIXED_PER_RUN" &&
          (
            rate
              .unitsPerBillingUnit !==
              1 ||
            rate.rounding !==
              "NONE"
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["meter"],
            message:
              "fixed-per-run cost rates must use unitsPerBillingUnit=1 and NONE rounding"
          });
        }
      }
    );

export const ProspectResearchDeliveryCostPlanSchema =
  z.object({
    version:
      z.literal(
        PROSPECT_RESEARCH_COST_ACCOUNTING_VERSION
      ),
    methodologyDescription:
      TextSchema.max(4000),
    rates:
      z.array(
        ProspectResearchDeliveryCostRateSchema
      ).min(2).max(32)
  }).strict()
    .superRefine(
      (plan, context) => {
        const ids =
          plan.rates.map(
            (rate) => rate.id
          );

        if (
          new Set(ids).size !==
            ids.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["rates"],
            message:
              "delivery cost rate IDs must be unique"
          });
        }
      }
    );

export const ProspectResearchCostMeasurementsSchema =
  z.object({
    modelUsage:
      ProspectResearchBillableModelUsageSchema
        .nullable(),
    runDurationMs:
      z.number()
        .int()
        .positive()
  }).strict();

export const ProspectResearchDeliveryCostComponentSchema =
  z.object({
    rateId:
      IdentifierSchema,
    category:
      z.enum(
        PROSPECT_RESEARCH_COST_CATEGORIES
      ),
    label:
      TextSchema.max(240),
    meter:
      z.enum(
        PROSPECT_RESEARCH_COST_METERS
      ),
    unitsPerBillingUnit:
      z.number()
        .finite()
        .positive(),
    usdPerBillingUnit:
      z.number()
        .finite()
        .nonnegative(),
    rounding:
      z.enum(
        PROSPECT_RESEARCH_COST_ROUNDING
      ),
    sourceDescription:
      TextSchema.max(2000),
    sourceUrl:
      z.string()
        .url()
        .nullable(),
    sourceAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      ),
    measuredQuantity:
      z.number()
        .finite()
        .nonnegative(),
    billedUnits:
      z.number()
        .finite()
        .nonnegative(),
    amountUsd:
      z.number()
        .finite()
        .nonnegative()
  }).strict()
    .superRefine(
      (component, context) => {
        if (
          component.meter ===
            "FIXED_PER_RUN" &&
          (
            component
              .unitsPerBillingUnit !==
              1 ||
            component.rounding !==
              "NONE"
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["meter"],
            message:
              "fixed-per-run cost components must use unitsPerBillingUnit=1 and NONE rounding"
          });
        }
      }
    );

export const ProspectResearchDeliveryCostEvidenceSchema =
  z.object({
    version:
      z.literal(
        PROSPECT_RESEARCH_COST_ACCOUNTING_VERSION
      ),
    runId:
      IdentifierSchema,
    components:
      z.array(
        ProspectResearchDeliveryCostComponentSchema
      ).min(2).max(32),
    totalUsd:
      z.number()
        .finite()
        .nonnegative()
  }).strict()
    .superRefine(
      (evidence, context) => {
        const rateIds =
          evidence.components.map(
            (component) =>
              component.rateId
          );

        if (
          new Set(rateIds).size !==
            rateIds.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["components"],
            message:
              "delivery cost evidence rate IDs must be unique"
          });
        }

        const total =
          evidence.components.reduce(
            (sum, component) =>
              sum +
              component.amountUsd,
            0
          );

        if (
          Math.abs(
            total -
            evidence.totalUsd
          ) >
            1e-9
        ) {
          context.addIssue({
            code: "custom",
            path: ["totalUsd"],
            message:
              "delivery cost evidence total must equal the component sum"
          });
        }
      }
    );

export const ProspectResearchSelectionUniverseSchema =
  z.object({
    id: IdentifierSchema,
    sourceName:
      TextSchema.max(1000),
    sourceUrl:
      z.string().url(),
    methodologyUrl:
      z.string()
        .url()
        .nullable(),
    sourceAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      ),
    sourceDeclaredCount:
      z.number()
        .int()
        .positive()
        .max(500),
    candidateTargetIds:
      z.array(
        IdentifierSchema
      ).min(1).max(500),
    selectionStrategy:
      z.enum(
        PROSPECT_RESEARCH_SELECTION_STRATEGIES
      ),
    selectionSeed:
      z.string()
        .trim()
        .min(1)
        .max(240)
        .nullable()
  }).strict()
    .superRefine(
      (universe, context) => {
        if (
          new Set(
            universe
              .candidateTargetIds
          ).size !==
            universe
              .candidateTargetIds
              .length
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "candidateTargetIds"
            ],
            message:
              "selection universe target IDs must be unique"
          });
        }

        if (
          universe
            .sourceDeclaredCount !==
          universe
            .candidateTargetIds
            .length
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "sourceDeclaredCount"
            ],
            message:
              "selection universe declared count must equal frozen candidate membership"
          });
        }

        if (
          universe
            .selectionStrategy ===
              "COMPLETE_UNIVERSE" &&
          universe.selectionSeed !==
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "selectionSeed"
            ],
            message:
              "complete-universe selection must not use a sampling seed"
          });
        }

        if (
          universe
            .selectionStrategy ===
              "DETERMINISTIC_SUBSET" &&
          universe.selectionSeed ===
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "selectionSeed"
            ],
            message:
              "deterministic subset selection requires a frozen seed"
          });
        }
      }
    );

export const ProspectResearchSampleCriteriaSchema =
  z.object({
    maxUnsupportedMaterialClaims:
      z.literal(0),
    minUsableBriefRate:
      z.number()
        .min(0.9)
        .max(1),
    minMedianHumanTimeReductionFraction:
      z.number()
        .min(0.5)
        .max(1),
    requireNoUnauthorizedActions:
      z.literal(true),
    maxDeliveryCostUsdPerBrief:
      z.number()
        .finite()
        .positive()
  }).strict();

export const ProspectResearchSampleSchema =
  z.object({
    id: IdentifierSchema,
    status:
      z.literal("FROZEN"),
    protocolVersion:
      z.literal(
        "gate13-measured-research-v7"
      ),
    purpose:
      z.enum(
        PROSPECT_RESEARCH_SAMPLE_PURPOSES
      ),
    cohortDefinition:
      TextSchema.max(4000),
    selectionMethod:
      TextSchema.max(4000),
    selectionUniverse:
      ProspectResearchSelectionUniverseSchema
        .nullable(),
    marketScope:
      z.enum(
        PROSPECT_RESEARCH_MARKET_SCOPES
      ),
    marketDescription:
      TextSchema.max(1000),
    humanBaselineMode:
      z.enum(
        PROSPECT_RESEARCH_HUMAN_BASELINE_MODES
      ),
    targets:
      z.array(
        ApprovedResearchTargetSchema
      ).min(1).max(50),
    criteria:
      ProspectResearchSampleCriteriaSchema,
    requestedFields:
      z.array(
        z.enum(
          PROSPECT_RESEARCH_REQUESTED_FIELDS
        )
      ).min(1).max(
        PROSPECT_RESEARCH_REQUESTED_FIELDS
          .length
      ).optional(),
    executionProfile:
      ProspectResearchExecutionProfileSchema
        .optional(),
    deliveryCostPlan:
      ProspectResearchDeliveryCostPlanSchema
        .optional(),
    costCeilingRationale:
      TextSchema.max(2000),
    humanBaselineDescription:
      TextSchema.max(4000),
    comparisonBaselineDescription:
      z.string()
        .trim()
        .min(1)
        .max(4000)
        .nullable(),
    reviewRubricVersion:
      z.literal(
        PROSPECT_RESEARCH_REVIEW_RUBRIC_VERSION
      ),
    frozenBy:
      TextSchema.max(240),
    frozenAt:
      z.string().datetime({
        offset: true
      })
  }).strict()
    .superRefine(
      (sample, context) => {
        if (
          sample.purpose ===
            "CALIBRATION" &&
          sample.targets.length > 10
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "calibration samples may contain at most 10 targets"
          });
        }

        if (
          sample.purpose ===
            "ACCEPTANCE" &&
          (
            sample.targets.length < 30 ||
            sample.targets.length > 50
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "Gate 13 acceptance samples must contain 30 to 50 frozen targets"
          });
        }

        if (
          sample.purpose ===
            "ACCEPTANCE" &&
          sample.marketScope !==
            "SINGLE_MARKET"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "marketScope"
            ],
            message:
              "Gate 13 acceptance must use one market; cross-market samples are calibration-only"
          });
        }

        if (
          sample.purpose ===
            "ACCEPTANCE"
        ) {
          const requested =
            sample.requestedFields;

          if (
            requested ===
              undefined ||
            requested.length !==
              PROSPECT_RESEARCH_REQUESTED_FIELDS
                .length ||
            new Set(
              requested
            ).size !==
              requested.length ||
            PROSPECT_RESEARCH_REQUESTED_FIELDS
              .some(
                (field) =>
                  !requested.includes(
                    field
                  )
              )
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "requestedFields"
              ],
              message:
                "Gate 13 acceptance requires the exact frozen requested-field set"
            });
          }
        }

        if (
          sample.purpose ===
            "ACCEPTANCE" &&
          sample.humanBaselineMode !==
            "NORMAL_TOOLS"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "humanBaselineMode"
            ],
            message:
              "Gate 13 acceptance must compare against the human workflow using its normal tools"
          });
        }

        if (
          sample.purpose ===
            "ACCEPTANCE" &&
          sample.executionProfile ===
            undefined
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "executionProfile"
            ],
            message:
              "Gate 13 acceptance requires a frozen execution profile"
          });
        }

        if (
          sample.purpose ===
            "ACCEPTANCE"
        ) {
          const plan =
            sample.deliveryCostPlan;

          if (
            plan === undefined
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "deliveryCostPlan"
              ],
              message:
                "Gate 13 acceptance requires a frozen delivery cost plan"
            });
          } else {
            const categories =
              new Set(
                plan.rates.map(
                  (rate) =>
                    rate.category
                )
              );

            if (
              !categories.has(
                "MODEL"
              ) ||
              !categories.has(
                "BROWSER_PROVIDER"
              )
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "deliveryCostPlan",
                  "rates"
                ],
                message:
                  "Gate 13 acceptance delivery cost plan requires MODEL and BROWSER_PROVIDER rates"
              });
            }
          }
        }

        if (
          sample.deliveryCostPlan !==
            undefined
        ) {
          for (
            const [
              index,
              rate
            ] of sample
              .deliveryCostPlan
              .rates.entries()
          ) {
            if (
              Date.parse(
                rate.sourceAsOfDate +
                  "T00:00:00.000Z"
              ) >
                Date.parse(
                  sample.frozenAt
                )
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "deliveryCostPlan",
                  "rates",
                  index,
                  "sourceAsOfDate"
                ],
                message:
                  "delivery cost rate source date must not be after sample freeze"
              });
            }
          }
        }

        const targetIds =
          sample.targets.map(
            (target) =>
              target.id
          );

        if (
          sample.purpose ===
            "ACCEPTANCE" &&
          sample.selectionUniverse ===
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "selectionUniverse"
            ],
            message:
              "Gate 13 acceptance requires frozen candidate-universe provenance"
          });
        }

        if (
          sample.selectionUniverse !==
            null &&
          Date.parse(
            sample
              .selectionUniverse
              .sourceAsOfDate +
              "T00:00:00.000Z"
          ) >
            Date.parse(
              sample.frozenAt
            )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "selectionUniverse",
              "sourceAsOfDate"
            ],
            message:
              "selection universe source date must not be after sample freeze"
          });
        }

        if (
          sample.selectionUniverse !==
            null
        ) {
          const candidateIds =
            new Set(
              sample
                .selectionUniverse
                .candidateTargetIds
            );
          const outside =
            targetIds.find(
              (targetId) =>
                !candidateIds.has(
                  targetId
                )
            );

          if (
            outside !== undefined
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "targets"
              ],
              message:
                "frozen sample contains a target outside the selection universe: " +
                outside
            });
          }

          if (
            sample
              .selectionUniverse
              .selectionStrategy ===
                "COMPLETE_UNIVERSE" &&
            (
              targetIds.length !==
                sample
                  .selectionUniverse
                  .candidateTargetIds
                  .length ||
              sample
                .selectionUniverse
                .candidateTargetIds
                .some(
                  (candidateId) =>
                    !targetIds
                      .includes(
                        candidateId
                      )
                )
            )
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "targets"
              ],
              message:
                "complete-universe selection requires the frozen sample to contain every candidate exactly once"
            });
          }
        }

        if (
          new Set(targetIds).size !==
            targetIds.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "frozen research sample target IDs must be unique"
          });
        }

        for (
          const [
            index,
            target
          ] of sample.targets
            .entries()
        ) {
          if (
            Date.parse(
              target.approval
                .approvedAt
            ) >
            Date.parse(
              sample.frozenAt
            )
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "targets",
                index,
                "approval",
                "approvedAt"
              ],
              message:
                "target approval must exist before the research sample is frozen"
            });
          }
        }
      }
    );

export const ProspectResearchHumanBaselineInputSchema =
  z.object({
    id: IdentifierSchema,
    sampleId: IdentifierSchema,
    targetId: IdentifierSchema,
    source:
      z.enum(
        PROSPECT_RESEARCH_BASELINE_SOURCES
      ),
    preparedBy:
      TextSchema.max(240),
    humanPreparationMinutes:
      z.number()
        .finite()
        .positive(),
    toolingDescription:
      TextSchema.max(4000),
    notes:
      z.string()
        .trim()
        .min(1)
        .max(4000)
        .nullable()
  }).strict();

export const ProspectResearchHumanBaselineSchema =
  ProspectResearchHumanBaselineInputSchema
    .extend({
      recordedAt:
        z.string().datetime({
          offset: true
        })
    })
    .strict();

export const PROSPECT_RESEARCH_HUMAN_TIME_METHODS =
  [
    "STOPWATCH",
    "SYSTEM_TIMED"
  ] as const;

export const ProspectResearchAstraHumanTimeSchema =
  z.object({
    targetSetupMinutes:
      z.number()
        .finite()
        .nonnegative(),
    evidenceMappingAndAuditMinutes:
      z.number()
        .finite()
        .nonnegative(),
    correctionAndFinalizationMinutes:
      z.number()
        .finite()
        .nonnegative(),
    failureTriageMinutes:
      z.number()
        .finite()
        .nonnegative(),
    otherMinutes:
      z.number()
        .finite()
        .nonnegative(),
    measurementMethod:
      z.enum(
        PROSPECT_RESEARCH_HUMAN_TIME_METHODS
      ),
    otherDescription:
      z.string()
        .trim()
        .min(1)
        .max(1000)
        .nullable()
  }).strict()
    .superRefine(
      (time, context) => {
        if (
          time.otherMinutes > 0 &&
          time.otherDescription ===
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "otherDescription"
            ],
            message:
              "otherDescription is required when otherMinutes is non-zero"
          });
        }

        if (
          time.otherMinutes === 0 &&
          time.otherDescription !==
            null
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "otherDescription"
            ],
            message:
              "otherDescription must be null when otherMinutes is zero"
          });
        }
      }
    );

export const ProspectResearchSampleOutcomeSchema =
  z.object({
    id: IdentifierSchema,
    sampleId: IdentifierSchema,
    targetId: IdentifierSchema,
    attemptId: IdentifierSchema,
    baselineId: IdentifierSchema,
    reviewRubricVersion:
      z.literal(
        PROSPECT_RESEARCH_REVIEW_RUBRIC_VERSION
      ),
    attemptStatus:
      z.enum([
        "COMPLETED",
        "FAILED"
      ]),
    briefDisposition:
      z.enum(
        PROSPECT_RESEARCH_BRIEF_DISPOSITIONS
      ),
    reviewedBy:
      TextSchema.max(240),
    reviewedAt:
      z.string().datetime({
        offset: true
      }),
    materialClaimsReviewed:
      z.number()
        .int()
        .nonnegative(),
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
    requestedFieldsCoveredIds:
      z.array(
        z.enum(
          PROSPECT_RESEARCH_REQUESTED_FIELDS
        )
      ).max(
        PROSPECT_RESEARCH_REQUESTED_FIELDS
          .length
      ).optional(),
    baselineSource:
      z.enum(
        PROSPECT_RESEARCH_BASELINE_SOURCES
      ),
    baselineMeasuredAt:
      z.string().datetime({
        offset: true
      }),
    reviewMode:
      z.enum(
        PROSPECT_RESEARCH_REVIEW_MODES
      ),
    baselineHumanPreparationMinutes:
      z.number()
        .finite()
        .positive(),
    astraHumanTime:
      ProspectResearchAstraHumanTimeSchema,
    endToEndDurationMs:
      z.number()
        .int()
        .positive(),
    deliveryCostUsd:
      z.number()
        .finite()
        .nonnegative(),
    deliveryCostEvidence:
      ProspectResearchDeliveryCostEvidenceSchema
        .optional(),
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
  }).strict()
    .superRefine(
      (outcome, context) => {
        const expectedDisposition =
          outcome.attemptStatus ===
            "FAILED"
            ? "not_produced"
            : (
                outcome
                  .unsupportedMaterialClaims >
                  0 ||
                outcome.corrections
                  .critical > 0
                  ? "rejected"
                  : outcome.corrections
                      .major > 0
                    ? "major_edit"
                    : outcome.corrections
                        .minor > 0
                      ? "minor_edit"
                      : "accepted"
              );

        if (
          outcome.deliveryCostEvidence !==
            undefined &&
          Math.abs(
            outcome.deliveryCostUsd -
            outcome
              .deliveryCostEvidence
              .totalUsd
          ) >
            1e-9
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "deliveryCostUsd"
            ],
            message:
              "deliveryCostUsd must equal the source-attributed delivery cost evidence total"
          });
        }

        if (
          outcome.briefDisposition !==
          expectedDisposition
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "briefDisposition"
            ],
            message:
              "brief disposition must match the frozen Gate 13 review rubric"
          });
        }

        if (
          Date.parse(
            outcome.baselineMeasuredAt
          ) >
          Date.parse(
            outcome.reviewedAt
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "baselineMeasuredAt"
            ],
            message:
              "human baseline measurement must predate outcome review"
          });
        }

        if (
          outcome
            .unsupportedMaterialClaims >
          outcome
            .materialClaimsReviewed
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "unsupportedMaterialClaims"
            ],
            message:
              "unsupported material claims cannot exceed reviewed material claims"
          });
        }

        if (
          outcome
            .requestedFieldsCoveredIds !==
              undefined
        ) {
          if (
            new Set(
              outcome
                .requestedFieldsCoveredIds
            ).size !==
              outcome
                .requestedFieldsCoveredIds
                .length
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "requestedFieldsCoveredIds"
              ],
              message:
                "covered requested-field IDs must be unique"
            });
          }

          if (
            outcome
              .requestedFieldsCovered !==
            outcome
              .requestedFieldsCoveredIds
              .length
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "requestedFieldsCovered"
              ],
              message:
                "requestedFieldsCovered must equal the covered requested-field ID count"
            });
          }
        }

        if (
          outcome
            .requestedFieldsCovered >
          outcome
            .requestedFieldsTotal
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "requestedFieldsCovered"
            ],
            message:
              "covered fields cannot exceed requested fields"
          });
        }

        if (
          outcome.attemptStatus ===
            "FAILED" &&
          outcome.briefDisposition !==
            "not_produced"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "briefDisposition"
            ],
            message:
              "failed research attempts must use not_produced disposition"
          });
        }

        if (
          outcome.attemptStatus ===
            "COMPLETED" &&
          outcome.briefDisposition ===
            "not_produced"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "briefDisposition"
            ],
            message:
              "completed research attempts must record a reviewed brief disposition"
          });
        }

        if (
          outcome.briefDisposition ===
            "not_produced" &&
          (
            outcome
              .materialClaimsReviewed !==
              0 ||
            outcome
              .unsupportedMaterialClaims !==
              0 ||
            outcome
              .requestedFieldsCovered !==
              0 ||
            outcome.corrections
              .minor !== 0 ||
            outcome.corrections
              .major !== 0 ||
            outcome.corrections
              .critical !== 0
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "briefDisposition"
            ],
            message:
              "not_produced outcomes cannot report brief claims, coverage, or corrections"
          });
        }
      }
    );

export type ProspectResearchExecutionProfile =
  z.infer<
    typeof ProspectResearchExecutionProfileSchema
  >;
export type ProspectResearchDeliveryCostRate =
  z.infer<
    typeof ProspectResearchDeliveryCostRateSchema
  >;
export type ProspectResearchDeliveryCostPlan =
  z.infer<
    typeof ProspectResearchDeliveryCostPlanSchema
  >;
export type ProspectResearchCostMeasurements =
  z.infer<
    typeof ProspectResearchCostMeasurementsSchema
  >;
export type ProspectResearchDeliveryCostComponent =
  z.infer<
    typeof ProspectResearchDeliveryCostComponentSchema
  >;
export type ProspectResearchDeliveryCostEvidence =
  z.infer<
    typeof ProspectResearchDeliveryCostEvidenceSchema
  >;
export type ProspectResearchAstraHumanTime =
  z.infer<
    typeof ProspectResearchAstraHumanTimeSchema
  >;
export type ProspectResearchHumanBaselineInput =
  z.infer<
    typeof ProspectResearchHumanBaselineInputSchema
  >;
export type ProspectResearchHumanBaseline =
  z.infer<
    typeof ProspectResearchHumanBaselineSchema
  >;
export type ProspectResearchSelectionUniverse =
  z.infer<
    typeof ProspectResearchSelectionUniverseSchema
  >;
export type ProspectResearchSampleCriteria =
  z.infer<
    typeof ProspectResearchSampleCriteriaSchema
  >;
export type ProspectResearchRequestedField =
  typeof PROSPECT_RESEARCH_REQUESTED_FIELDS[
    number
  ];
export type ProspectResearchSample =
  z.infer<
    typeof ProspectResearchSampleSchema
  >;
export function canonicalizeProspectResearchSampleFreeze(
  input: unknown,
  frozenAt: string
): ProspectResearchSample {
  if (
    typeof input !==
      "object" ||
    input === null ||
    Array.isArray(
      input
    )
  ) {
    return ProspectResearchSampleSchema
      .parse(input);
  }

  return ProspectResearchSampleSchema
    .parse({
      ...(
        input as
          Record<
            string,
            unknown
          >
      ),
      frozenAt
    });
}

export type ProspectResearchSampleOutcome =
  z.infer<
    typeof ProspectResearchSampleOutcomeSchema
  >;
export type ResearchApprovalBatch =
  z.infer<
    typeof ResearchApprovalBatchSchema
  >;
export function canonicalizeResearchApprovalBatchTime(
  input: unknown,
  approvedAt: string
): ResearchApprovalBatch {
  const parsed =
    ResearchApprovalBatchSchema
      .parse(input);

  return ResearchApprovalBatchSchema
    .parse({
      ...parsed,
      approvedAt,
      targets:
        parsed.targets.map(
          (target) => ({
            ...target,
            approval: {
              ...target.approval,
              approvedAt
            }
          })
        )
    });
}

export type ApprovedResearchTarget =
  z.infer<
    typeof ApprovedResearchTargetSchema
  >;
export type ProspectResearchCaptureReceipt =
  z.infer<
    typeof ProspectResearchCaptureReceiptSchema
  >;
export type ProspectResearchEvidence =
  z.infer<
    typeof ProspectResearchEvidenceSchema
  >;
export type ProspectResearchEvidenceResult =
  z.infer<
    typeof ProspectResearchEvidenceResultSchema
  >;
export type GroundedResearchValue =
  z.infer<
    typeof GroundedResearchValueSchema
  >;
export type ProspectResearchResult =
  z.infer<
    typeof ProspectResearchResultSchema
  >;
export type ObservedResearchClaim =
  z.infer<
    typeof ObservedResearchClaimSchema
  >;
export type HypothesisResearchClaim =
  z.infer<
    typeof HypothesisResearchClaimSchema
  >;
export type ProspectResearchClaim =
  z.infer<
    typeof ProspectResearchClaimSchema
  >;
export type ProspectResearchUnknown =
  z.infer<
    typeof ProspectResearchUnknownSchema
  >;
export type ProspectResearchReport =
  z.infer<
    typeof ProspectResearchReportSchema
  >;
export type ProspectResearchFailure =
  z.infer<
    typeof ProspectResearchFailureSchema
  >;
export type ProspectResearchAttemptReservationInput =
  z.infer<
    typeof ProspectResearchAttemptReservationInputSchema
  >;
export type ProspectResearchAttemptReservation =
  z.infer<
    typeof ProspectResearchAttemptReservationSchema
  >;
export type ProspectResearchModelUsage =
  z.infer<
    typeof ProspectResearchModelUsageSchema
  >;
export type LiveResearchFailureCode =
  typeof LIVE_RESEARCH_FAILURE_CODES[number];
export type CompletedProspectResearchAttempt =
  z.infer<
    typeof CompletedProspectResearchAttemptSchema
  >;
export type FailedProspectResearchAttempt =
  z.infer<
    typeof FailedProspectResearchAttemptSchema
  >;
export type ProspectResearchAttempt =
  z.infer<
    typeof ProspectResearchAttemptSchema
  >;
