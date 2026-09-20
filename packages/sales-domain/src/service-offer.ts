import { z } from "zod";

const ClaimSchema = z.object({
  id: z.string().min(1).max(160),
  text: z.string().trim().min(1).max(2_000),
  evidenceRequirement: z.enum([
    "operator_approved_service_definition",
    "verified_customer_proof",
    "verified_outcome_evidence"
  ])
}).strict();

const BoundaryItemSchema = z.object({
  id: z.string().min(1).max(160),
  description: z
    .string()
    .trim()
    .min(1)
    .max(2_000)
}).strict();

export const ServiceOfferSchema =
  z.object({
    id: z.string().min(1).max(160),
    version: z.number().int().positive(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(240),
    positioning: z
      .string()
      .trim()
      .min(1)
      .max(2_000),
    approvedClaims: z
      .array(ClaimSchema)
      .min(1),
    nonClaims: z
      .array(BoundaryItemSchema)
      .min(1),
    explicitUnknowns: z
      .array(BoundaryItemSchema)
      .min(1)
  })
  .strict();

export type ServiceOffer =
  z.infer<typeof ServiceOfferSchema>;

export const ASTRA_SERVICE_OFFER_V1:
  ServiceOffer = ServiceOfferSchema.parse({
    id: "astra-ai-native-transformation",
    version: 1,
    name:
      "AI-native company and workforce transformation",
    positioning:
      "Help companies redesign workflows, augment employees with AI, introduce reliable AI workers/agents, and move from isolated AI experiments toward an operating model where people and AI systems work together.",
    approvedClaims: [
      {
        id: "service.workflow_redesign",
        text:
          "We help companies redesign workflows around people and AI systems.",
        evidenceRequirement:
          "operator_approved_service_definition"
      },
      {
        id: "service.employee_augmentation",
        text:
          "We help companies augment employees with AI in their day-to-day work.",
        evidenceRequirement:
          "operator_approved_service_definition"
      },
      {
        id: "service.ai_workers",
        text:
          "We help companies introduce reliable AI workers and agents into governed workflows.",
        evidenceRequirement:
          "operator_approved_service_definition"
      },
      {
        id: "service.operating_model",
        text:
          "We help companies move from isolated AI experiments toward an operating model where people and AI systems work together.",
        evidenceRequirement:
          "operator_approved_service_definition"
      }
    ],
    nonClaims: [
      {
        id: "nonclaim.pricing",
        description:
          "No price, discount, fee, or commercial package is approved yet."
      },
      {
        id: "nonclaim.guaranteed_roi",
        description:
          "No ROI, savings, revenue, productivity, or payback outcome is guaranteed."
      },
      {
        id: "nonclaim.headcount_reduction",
        description:
          "No headcount reduction or workforce replacement outcome is promised."
      },
      {
        id: "nonclaim.customer_proof",
        description:
          "No customer logo, case study, testimonial, or quantified customer result is approved yet."
      },
      {
        id: "nonclaim.certifications",
        description:
          "No security, privacy, compliance, or industry certification claim is approved yet."
      },
      {
        id: "nonclaim.timeline",
        description:
          "No implementation, transformation, or deployment timeline is guaranteed."
      }
    ],
    explicitUnknowns: [
      {
        id: "unknown.packaging",
        description:
          "Exact commercial packaging is not defined."
      },
      {
        id: "unknown.pricing",
        description:
          "Pricing is not defined."
      },
      {
        id: "unknown.guarantees",
        description:
          "No guarantees are defined."
      },
      {
        id: "unknown.customer_proof",
        description:
          "Approved customer proof is not yet defined."
      },
      {
        id: "unknown.timeline",
        description:
          "Implementation timelines are not yet defined."
      },
      {
        id: "unknown.industry_scope",
        description:
          "Industry-specific scope and constraints are not yet defined."
      }
    ]
  });

export function approvedClaimIds(
  offer: ServiceOffer
): Set<string> {
  return new Set(
    offer.approvedClaims.map(
      (claim) => claim.id
    )
  );
}

export function unknownClaimIds(
  offer: ServiceOffer,
  claimIds: readonly string[]
): string[] {
  const allowed = approvedClaimIds(offer);
  return [
    ...new Set(
      claimIds.filter(
        (id) => !allowed.has(id)
      )
    )
  ];
}
