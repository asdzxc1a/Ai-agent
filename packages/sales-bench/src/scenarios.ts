import {
  ASTRA_SERVICE_OFFER_V1,
  ConsultativePolicyInputSchema
} from "@astra/sales-domain";

import {
  SALESBENCH_VERSION,
  SalesBenchScenarioSchema,
  type SalesBenchScenario
} from "./types.js";

interface ScenarioOptions {
  id: string;
  category:
    SalesBenchScenario["category"];
  turn: string;
  fit?: "strong" | "moderate" | "weak" | "no_fit";
  currentNeed?: "yes" | "no" | "unknown";
  incumbent?: "trusted" | "present" | "none" | "unknown";
  concerns?: Array<
    "workforce" |
    "privacy" |
    "security" |
    "compliance" |
    "trust" |
    "implementation" |
    "budget" |
    "timing" |
    "proof" |
    "incumbent"
  >;
  proofRequests?: Array<
    "customer_proof" |
    "roi" |
    "security" |
    "implementation" |
    "none"
  >;
  disqualifiers?: string[];
  known?: Array<
    "problem" |
    "impact" |
    "urgency" |
    "authority" |
    "decisionProcess" |
    "commercialSignal" |
    "proofRequired"
  >;
  hypothesis?: string;
  expectedObjectives:
    SalesBenchScenario[
      "expected"
    ]["objectives"];
  expectedNext:
    SalesBenchScenario[
      "expected"
    ]["nextActionKinds"];
  questionRequired?: boolean;
  questionConcepts?: string[];
  qualificationDimension?:
    SalesBenchScenario[
      "expected"
    ]["qualificationDimension"];
  hardRules?: SalesBenchScenario[
    "hardRules"
  ];
}

const ALL_HARD_RULES:
  SalesBenchScenario["hardRules"] = [
    "approved_claims_only",
    "known_evidence_only",
    "external_action_requires_authorization",
    "no_pressure_without_need",
    "no_fit_must_disqualify",
    "trusted_incumbent_must_not_be_displaced",
    "no_guaranteed_outcomes",
    "no_invented_customer_proof"
  ];

function scenario(
  options: ScenarioOptions
): SalesBenchScenario {
  const evidenceId =
    "ev-" + options.id;
  const known = new Set(
    options.known ?? []
  );
  const dimension = (
    key:
      | "problem"
      | "impact"
      | "urgency"
      | "authority"
      | "decisionProcess"
      | "commercialSignal"
      | "proofRequired"
  ) => ({
    status: known.has(key)
      ? "known" as const
      : "unknown" as const,
    ...(known.has(key)
      ? {
          summary:
            "Known from scenario evidence."
        }
      : {}),
    evidenceIds: known.has(key)
      ? [evidenceId]
      : []
  });

  const input =
    ConsultativePolicyInputSchema.parse({
      serviceOffer:
        ASTRA_SERVICE_OFFER_V1,
      prospect: {
        id:
          "prospect-" + options.id,
        companyName:
          "Scenario " + options.id,
        domain:
          options.id + ".example.test",
        fitStatus:
          options.fit ?? "moderate",
        fitRationale:
          "Frozen SalesBench scenario truth.",
        evidenceIds: [evidenceId],
        hypotheses:
          options.hypothesis === undefined
            ? []
            : [
                {
                  id:
                    "hyp-" +
                    options.id,
                  statement:
                    options.hypothesis,
                  evidenceIds: [
                    evidenceId
                  ],
                  confidence: 0.65,
                  status: "open"
                }
              ],
        disqualifiers:
          options.disqualifiers ?? [],
        transformationSignals: []
      },
      buyer: {
        id:
          "buyer-" + options.id,
        prospectId:
          "prospect-" + options.id,
        role: "Executive",
        seniority: "c_suite",
        identityEvidenceIds: [
          evidenceId
        ],
        concerns:
          options.concerns ?? [],
        evidenceIds: [evidenceId]
      },
      opportunity: {
        id: "opp-" + options.id,
        prospectId:
          "prospect-" + options.id,
        buyerIds: [
          "buyer-" + options.id
        ],
        stage: "discovery",
        currentNeed:
          options.currentNeed ??
          "unknown",
        incumbentStatus:
          options.incumbent ??
          "unknown",
        concerns:
          options.concerns ?? [],
        proofRequests:
          options.proofRequests ??
          ["none"],
        evidenceIds: [evidenceId]
      },
      qualification: {
        opportunityId:
          "opp-" + options.id,
        problem: dimension("problem"),
        impact: dimension("impact"),
        urgency: dimension("urgency"),
        authority:
          dimension("authority"),
        decisionProcess:
          dimension(
            "decisionProcess"
          ),
        commercialSignal:
          dimension(
            "commercialSignal"
          ),
        proofRequired:
          dimension("proofRequired")
      },
      evidence: [
        {
          id: evidenceId,
          sourceKind:
            "buyer_statement",
          sourceRef:
            "salesbench:" +
            options.id,
          statement: options.turn,
          capturedAt:
            "2026-09-19T00:00:00.000Z",
          reliability: "direct",
          confidence: 1,
          tags: [
            options.category
          ]
        }
      ],
      latestBuyerTurn:
        options.turn
    });

  return SalesBenchScenarioSchema.parse({
    id: options.id,
    version: 1,
    category: options.category,
    input,
    expected: {
      objectives:
        options.expectedObjectives,
      nextActionKinds:
        options.expectedNext,
      questionRequired:
        options.questionRequired ??
        true,
      questionConcepts:
        options.questionConcepts ??
        [],
      ...(options
        .qualificationDimension ===
      undefined
        ? {}
        : {
            qualificationDimension:
              options
                .qualificationDimension
          })
    },
    hardRules:
      options.hardRules ??
      ALL_HARD_RULES
  });
}

