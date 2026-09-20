import { z } from "zod";

import {
  BuyerSchema,
  EvidenceSchema,
  OpportunitySchema,
  ProspectSchema,
  QualificationStateSchema,
  SalesDecisionSchema,
  type SalesDecision
} from "./schemas.js";
import {
  ASTRA_SERVICE_OFFER_V1,
  ServiceOfferSchema,
  type ServiceOffer,
  unknownClaimIds
} from "./service-offer.js";

export const ConsultativePolicyInputSchema =
  z.object({
    serviceOffer:
      ServiceOfferSchema.default(
        ASTRA_SERVICE_OFFER_V1
      ),
    prospect: ProspectSchema,
    buyer: BuyerSchema.optional(),
    opportunity: OpportunitySchema,
    qualification:
      QualificationStateSchema,
    evidence: z
      .array(EvidenceSchema)
      .max(200),
    latestBuyerTurn: z
      .string()
      .trim()
      .max(8_000)
      .default("")
  })
  .strict();

export type ConsultativePolicyInput =
  z.infer<
    typeof ConsultativePolicyInputSchema
  >;

const EXTERNAL_ACTIONS = new Set([
  "send_approved_material",
  "propose_meeting",
  "handoff"
]);

function nextAction(
  kind:
    SalesDecision["nextAction"]["kind"],
  rationale: string
): SalesDecision["nextAction"] {
  return {
    kind,
    rationale,
    requiresAuthorization:
      EXTERNAL_ACTIONS.has(kind)
  };
}

function knownEvidenceIds(
  input: ConsultativePolicyInput
): string[] {
  return input.evidence.map(
    (item) => item.id
  );
}

function decision(
  input: ConsultativePolicyInput,
  value: Omit<
    SalesDecision,
    "evidenceIds" | "responseGuidance"
  > & {
    evidenceIds?: string[];
    responseGuidance?: string[];
  }
): SalesDecision {
  const parsed =
    SalesDecisionSchema.parse({
      ...value,
      evidenceIds:
        value.evidenceIds ??
        knownEvidenceIds(input),
      responseGuidance:
        value.responseGuidance ?? []
    });

  const unknown = unknownClaimIds(
    input.serviceOffer,
    parsed.approvedClaimIds
  );

  if (unknown.length > 0) {
    throw new Error(
      "Unapproved claim IDs: " +
        unknown.join(", ")
    );
  }

  return parsed;
}

function unknownDimension(
  input: ConsultativePolicyInput
):
  | readonly [
      NonNullable<
        SalesDecision[
          "qualificationDimension"
        ]
      >,
      string
    ]
  | undefined {
  const fields = [
    [
      "problem",
      "Which workflow or operating problem is most important to improve first?"
    ],
    [
      "impact",
      "What does that friction cost today in time, quality, revenue, or employee effort?"
    ],
    [
      "urgency",
      "What would make solving this important now rather than later?"
    ],
    [
      "authority",
      "Who besides you needs to be involved in deciding whether to pursue this?"
    ],
    [
      "decisionProcess",
      "How would your team normally evaluate and approve a transformation like this?"
    ],
    [
      "commercialSignal",
      "What commercial constraints should shape whether a first step is realistic?"
    ],
    [
      "proofRequired",
      "What evidence would you need before you would trust a first step?"
    ]
  ] as const;

  return fields.find(
    ([key]) =>
      input.qualification[key].status ===
      "unknown"
  );
}

