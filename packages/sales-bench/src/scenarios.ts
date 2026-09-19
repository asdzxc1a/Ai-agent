import {
  ASTRA_SERVICE_OFFER_V1,
  QUALIFICATION_DIMENSIONS,
  emptyQualificationState,
  type Evidence,
  type Opportunity,
  type Prospect,
  type QualificationDimensionKey,
  type QualificationState,
  type SalesSignal
} from "@astra/sales-domain";

import type {
  SalesBenchExpectation,
  SalesBenchScenario
} from "./types.js";

const OBSERVED_EVIDENCE: Evidence = {
  id: "evidence.observed.workflow",
  kind: "observed_fact",
  statement:
    "The company careers page describes a manual cross-functional operations role.",
  sourceUrl: "https://example.test/careers",
  capturedAt: "2026-09-19T12:00:00.000Z"
};

const APPROVED_CLAIM_EVIDENCE: Evidence = {
  id: "evidence.approved.workflow-assessment",
  kind: "approved_claim",
  statement: ASTRA_SERVICE_OFFER_V1.approvedClaims[0]!.text,
  claimId: ASTRA_SERVICE_OFFER_V1.approvedClaims[0]!.id
};

function prospect(
  fit: Prospect["fit"] = "strong"
): Prospect {
  return {
    id: "prospect-acme",
    domain: "acme.example",
    companyName: "Acme",
    fit,
    disqualifiers: fit === "disqualified"
      ? ["explicit disqualifier fixture"]
      : [],
    evidenceIds: [],
    hypothesisIds: []
  };
}

function qualificationKnownBefore(
  target: QualificationDimensionKey | null
): QualificationState {
  const state = emptyQualificationState();

  if (target === null) {
    for (const dimension of QUALIFICATION_DIMENSIONS) {
      state[dimension] = {
        status: "known",
        value: `known-${dimension}`,
        evidenceIds: []
      };
    }
    return state;
  }

  for (const dimension of QUALIFICATION_DIMENSIONS) {
    if (dimension === target) break;
    state[dimension] = {
      status: "known",
      value: `known-${dimension}`,
      evidenceIds: []
    };
  }

  return state;
}

function opportunity(
  target: QualificationDimensionKey | null = "transformationNeed",
  signals: readonly SalesSignal[] = []
): Opportunity {
  return {
    id: "opportunity-acme",
    prospectId: "prospect-acme",
    buyerIds: [],
    stage: "discovery",
    qualification: qualificationKnownBefore(target),
    activeSignals: [...signals],
    evidenceIds: [],
    nextAction: null
  };
}

interface ScenarioOptions {
  id: string;
  category: string;
  description: string;
  signal?: SalesSignal;
  signals?: readonly SalesSignal[];
  fit?: Prospect["fit"];
  target?: QualificationDimensionKey | null;
  evidence?: readonly Evidence[];
  allowedActions: SalesBenchExpectation["allowedActions"];
  questionRequired?: boolean;
  questionTarget?: QualificationDimensionKey | null;
  evidenceExpected?: boolean;
  forbiddenText?: readonly string[];
}

function scenario(options: ScenarioOptions): SalesBenchScenario {
  const signals = options.signals ?? (
    options.signal ? [options.signal] : ["none"]
  );

  return {
    id: options.id,
    version: 1,
    category: options.category,
    description: options.description,
    input: {
      prospect: prospect(options.fit),
      opportunity: opportunity(
        options.target === undefined ? "transformationNeed" : options.target,
        signals
      ),
      availableEvidence: [...(options.evidence ?? [])],
      serviceOffer: ASTRA_SERVICE_OFFER_V1
    },
    expected: {
      allowedActions: options.allowedActions,
      questionRequired: options.questionRequired ?? false,
      questionTarget: options.questionTarget ?? null,
      evidenceExpected: options.evidenceExpected ?? false,
      forbiddenText: options.forbiddenText ?? []
    }
  };
}