export const SALESBENCH_SCENARIOS:
  readonly SalesBenchScenario[] = [
    scenario({
      id: "strong-fit-ops-friction",
      category: "strong_fit",
      turn:
        "Our onboarding workflow has too many manual handoffs.",
      fit: "strong",
      currentNeed: "yes",
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "impact"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "strong-fit-workforce-augmentation",
      category: "strong_fit",
      turn:
        "Our analysts spend hours every week summarizing repetitive reports.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["workforce"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "roles",
        "workflows",
        "employees"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "strong-fit-agent-pilot",
      category: "strong_fit",
      turn:
        "We want to explore AI agents for a repeatable operations queue.",
      fit: "strong",
      currentNeed: "yes",
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "problem"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "strong-fit-operating-model",
      category: "strong_fit",
      turn:
        "We have many AI pilots but no common operating model.",
      fit: "strong",
      currentNeed: "yes",
      hypothesis:
        "Fragmented AI ownership may be limiting scale.",
      expectedObjectives: [
        "diagnose_fit"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "problem"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "no-fit-student-project",
      category:
        "weak_or_no_fit",
      turn:
        "I am a student looking for free help with a class project.",
      fit: "no_fit",
      currentNeed: "no",
      disqualifiers: [
        "Not a commercial company opportunity."
      ],
      expectedObjectives: [
        "disqualify"
      ],
      expectedNext: ["defer"],
      questionRequired: false
    }),
    scenario({
      id: "no-fit-headcount-only",
      category:
        "weak_or_no_fit",
      turn:
        "We only want a vendor who guarantees we can replace half our staff.",
      fit: "no_fit",
      currentNeed: "yes",
      disqualifiers: [
        "Requested outcome is outside approved service claims."
      ],
      expectedObjectives: [
        "disqualify"
      ],
      expectedNext: ["defer"],
      questionRequired: false
    }),
    scenario({
      id: "weak-fit-vague-curiosity",
      category:
        "weak_or_no_fit",
      turn:
        "AI sounds interesting. We do not have a specific problem in mind.",
      fit: "weak",
      currentNeed: "unknown",
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "problem"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "no-fit-no-ai-interest",
      category:
        "weak_or_no_fit",
      turn:
        "We have decided not to use AI and do not want transformation support.",
      fit: "no_fit",
      currentNeed: "no",
      disqualifiers: [
        "Explicitly not pursuing the category."
      ],
      expectedObjectives: [
        "disqualify"
      ],
      expectedNext: ["defer"],
      questionRequired: false
    }),
    scenario({
      id: "incumbent-trusted-no-gap",
      category: "incumbent",
      turn:
        "We already work with a trusted transformation partner.",
      fit: "strong",
      currentNeed: "yes",
      incumbent: "trusted",
      concerns: ["incumbent"],
      expectedObjectives: [
        "understand_gap"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "gap",
        "friction",
        "capacity"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "incumbent-specific-gap",
      category: "incumbent",
      turn:
        "Our existing partner is good at strategy but not at agent implementation.",
      fit: "strong",
      currentNeed: "yes",
      incumbent: "trusted",
      concerns: ["incumbent"],
      expectedObjectives: [
        "understand_gap"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "gap",
        "friction",
        "capacity"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "incumbent-renewal",
      category: "incumbent",
      turn:
        "Our current consultancy contract renews next quarter.",
      fit: "moderate",
      currentNeed: "unknown",
      incumbent: "present",
      concerns: ["incumbent"],
      expectedObjectives: [
        "understand_gap"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "gap",
        "friction",
        "capacity"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "no-current-need",
      category:
        "no_current_need",
      turn:
        "There is nothing active right now.",
      fit: "strong",
      currentNeed: "no",
      expectedObjectives: [
        "preserve_relationship"
      ],
      expectedNext: ["defer"],
      questionConcepts: [
        "future",
        "trigger"
      ],
      qualificationDimension:
        "urgency"
    }),
    scenario({
      id: "future-trigger",
      category:
        "no_current_need",
      turn:
        "No project now, but our ERP replacement next year may change that.",
      fit: "strong",
      currentNeed: "no",
      expectedObjectives: [
        "preserve_relationship"
      ],
      expectedNext: ["defer"],
      questionConcepts: [
        "future",
        "trigger"
      ],
      qualificationDimension:
        "urgency"
    }),
    scenario({
      id: "no-need-send-info",
      category:
        "no_current_need",
      turn:
        "Nothing active currently. Send me some information for later.",
      fit: "strong",
      currentNeed: "no",
      expectedObjectives: [
        "preserve_relationship"
      ],
      expectedNext: ["defer"],
      questionConcepts: [
        "future",
        "trigger"
      ],
      qualificationDimension:
        "urgency"
    }),
    scenario({
      id: "skeptic-ai-hype",
      category:
        "executive_skepticism",
      turn:
        "Most AI transformation pitches sound like hype. Why should I care?",
      fit: "moderate",
      currentNeed: "unknown",
      concerns: ["trust"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence",
        "concern",
        "trust"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "skeptic-job-loss",
      category:
        "executive_skepticism",
      turn:
        "Is this really just a way to replace people?",
      fit: "moderate",
      currentNeed: "unknown",
      concerns: ["workforce"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "roles",
        "workflows",
        "employees"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "skeptic-prove-value",
      category:
        "executive_skepticism",
      turn:
        "Show me why this would create value before we spend time on it.",
      fit: "moderate",
      currentNeed: "unknown",
      proofRequests: ["roi"],
      concerns: ["proof"],
      expectedObjectives: [
        "clarify_proof"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "workforce-union",
      category: "workforce",
      turn:
        "Our workforce is unionized and people are worried AI will remove jobs.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["workforce"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "roles",
        "workflows",
        "employees"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "workforce-change-fatigue",
      category: "workforce",
      turn:
        "The team is exhausted from recent change programs.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["workforce"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "roles",
        "workflows",
        "employees"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "workforce-skills-gap",
      category: "workforce",
      turn:
        "Employees do not yet have the skills to use AI confidently.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["workforce"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "roles",
        "workflows",
        "employees"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "privacy-sensitive-data",
      category:
        "privacy_security_compliance",
      turn:
        "Our workflows contain sensitive customer data. How do you handle privacy?",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["privacy"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "privacy",
        "constraint"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "security-data-residency",
      category:
        "privacy_security_compliance",
      turn:
        "Data residency is a hard security requirement for us.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["security"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "security",
        "constraint"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "compliance-certification",
      category:
        "privacy_security_compliance",
      turn:
        "Are you certified for every compliance framework we need?",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["compliance"],
      proofRequests: ["security"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "compliance",
        "constraint"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "budget-unknown",
      category: "budget_timing",
      turn:
        "We have a real problem but have not discussed budget yet.",
      fit: "strong",
      currentNeed: "yes",
      known: [
        "problem",
        "impact",
        "urgency",
        "authority",
        "decisionProcess"
      ],
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "commercial",
        "constraints"
      ],
      qualificationDimension:
        "commercialSignal"
    }),
    scenario({
      id: "budget-too-early",
      category: "budget_timing",
      turn:
        "Do not ask me for a budget number yet.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["budget"],
      known: [
        "problem",
        "impact",
        "urgency",
        "authority",
        "decisionProcess"
      ],
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence",
        "trust"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "timing-next-year",
      category: "budget_timing",
      turn:
        "This is probably a next-year initiative.",
      fit: "strong",
      currentNeed: "unknown",
      concerns: ["timing"],
      known: [
        "problem",
        "impact"
      ],
      expectedObjectives: [
        "preserve_relationship"
      ],
      expectedNext: ["defer"],
      questionConcepts: [
        "future",
        "trigger"
      ],
      qualificationDimension:
        "urgency"
    }),
    scenario({
      id: "timing-urgent-unclear",
      category: "budget_timing",
      turn:
        "The CEO wants something with AI this quarter, but we have not defined the problem.",
      fit: "strong",
      currentNeed: "yes",
      concerns: ["timing"],
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "problem"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "authority-not-decision-maker",
      category:
        "authority_process",
      turn:
        "I can explore this, but I am not the final decision maker.",
      fit: "strong",
      currentNeed: "yes",
      known: [
        "problem",
        "impact",
        "urgency"
      ],
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "who",
        "involved"
      ],
      qualificationDimension:
        "authority"
    }),
    scenario({
      id: "authority-executive-sponsor",
      category:
        "authority_process",
      turn:
        "I am the COO and I would sponsor this if the case is strong.",
      fit: "strong",
      currentNeed: "yes",
      known: [
        "problem",
        "impact",
        "urgency",
        "authority"
      ],
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evaluate",
        "approve"
      ],
      qualificationDimension:
        "decisionProcess"
    }),
    scenario({
      id: "send-deck-generic",
      category: "send_materials",
      turn:
        "Just send me the deck.",
      fit: "moderate",
      currentNeed: "unknown",
      expectedObjectives: [
        "diagnose_fit"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "problem",
        "outcome"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "send-info-security",
      category: "send_materials",
      turn:
        "Send information, mainly about security and governance.",
      fit: "strong",
      currentNeed: "unknown",
      concerns: ["security"],
      expectedObjectives: [
        "clarify_constraint"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "security",
        "constraint"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "proof-case-study",
      category:
        "proof_and_guarantees",
      turn:
        "Show me a customer case study with quantified results.",
      fit: "strong",
      currentNeed: "yes",
      proofRequests: [
        "customer_proof"
      ],
      expectedObjectives: [
        "clarify_proof"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "proof-roi-guarantee",
      category:
        "proof_and_guarantees",
      turn:
        "Can you guarantee our ROI before we start?",
      fit: "strong",
      currentNeed: "yes",
      proofRequests: ["roi"],
      expectedObjectives: [
        "clarify_proof"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "guaranteed-savings",
      category:
        "proof_and_guarantees",
      turn:
        "How much money will you definitely save us?",
      fit: "strong",
      currentNeed: "yes",
      proofRequests: ["roi"],
      expectedObjectives: [
        "clarify_proof"
      ],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "evidence"
      ],
      qualificationDimension:
        "proofRequired"
    }),
    scenario({
      id: "conflicting-evidence",
      category:
        "discovery_uncertainty",
      turn:
        "Some teams want automation, but others say the current workflow works fine.",
      fit: "moderate",
      currentNeed: "unknown",
      hypothesis:
        "There may be uneven workflow pain across teams.",
      expectedObjectives: ["qualify"],
      expectedNext: ["ask_question"],
      questionConcepts: [
        "workflow",
        "problem"
      ],
      qualificationDimension:
        "problem"
    }),
    scenario({
      id: "qualified-ready",
      category:
        "qualification_next_step",
      turn:
        "We agree on the problem, impact, urgency, decision process, budget shape, and proof needed. What next?",
      fit: "strong",
      currentNeed: "yes",
      known: [
        "problem",
        "impact",
        "urgency",
        "authority",
        "decisionProcess",
        "commercialSignal",
        "proofRequired"
      ],
      expectedObjectives: [
        "propose_next_step"
      ],
      expectedNext: [
        "propose_meeting"
      ],
      questionRequired: false
    })
  ] as const;

export function salesBenchScenarioIds():
  string[] {
  return SALESBENCH_SCENARIOS.map(
    (scenario) => scenario.id
  );
}

export {
  SALESBENCH_VERSION
};
