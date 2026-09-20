import { z } from "zod";

const IdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9._:-]+$/);

const TextSchema = z
  .string()
  .trim()
  .min(1)
  .max(4_000);

export const EvidenceSourceKindSchema =
  z.enum([
    "public_web",
    "public_record",
    "buyer_statement",
    "operator",
    "internal_document",
    "system_run"
  ]);

export const EvidenceSchema = z
  .object({
    id: IdSchema,
    sourceKind: EvidenceSourceKindSchema,
    sourceRef: z.string().trim().min(1).max(2_000),
    statement: TextSchema,
    capturedAt: z.string().trim().min(1),
    reliability: z.enum([
      "direct",
      "derived"
    ]),
    confidence: z
      .number()
      .min(0)
      .max(1),
    tags: z
      .array(z.string().trim().min(1).max(120))
      .max(24)
      .default([])
  })
  .strict();

export const HypothesisSchema = z
  .object({
    id: IdSchema,
    statement: TextSchema,
    evidenceIds: z
      .array(IdSchema)
      .min(1)
      .max(24),
    confidence: z
      .number()
      .min(0)
      .max(1),
    status: z.enum([
      "open",
      "supported",
      "rejected"
    ])
  })
  .strict();

export const UnknownSchema = z
  .object({
    key: IdSchema,
    question: TextSchema,
    priority: z.enum([
      "low",
      "medium",
      "high"
    ])
  })
  .strict();

export const TransformationAreaSchema =
  z.enum([
    "workflow_redesign",
    "employee_augmentation",
    "agentic_automation",
    "knowledge_work",
    "customer_operations",
    "backoffice_operations",
    "decision_support",
    "data_knowledge_foundation",
    "ai_governance_operating_model",
    "workforce_enablement_change"
  ]);

export const TransformationSignalSchema =
  z.object({
    area: TransformationAreaSchema,
    statement: TextSchema,
    evidenceIds: z
      .array(IdSchema)
      .min(1)
      .max(24),
    confidence: z
      .number()
      .min(0)
      .max(1)
  }).strict();

export const FitStatusSchema = z.enum([
  "unknown",
  "strong",
  "moderate",
  "weak",
  "no_fit"
]);

export const ProspectSchema = z
  .object({
    id: IdSchema,
    companyName: TextSchema,
    domain: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .optional(),
    industry: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
    geography: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
    fitStatus: FitStatusSchema,
    fitRationale: TextSchema,
    evidenceIds: z
      .array(IdSchema)
      .max(100),
    hypotheses: z
      .array(HypothesisSchema)
      .max(40),
    disqualifiers: z
      .array(TextSchema)
      .max(24),
    transformationSignals: z
      .array(TransformationSignalSchema)
      .max(40)
  })
  .strict();

export const BuyerConcernSchema = z.enum([
  "workforce",
  "privacy",
  "security",
  "compliance",
  "trust",
  "implementation",
  "budget",
  "timing",
  "proof",
  "incumbent"
]);

export const BuyerSchema = z
  .object({
    id: IdSchema,
    prospectId: IdSchema,
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
    role: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
    seniority: z.enum([
      "individual_contributor",
      "manager",
      "director",
      "vp",
      "c_suite",
      "unknown"
    ]),
    identityEvidenceIds: z
      .array(IdSchema)
      .max(24),
    concerns: z
      .array(BuyerConcernSchema)
      .max(16),
    evidenceIds: z
      .array(IdSchema)
      .max(100)
  })
  .strict();

export const OpportunityStageSchema = z.enum([
  "research",
  "discovery",
  "qualification",
  "solution_fit",
  "next_step",
  "deferred",
  "disqualified"
]);

export const OpportunitySchema = z
  .object({
    id: IdSchema,
    prospectId: IdSchema,
    buyerIds: z
      .array(IdSchema)
      .max(24),
    stage: OpportunityStageSchema,
    currentNeed: z.enum([
      "yes",
      "no",
      "unknown"
    ]),
    incumbentStatus: z.enum([
      "trusted",
      "present",
      "none",
      "unknown"
    ]),
    concerns: z
      .array(BuyerConcernSchema)
      .max(16),
    proofRequests: z
      .array(z.enum([
        "customer_proof",
        "roi",
        "security",
        "implementation",
        "none"
      ]))
      .max(12),
    evidenceIds: z
      .array(IdSchema)
      .max(100)
  })
  .strict();

export const QualificationDimensionSchema =
  z.object({
    status: z.enum([
      "unknown",
      "known",
      "not_applicable"
    ]),
    summary: TextSchema.optional(),
    evidenceIds: z
      .array(IdSchema)
      .max(24)
  }).strict();