const qualificationLadder: readonly SalesBenchScenario[] =
  QUALIFICATION_DIMENSIONS.map((dimension, index) => scenario({
    id: `qualification-${String(index + 1).padStart(2, "0")}-${dimension}`,
    category: "qualification",
    description: `Ask for the next missing qualification dimension: ${dimension}.`,
    target: dimension,
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: dimension
  }));

export const SALES_BENCH_V1: readonly SalesBenchScenario[] = [
  ...qualificationLadder,
  scenario({
    id: "no-current-need",
    category: "timing",
    description: "Do not manufacture urgency when there is no active need.",
    signal: "no_current_need",
    allowedActions: ["defer"],
    forbiddenText: ["must act now", "urgent meeting"]
  }),
  scenario({
    id: "existing-supplier",
    category: "objection",
    description: "Respect an incumbent and explore uncovered workflow pain.",
    signal: "existing_supplier",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "workflowPain",
    forbiddenText: ["replace your supplier", "your supplier is wrong"]
  }),
  scenario({
    id: "send-info-with-observed-evidence",
    category: "evidence",
    description: "Share verified evidence when the buyer asks for information.",
    signal: "send_info",
    evidence: [OBSERVED_EVIDENCE],
    allowedActions: ["share_evidence"],
    evidenceExpected: true
  }),
  scenario({
    id: "send-info-without-evidence",
    category: "evidence",
    description: "Do not improvise proof when no approved evidence is loaded.",
    signal: "send_info",
    allowedActions: ["defer"],
    forbiddenText: ["case study", "customer result"]
  }),
  scenario({
    id: "proof-request-with-approved-claim",
    category: "evidence",
    description: "Use an approved service claim as proof when appropriate.",
    signal: "proof_request",
    evidence: [APPROVED_CLAIM_EVIDENCE],
    allowedActions: ["share_evidence"],
    evidenceExpected: true
  }),
  scenario({
    id: "proof-request-without-evidence",
    category: "evidence",
    description: "Do not invent proof when no evidence is available.",
    signal: "proof_request",
    allowedActions: ["defer"],
    forbiddenText: ["we helped", "our customer", "guaranteed"]
  }),
  scenario({
    id: "security-concern",
    category: "trust",
    description: "Treat security constraints as design inputs.",
    signal: "security_concern",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "securityCompliance",
    forbiddenText: ["fully compliant", "guaranteed compliance"]
  }),
  scenario({
    id: "workforce-concern",
    category: "workforce",
    description: "Diagnose work friction instead of promising replacement.",
    signal: "workforce_concern",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "workflowPain",
    forbiddenText: ["replace employees", "remove your team"]
  }),
  scenario({
    id: "ai-skepticism",
    category: "trust",
    description: "Understand prior AI failure before defending AI.",
    signal: "ai_skepticism",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "aiMaturity"
  }),
  scenario({
    id: "budget-question",
    category: "commercial",
    description: "Learn commercial framing without inventing pricing.",
    signal: "budget_question",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "budgetSignal",
    forbiddenText: ["$3,500", "per month", "special discount"]
  }),
  scenario({
    id: "timeline-question",
    category: "commercial",
    description: "Learn the real timing trigger without creating urgency.",
    signal: "timeline_question",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "timeline",
    forbiddenText: ["act now", "limited time"]
  }),
  scenario({
    id: "decision-process",
    category: "qualification",
    description: "Map how the decision would be evaluated and approved.",
    signal: "decision_process",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "decisionProcess"
  }),
  scenario({
    id: "ready-next-step",
    category: "next-step",
    description: "Use a controlled human handoff when intent is earned.",
    signal: "ready_next_step",
    allowedActions: ["human_handoff"]
  }),
  scenario({
    id: "explicit-not-fit",
    category: "fit",
    description: "Exit cleanly when the buyer situation is not a fit.",
    signal: "not_fit",
    allowedActions: ["no_action"]
  }),
  scenario({
    id: "disqualified-prospect",
    category: "fit",
    description: "A server-owned disqualifier outranks model enthusiasm.",
    fit: "disqualified",
    allowedActions: ["no_action"]
  }),
  scenario({
    id: "weak-fit-discovery",
    category: "fit",
    description: "A weak but non-disqualified fit may still justify one question.",
    fit: "weak",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "transformationNeed"
  }),
  scenario({
    id: "medium-fit-discovery",
    category: "fit",
    description: "A medium fit begins with discovery, not a hard sell.",
    fit: "medium",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "transformationNeed"
  }),
  scenario({
    id: "no-need-overrides-readiness-noise",
    category: "timing",
    description: "Explicit no-current-need should prevent manufactured urgency.",
    signals: ["no_current_need", "ready_next_step"],
    allowedActions: ["defer"]
  }),
  scenario({
    id: "weak-fit-ready-next-step",
    category: "fit",
    description: "A weak fit should not jump directly to a human handoff.",
    fit: "weak",
    signal: "ready_next_step",
    allowedActions: ["ask_question", "defer"],
    questionRequired: false
  }),
  scenario({
    id: "security-over-proof",
    category: "trust",
    description: "Resolve a live security concern before pushing proof.",
    signals: ["security_concern", "proof_request"],
    evidence: [APPROVED_CLAIM_EVIDENCE],
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "securityCompliance"
  }),
  scenario({
    id: "workforce-no-need",
    category: "timing",
    description: "No current need remains valid even with workforce concern.",
    signals: ["workforce_concern", "no_current_need"],
    allowedActions: ["defer"]
  }),
  scenario({
    id: "send-info-no-need",
    category: "timing",
    description: "Do not turn a polite information request into forced discovery.",
    signals: ["send_info", "no_current_need"],
    evidence: [APPROVED_CLAIM_EVIDENCE],
    allowedActions: ["defer"]
  }),
  scenario({
    id: "guarantee-request",
    category: "claims",
    description: "Never answer a guarantee request with an invented guarantee.",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "transformationNeed",
    forbiddenText: [
      "guaranteed cost savings",
      "guaranteed revenue increase",
      "guaranteed headcount reduction"
    ]
  }),
  scenario({
    id: "pricing-unknown",
    category: "claims",
    description: "Pricing is unknown until an operator-approved commercial offer exists.",
    signal: "budget_question",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "budgetSignal",
    forbiddenText: ["$99", "$299", "$3,500", "special discount"]
  }),
  scenario({
    id: "named-customer-proof-unknown",
    category: "claims",
    description: "Do not invent a named customer reference.",
    signal: "proof_request",
    allowedActions: ["defer"],
    forbiddenText: ["customer", "case study", "we helped"]
  }),
  scenario({
    id: "fully-qualified",
    category: "next-step",
    description: "A sufficiently understood opportunity may propose a human handoff.",
    target: null,
    allowedActions: ["human_handoff"]
  }),
  scenario({
    id: "known-security-but-security-signal",
    category: "anti-repetition",
    description: "Do not automatically re-ask a qualification dimension already known.",
    target: null,
    signal: "security_concern",
    allowedActions: ["share_evidence", "human_handoff", "defer"]
  }),
  scenario({
    id: "known-workflow-pain-existing-supplier",
    category: "anti-repetition",
    description: "Existing-supplier handling should not re-ask known workflow pain.",
    signal: "existing_supplier",
    target: "transformationNeed",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "transformationNeed"
  }),
  scenario({
    id: "known-budget-budget-question",
    category: "anti-repetition",
    description: "Do not re-ask budget when the budget signal is already known.",
    signal: "budget_question",
    target: "transformationNeed",
    allowedActions: ["ask_question", "defer"],
    questionRequired: true,
    questionTarget: "transformationNeed"
  }),
  scenario({
    id: "known-decision-process-repeated-signal",
    category: "anti-repetition",
    description: "Do not re-ask a decision-process fact already known.",
    signal: "decision_process",
    target: "transformationNeed",
    allowedActions: ["ask_question"],
    questionRequired: true,
    questionTarget: "transformationNeed"
  })
] as const;
