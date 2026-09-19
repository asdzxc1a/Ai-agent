import { z } from "zod";

const IdentifierSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const TextSchema = z.string().trim().min(1);
const EvidenceIdListSchema = z.array(IdentifierSchema).max(64);

export const EVIDENCE_KINDS = [
  "observed_fact",
  "inferred_hypothesis",
  "approved_claim",
  "unknown"
] as const;

export const ObservedEvidenceSchema = z.object({
  id: IdentifierSchema,
  kind: z.literal("observed_fact"),
  statement: TextSchema.max(2000),
  sourceUrl: z.string().url(),
  capturedAt: z.string().datetime({ offset: true })
}).strict();

export const HypothesisEvidenceSchema = z.object({
  id: IdentifierSchema,
  kind: z.literal("inferred_hypothesis"),
  statement: TextSchema.max(2000),
  supportingEvidenceIds: z.array(IdentifierSchema).min(1).max(32),
  confidence: z.number().min(0).max(1)
}).strict();

export const ApprovedClaimEvidenceSchema = z.object({
  id: IdentifierSchema,
  kind: z.literal("approved_claim"),
  statement: TextSchema.max(2000),
  claimId: IdentifierSchema
}).strict();

export const UnknownEvidenceSchema = z.object({
  id: IdentifierSchema,
  kind: z.literal("unknown"),
  statement: TextSchema.max(1000),
  question: TextSchema.max(1000)
}).strict();

export const EvidenceSchema = z.discriminatedUnion("kind", [
  ObservedEvidenceSchema,
  HypothesisEvidenceSchema,
  ApprovedClaimEvidenceSchema,
  UnknownEvidenceSchema
]);

export const ServiceClaimSchema = z.object({
  id: IdentifierSchema,
  text: TextSchema.max(1000),
  evidenceRequirement: z.enum(["operator_approved", "evidence_backed"]),
  notes: z.string().trim().max(1000).nullable()
}).strict();

