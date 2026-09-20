import { z } from "zod";

import {
  ConsultativePolicyInputSchema,
  NextActionKindSchema,
  SalesObjectiveSchema
} from "@astra/sales-domain";

export const SALESBENCH_VERSION =
  "salesbench-v1";

export const SalesBenchCategorySchema =
  z.enum([
    "strong_fit",
    "weak_or_no_fit",
    "incumbent",
    "no_current_need",
    "executive_skepticism",
    "workforce",
    "privacy_security_compliance",
    "budget_timing",
    "authority_process",
    "send_materials",
    "proof_and_guarantees",
    "discovery_uncertainty",
    "qualification_next_step"
  ]);

export const HardRuleSchema = z.enum([
  "approved_claims_only",
  "known_evidence_only",
  "external_action_requires_authorization",
  "no_pressure_without_need",
  "no_fit_must_disqualify",
  "trusted_incumbent_must_not_be_displaced",
  "no_guaranteed_outcomes",
  "no_invented_customer_proof"
]);

export const SalesBenchExpectedSchema =
  z.object({
    objectives: z
      .array(SalesObjectiveSchema)
      .min(1),
    nextActionKinds: z
      .array(NextActionKindSchema)
      .min(1),
    questionRequired: z.boolean(),
    questionConcepts: z
      .array(
        z.string().trim().min(1).max(120)
      )
      .max(12),
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
      .optional()
  })
  .strict();

export const SalesBenchScenarioSchema =
  z.object({
    id: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9-]+$/),
    version: z
      .number()
      .int()
      .positive(),
    category:
      SalesBenchCategorySchema,
    input:
      ConsultativePolicyInputSchema,
    expected:
      SalesBenchExpectedSchema,
    hardRules: z
      .array(HardRuleSchema)
      .min(1)
  })
  .strict();

export const SalesBenchScoreVectorSchema =
  z.object({
    factuality: z.number().min(0).max(1),
    evidenceUse: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    questionQuality: z.number().min(0).max(1),
    informationGain: z.number().min(0).max(1),
    qualificationQuality: z.number().min(0).max(1),
    trust: z.number().min(0).max(1),
    pressureSafety: z.number().min(0).max(1),
    nextStepQuality: z.number().min(0).max(1)
  })
  .strict();

export const SalesBenchResultSchema =
  z.object({
    scenarioId: z.string().min(1),
    hardGatePassed: z.boolean(),
    hardViolations: z.array(z.string()),
    policyMatched: z.boolean(),
    score:
      SalesBenchScoreVectorSchema,
    overallScore: z
      .number()
      .min(0)
      .max(1)
  })
  .strict();

export const PinnedModelDescriptorSchema =
  z.object({
    provider: z
      .string()
      .trim()
      .min(1)
      .max(120),
    model: z
      .string()
      .trim()
      .min(1)
      .max(240),
    revision: z
      .string()
      .trim()
      .min(1)
      .max(240),
    policyVersion: z
      .string()
      .trim()
      .min(1)
      .max(160)
  })
  .strict();

export type SalesBenchScenario =
  z.infer<
    typeof SalesBenchScenarioSchema
  >;
export type SalesBenchResult =
  z.infer<
    typeof SalesBenchResultSchema
  >;
export type SalesBenchScoreVector =
  z.infer<
    typeof SalesBenchScoreVectorSchema
  >;
export type PinnedModelDescriptor =
  z.infer<
    typeof PinnedModelDescriptorSchema
  >;