export const QualificationStateSchema =
  z.object({
    opportunityId: IdSchema,
    problem:
      QualificationDimensionSchema,
    impact:
      QualificationDimensionSchema,
    urgency:
      QualificationDimensionSchema,
    authority:
      QualificationDimensionSchema,
    decisionProcess:
      QualificationDimensionSchema,
    commercialSignal:
      QualificationDimensionSchema,
    proofRequired:
      QualificationDimensionSchema
  }).strict();

export const NextActionKindSchema = z.enum([
  "ask_question",
  "research",
  "defer",
  "send_approved_material",
  "propose_meeting",
  "handoff"
]);

export const NextActionSchema = z
  .object({
    kind: NextActionKindSchema,
    rationale: TextSchema,
    requiresAuthorization: z.boolean()
  })
  .strict();

export const SalesObjectiveSchema = z.enum([
  "diagnose_fit",
  "preserve_relationship",
  "understand_gap",
  "clarify_constraint",
  "clarify_proof",
  "qualify",
  "disqualify",
  "propose_next_step"
]);

export const ResponseModeSchema = z.enum([
  "hypothesis_and_question",
  "clarify_and_question",
  "evidence_and_question",
  "defer",
  "disqualify",
  "propose_next_step"
]);

export const SalesDecisionSchema = z
  .object({
    objective: SalesObjectiveSchema,
    responseMode: ResponseModeSchema,
    hypothesis: z
      .object({
        statement: TextSchema,
        evidenceIds: z
          .array(IdSchema)
          .min(1)
          .max(24)
      })
      .strict()
      .optional(),
    question: TextSchema.optional(),
    evidenceIds: z
      .array(IdSchema)
      .max(100),
    approvedClaimIds: z
      .array(IdSchema)
      .max(24),
    responseGuidance: z
      .array(TextSchema)
      .max(8)
      .default([]),
    qualificationDimension: z
      .enum([
        "problem",
        "impact",
        "urgency",
        "authority",
        "decisionProcess",
        "commercialSignal",
        "proofRequired"
      ])
      .optional(),
    nextAction: NextActionSchema
  })
  .strict();

export const OutcomeSchema = z
  .object({
    id: IdSchema,
    opportunityId: IdSchema,
    kind: z.enum([
      "no_fit",
      "learned",
      "qualified",
      "next_step_proposed",
      "next_step_authorized",
      "action_completed",
      "action_failed"
    ]),
    effect: z.enum([
      "none",
      "committed",
      "unknown"
    ]),
    evidenceIds: z
      .array(IdSchema)
      .max(100),
    recordedAt: z.string().trim().min(1)
  })
  .strict();

export const PublicProofClaimSchema =
  z.object({
    statement: TextSchema,
    kind: z.enum([
      "observed_result",
      "interpretation"
    ]),
    evidenceIds: z
      .array(IdSchema)
      .min(1)
      .max(100)
  }).strict();

export const PublicProofSchema = z
  .object({
    id: IdSchema,
    status: z.enum([
      "draft",
      "approved",
      "rejected",
      "published"
    ]),
    sourceRunIds: z
      .array(IdSchema)
      .min(1)
      .max(100),
    claims: z
      .array(PublicProofClaimSchema)
      .min(1)
      .max(24),
    piiSanitized: z.boolean(),
    authorizationRef: IdSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.status === "published" &&
      value.authorizationRef === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["authorizationRef"],
        message:
          "Published public proof requires explicit authorization."
      });
    }

    if (
      (value.status === "approved" ||
        value.status === "published") &&
      !value.piiSanitized
    ) {
      context.addIssue({
        code: "custom",
        path: ["piiSanitized"],
        message:
          "Approved or published public proof must be PII-sanitized."
      });
    }
  });

export type Evidence =
  z.infer<typeof EvidenceSchema>;
export type Hypothesis =
  z.infer<typeof HypothesisSchema>;
export type Prospect =
  z.infer<typeof ProspectSchema>;
export type Buyer =
  z.infer<typeof BuyerSchema>;
export type Opportunity =
  z.infer<typeof OpportunitySchema>;
export type QualificationState =
  z.infer<typeof QualificationStateSchema>;
export type NextAction =
  z.infer<typeof NextActionSchema>;
export type SalesDecision =
  z.infer<typeof SalesDecisionSchema>;
export type Outcome =
  z.infer<typeof OutcomeSchema>;
export type PublicProof =
  z.infer<typeof PublicProofSchema>;
export type TransformationArea =
  z.infer<typeof TransformationAreaSchema>;