export function baselineConsultativePolicy(
  rawInput: ConsultativePolicyInput
): SalesDecision {
  const input =
    ConsultativePolicyInputSchema.parse(
      rawInput
    );
  const turn =
    input.latestBuyerTurn.toLowerCase();

  if (
    input.prospect.fitStatus ===
      "no_fit" ||
    input.prospect.disqualifiers
      .length > 0
  ) {
    return decision(input, {
      objective: "disqualify",
      responseMode: "disqualify",
      approvedClaimIds: [],
      nextAction: nextAction(
        "defer",
        "False qualification is worse than a clean no-fit outcome."
      )
    });
  }

  if (
    input.opportunity.currentNeed ===
      "no" ||
    /nothing (right now|active|currently)|no (need|project|priority)|not (a priority|looking)/i.test(
      turn
    )
  ) {
    return decision(input, {
      objective:
        "preserve_relationship",
      responseMode: "defer",
      approvedClaimIds: [],
      question:
        "What future change or trigger would make this worth revisiting?",
      qualificationDimension:
        "urgency",
      nextAction: nextAction(
        "defer",
        "Do not manufacture urgency when there is no current need."
      )
    });
  }

  if (
    input.opportunity
      .incumbentStatus === "trusted" ||
    /already (have|use|work with)|existing (partner|supplier|consultant)/i.test(
      turn
    )
  ) {
    return decision(input, {
      objective: "understand_gap",
      responseMode:
        "clarify_and_question",
      approvedClaimIds: [],
      question:
        "Where does your current approach create the most friction, leave a gap, or need extra capacity?",
      qualificationDimension:
        "problem",
      nextAction: nextAction(
        "ask_question",
        "Understand complementarity before proposing displacement."
      )
    });
  }

  if (
    /guarantee|guaranteed|roi|return on investment|case stud|customer proof|customer result|how much (will|can) (we|you) save/i.test(
      turn
    ) ||
    input.opportunity.proofRequests.some(
      (request) =>
        request === "customer_proof" ||
        request === "roi"
    )
  ) {
    return decision(input, {
      objective: "clarify_proof",
      responseMode:
        "clarify_and_question",
      approvedClaimIds: [],
      question:
        "What evidence would be most useful for deciding whether a small first step is worth evaluating?",
      qualificationDimension:
        "proofRequired",
      nextAction: nextAction(
        "ask_question",
        "Clarify proof needs without inventing proof, ROI, or guarantees."
      )
    });
  }

  if (
    input.opportunity.concerns.some(
      (concern) =>
        concern === "security" ||
        concern === "privacy" ||
        concern === "compliance"
    ) ||
    /security|privacy|compliance|data residency|certif/i.test(
      turn
    )
  ) {
    return decision(input, {
      objective:
        "clarify_constraint",
      responseMode:
        "clarify_and_question",
      approvedClaimIds: [],
      question:
        "Which security, privacy, or compliance constraint would determine whether this could move forward?",
      qualificationDimension:
        "proofRequired",
      nextAction: nextAction(
        "ask_question",
        "Understand the constraint before making any unsupported assurance."
      )
    });
  }

  if (
    input.opportunity.concerns.includes(
      "workforce"
    ) ||
    /job|headcount|replace (people|employees)|workforce|union|change fatigue|skills gap/i.test(
      turn
    )
  ) {
    return decision(input, {
      objective:
        "clarify_constraint",
      responseMode:
        "clarify_and_question",
      approvedClaimIds: [
        "service.employee_augmentation"
      ],
      question:
        "Which roles or workflows would be most affected, and what would employees need to trust the change?",
      qualificationDimension:
        "problem",
      nextAction: nextAction(
        "ask_question",
        "Understand workforce impact before recommending automation."
      )
    });
  }

  if (
    /send (me|us)? ?(the )?(deck|info|information|details|materials)/i.test(
      turn
    )
  ) {
    return decision(input, {
      objective: "diagnose_fit",
      responseMode:
        "clarify_and_question",
      approvedClaimIds: [],
      question:
        "What problem or outcome should the material focus on so the follow-up is actually useful?",
      qualificationDimension:
        "problem",
      nextAction: nextAction(
        "ask_question",
        "Tailor any future material before proposing an external send action."
      )
    });
  }

  const missing =
    unknownDimension(input);

  if (missing !== undefined) {
    return decision(input, {
      objective: "qualify",
      responseMode:
        input.prospect.hypotheses
          .length > 0
          ? "hypothesis_and_question"
          : "clarify_and_question",
      ...(input.prospect.hypotheses[0] ===
      undefined
        ? {}
        : {
            hypothesis: {
              statement:
                input.prospect
                  .hypotheses[0]
                  .statement,
              evidenceIds:
                input.prospect
                  .hypotheses[0]
                  .evidenceIds
            }
          }),
      approvedClaimIds: [],
      question: missing[1],
      qualificationDimension:
        missing[0],
      nextAction: nextAction(
        "ask_question",
        "Advance one unknown qualification dimension at a time."
      )
    });
  }

  if (
    input.prospect.fitStatus ===
      "strong" &&
    input.opportunity.currentNeed ===
      "yes"
  ) {
    return decision(input, {
      objective:
        "propose_next_step",
      responseMode:
        "propose_next_step",
      approvedClaimIds: [
        "service.workflow_redesign",
        "service.employee_augmentation",
        "service.ai_workers",
        "service.operating_model"
      ],
      nextAction: nextAction(
        "propose_meeting",
        "A qualified strong-fit opportunity may earn an explicitly authorized next step."
      )
    });
  }

  return decision(input, {
    objective: "diagnose_fit",
    responseMode:
      "clarify_and_question",
    approvedClaimIds: [],
    question:
      "Which workflow creates the most friction or wasted effort today?",
    qualificationDimension:
      "problem",
    nextAction: nextAction(
      "ask_question",
      "Start with one concrete workflow before recommending a transformation."
    )
  });
}

export function canonicalizeSalesDecision(
  rawDecision: unknown,
  offer: ServiceOffer =
    ASTRA_SERVICE_OFFER_V1
): SalesDecision {
  const parsed =
    SalesDecisionSchema.parse(
      rawDecision
    );
  const unknown = unknownClaimIds(
    offer,
    parsed.approvedClaimIds
  );

  if (unknown.length > 0) {
    throw new Error(
      "Unapproved claim IDs: " +
        unknown.join(", ")
    );
  }

  return {
    ...parsed,
    nextAction: {
      ...parsed.nextAction,
      requiresAuthorization:
        EXTERNAL_ACTIONS.has(
          parsed.nextAction.kind
        )
    }
  };
}
