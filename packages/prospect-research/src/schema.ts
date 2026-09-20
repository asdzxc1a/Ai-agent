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

const AttemptBase = {
  id: IdentifierSchema,
  target:
    ApprovedResearchTargetSchema,
  createdAt:
    z.string().datetime({
      offset: true
    })
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
        "gate13-measured-research-v1"
      ),
    targets:
      z.array(
        ApprovedResearchTargetSchema
      ).min(1).max(50),
    criteria:
      ProspectResearchSampleCriteriaSchema,
    humanBaselineDescription:
      TextSchema.max(4000),
    comparisonBaselineDescription:
      z.string()
        .trim()
        .min(1)
        .max(4000)
        .nullable(),
    frozenBy:
      TextSchema.max(240),
    frozenAt:
      z.string().datetime({
        offset: true
      })
  }).strict()
    .superRefine(
      (sample, context) => {
        const targetIds =
          sample.targets.map(
            (target) =>
              target.id
          );

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
            target.approval
              .approvedAt >
            sample.frozenAt
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

export const ProspectResearchSampleOutcomeSchema =
  z.object({
    id: IdentifierSchema,
    sampleId: IdentifierSchema,
    targetId: IdentifierSchema,
    attemptId: IdentifierSchema,
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
    baselineHumanPreparationMinutes:
      z.number()
        .finite()
        .positive(),
    astraHumanReviewMinutes:
      z.number()
        .finite()
        .nonnegative(),
    endToEndDurationMs:
      z.number()
        .int()
        .positive(),
    deliveryCostUsd:
      z.number()
        .finite()
        .nonnegative(),
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

export type ProspectResearchSampleCriteria =
  z.infer<
    typeof ProspectResearchSampleCriteriaSchema
  >;
export type ProspectResearchSample =
  z.infer<
    typeof ProspectResearchSampleSchema
  >;
export type ProspectResearchSampleOutcome =
  z.infer<
    typeof ProspectResearchSampleOutcomeSchema
  >;
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