export const ServiceOfferSchema = z.object({
  id: IdentifierSchema,
  name: TextSchema.max(240),
  summary: TextSchema.max(3000),
  approvedClaims: z.array(ServiceClaimSchema).min(1).max(64),
  prohibitedClaims: z.array(TextSchema.max(1000)).min(1).max(64),
  unknowns: z.array(TextSchema.max(1000)).max(64)
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  for (const claim of value.approvedClaims) {
    if (ids.has(claim.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate approved claim id: ${claim.id}`,
        path: ["approvedClaims"]
      });
    }
    ids.add(claim.id);
  }
});

export const PROSPECT_FITS = [
  "unknown",
  "strong",
  "medium",
  "weak",
  "disqualified"
] as const;

export const ProspectSchema = z.object({
  id: IdentifierSchema,
  domain: TextSchema.max(253),
  companyName: z.string().trim().max(240).nullable(),
  fit: z.enum(PROSPECT_FITS),
  disqualifiers: z.array(TextSchema.max(500)).max(32),
  evidenceIds: EvidenceIdListSchema,
  hypothesisIds: EvidenceIdListSchema
}).strict();

export const BUYER_AUTHORITIES = [
  "unknown",
  "user",
  "influencer",
  "champion",
  "decision_maker",
  "blocker"
] as const;

export const BuyerSchema = z.object({
  id: IdentifierSchema,
  prospectId: IdentifierSchema,
  name: z.string().trim().max(240).nullable(),
  role: z.string().trim().max(240).nullable(),
  authority: z.enum(BUYER_AUTHORITIES),
  email: z.string().email().nullable(),
  profileUrl: z.string().url().nullable(),
  evidenceIds: EvidenceIdListSchema
}).strict();

export const QUALIFICATION_DIMENSIONS = [
  "transformationNeed",
  "workflowPain",
  "businessImpact",
  "aiMaturity",
  "sponsor",
  "decisionProcess",
  "timeline",
  "budgetSignal",
  "securityCompliance",
  "nextStepReadiness"
] as const;

export const QualificationDimensionSchema = z.object({
  status: z.enum(["unknown", "known", "not_applicable"]),
  value: z.string().trim().max(1000).nullable(),
  evidenceIds: EvidenceIdListSchema
}).strict().superRefine((value, context) => {
  if (value.status === "known" && !value.value) {
    context.addIssue({
      code: "custom",
      message: "known qualification dimension requires value",
      path: ["value"]
    });
  }

  if (value.status !== "known" && value.value !== null) {
    context.addIssue({
      code: "custom",
      message: "unknown/not_applicable qualification value must be null",
      path: ["value"]
    });
  }
});

export const QualificationStateSchema = z.object({
  transformationNeed: QualificationDimensionSchema,
  workflowPain: QualificationDimensionSchema,
  businessImpact: QualificationDimensionSchema,
  aiMaturity: QualificationDimensionSchema,
  sponsor: QualificationDimensionSchema,
  decisionProcess: QualificationDimensionSchema,
  timeline: QualificationDimensionSchema,
  budgetSignal: QualificationDimensionSchema,
  securityCompliance: QualificationDimensionSchema,
  nextStepReadiness: QualificationDimensionSchema
}).strict();

export const OPPORTUNITY_STAGES = [
  "research",
  "outreach",
  "discovery",
  "qualification",
  "solution_fit",
  "commitment",
  "next_step",
  "deferred",
  "closed_won",
  "closed_lost"
] as const;

export const SALES_SIGNALS = [
  "none",
  "no_current_need",
  "existing_supplier",
  "send_info",
  "proof_request",
  "security_concern",
  "workforce_concern",
  "ai_skepticism",
  "budget_question",
  "timeline_question",
  "decision_process",
  "ready_next_step",
  "not_fit"
] as const;

export const NEXT_ACTION_KINDS = [
  "ask_question",
  "share_evidence",
  "defer",
  "human_handoff",
  "approved_followup",
  "book_meeting",
  "no_action"
] as const;

const EXTERNAL_ACTIONS = new Set<string>([
  "human_handoff",
  "approved_followup",
  "book_meeting"
]);

export const NextActionSchema = z.object({
  kind: z.enum(NEXT_ACTION_KINDS),
  rationale: TextSchema.max(1200),
  requiresApproval: z.boolean()
}).strict().superRefine((value, context) => {
  const external = EXTERNAL_ACTIONS.has(value.kind);
  if (external !== value.requiresApproval) {
    context.addIssue({
      code: "custom",
      message: external
        ? "external next action requires approval"
        : "non-external next action must not require approval",
      path: ["requiresApproval"]
    });
  }
});

export const OpportunitySchema = z.object({
  id: IdentifierSchema,
  prospectId: IdentifierSchema,
  buyerIds: z.array(IdentifierSchema).max(32),
  stage: z.enum(OPPORTUNITY_STAGES),
  qualification: QualificationStateSchema,
  activeSignals: z.array(z.enum(SALES_SIGNALS)).max(16),
  evidenceIds: EvidenceIdListSchema,
  nextAction: NextActionSchema.nullable()
}).strict();

const EvidenceBackedDecisionClaimSchema = z.object({
  kind: z.enum(["observed_fact", "inferred_hypothesis"]),
  statement: TextSchema.max(1200),
  evidenceIds: z.array(IdentifierSchema).min(1).max(16)
}).strict();

const ApprovedDecisionClaimSchema = z.object({
  kind: z.literal("approved_claim"),
  statement: TextSchema.max(1200),
  approvedClaimId: IdentifierSchema
}).strict();

export const DecisionClaimSchema = z.union([
  EvidenceBackedDecisionClaimSchema,
  ApprovedDecisionClaimSchema
]);

export const SalesDecisionSchema = z.object({
  objective: TextSchema.max(1200),
  responseGuidance: TextSchema.max(3000),
  question: z.string().trim().max(1200).nullable(),
  questionTarget: z.enum(QUALIFICATION_DIMENSIONS).nullable(),
  claims: z.array(DecisionClaimSchema).max(16),
  nextAction: NextActionSchema,
  confidence: z.number().min(0).max(1).nullable()
}).strict().superRefine((value, context) => {
  const asksQuestion = value.nextAction.kind === "ask_question";
  if (asksQuestion && (!value.question || !value.questionTarget)) {
    context.addIssue({
      code: "custom",
      message: "ask_question requires question and questionTarget",
      path: ["question"]
    });
  }

  if (!value.question && value.questionTarget !== null) {
    context.addIssue({
      code: "custom",
      message: "questionTarget requires a question",
      path: ["questionTarget"]
    });
  }
});

export const OutcomeSchema = z.object({
  id: IdentifierSchema,
  prospectId: IdentifierSchema,
  opportunityId: IdentifierSchema,
  kind: z.enum([
    "no_fit",
    "deferred",
    "continued",
    "human_handoff",
    "meeting_booked",
    "followup_sent",
    "closed_won",
    "closed_lost"
  ]),
  summary: TextSchema.max(2000),
  evidenceIds: EvidenceIdListSchema,
  occurredAt: z.string().datetime({ offset: true })
}).strict();

export const PublicProofClaimSchema = z.object({
  statement: TextSchema.max(1200),
  evidenceIds: z.array(IdentifierSchema).min(1).max(32),
  interpretation: z.boolean()
}).strict();

export const PublicProofSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  outcomeId: IdentifierSchema,
  createdAt: z.string().datetime({ offset: true }),
  claims: z.array(PublicProofClaimSchema).min(1).max(32),
  redactions: z.array(TextSchema.max(500)).max(64),
  approvedForPublication: z.boolean()
}).strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type ServiceOffer = z.infer<typeof ServiceOfferSchema>;
export type Prospect = z.infer<typeof ProspectSchema>;
export type Buyer = z.infer<typeof BuyerSchema>;
export type QualificationState = z.infer<typeof QualificationStateSchema>;
export type QualificationDimensionKey = typeof QUALIFICATION_DIMENSIONS[number];
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type SalesSignal = typeof SALES_SIGNALS[number];
export type NextAction = z.infer<typeof NextActionSchema>;
export type NextActionKind = typeof NEXT_ACTION_KINDS[number];
export type SalesDecision = z.infer<typeof SalesDecisionSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type PublicProof = z.infer<typeof PublicProofSchema>;

function unknownQualificationDimension() {
  return {
    status: "unknown" as const,
    value: null,
    evidenceIds: []
  };
}

export function emptyQualificationState(): QualificationState {
  return {
    transformationNeed: unknownQualificationDimension(),
    workflowPain: unknownQualificationDimension(),
    businessImpact: unknownQualificationDimension(),
    aiMaturity: unknownQualificationDimension(),
    sponsor: unknownQualificationDimension(),
    decisionProcess: unknownQualificationDimension(),
    timeline: unknownQualificationDimension(),
    budgetSignal: unknownQualificationDimension(),
    securityCompliance: unknownQualificationDimension(),
    nextStepReadiness: unknownQualificationDimension()
  };
}

export function validateEvidenceGraph(input: {
  evidence: readonly Evidence[];
  serviceOffer: ServiceOffer;
}): string[] {
  const evidenceById = new Map(
    input.evidence.map((item) => [item.id, item] as const)
  );
  const approvedClaims = new Map(
    input.serviceOffer.approvedClaims.map((claim) => [claim.id, claim] as const)
  );
  const errors: string[] = [];

  for (const item of input.evidence) {
    if (item.kind === "approved_claim") {
      const approved = approvedClaims.get(item.claimId);
      if (!approved) {
        errors.push(`unknown approved claim evidence: ${item.claimId}`);
      } else if (approved.text !== item.statement) {
        errors.push(`approved claim text mismatch: ${item.claimId}`);
      }
      continue;
    }

    if (item.kind !== "inferred_hypothesis") continue;

    for (const supportingId of item.supportingEvidenceIds) {
      const supporting = evidenceById.get(supportingId);
      if (!supporting) {
        errors.push(`hypothesis references unknown evidence: ${supportingId}`);
      } else if (supporting.kind === "unknown") {
        errors.push(`hypothesis cannot use unknown as evidence: ${supportingId}`);
      }
    }
  }

  return errors;
}

export function validateDecisionEvidence(input: {
  decision: SalesDecision;
  evidence: readonly Evidence[];
  serviceOffer: ServiceOffer;
}): string[] {
  const evidenceById = new Map(
    input.evidence.map((item) => [item.id, item] as const)
  );
  const approvedClaims = new Map(
    input.serviceOffer.approvedClaims.map((claim) => [claim.id, claim] as const)
  );
  const errors = validateEvidenceGraph({
    evidence: input.evidence,
    serviceOffer: input.serviceOffer
  });

  for (const claim of input.decision.claims) {
    if (claim.kind === "approved_claim") {
      const approved = approvedClaims.get(claim.approvedClaimId);
      if (!approved) {
        errors.push(`unknown approved claim: ${claim.approvedClaimId}`);
      } else if (approved.text !== claim.statement) {
        errors.push(`approved claim text mismatch: ${claim.approvedClaimId}`);
      }
      continue;
    }

    const referenced = claim.evidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((item): item is Evidence => item !== undefined);

    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceById.has(evidenceId)) {
        errors.push(`unknown evidence: ${evidenceId}`);
      }
    }

    if (
      claim.kind === "observed_fact" &&
      !referenced.some((item) =>
        item.kind === "observed_fact" &&
        item.statement === claim.statement
      )
    ) {
      errors.push("observed fact claim must match referenced observed evidence");
    }

    if (
      claim.kind === "inferred_hypothesis" &&
      referenced.some((item) => item.kind === "unknown")
    ) {
      errors.push("hypothesis claim cannot rely on unknown evidence");
    }
  }

  return errors;
}

export function validatePublicProofEvidence(input: {
  proof: PublicProof;
  evidenceIds: ReadonlySet<string>;
}): string[] {
  const errors: string[] = [];

  for (const claim of input.proof.claims) {
    for (const evidenceId of claim.evidenceIds) {
      if (!input.evidenceIds.has(evidenceId)) {
        errors.push(`public proof references unknown evidence: ${evidenceId}`);
      }
    }
  }

  return errors;
}
