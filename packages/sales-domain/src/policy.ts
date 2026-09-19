import {
  QUALIFICATION_DIMENSIONS,
  type Evidence,
  type Opportunity,
  type Prospect,
  type QualificationDimensionKey,
  type SalesDecision,
  type SalesSignal,
  type ServiceOffer
} from "./contracts.js";

export interface ConsultativePolicyInput {
  prospect: Prospect;
  opportunity: Opportunity;
  signals: readonly SalesSignal[];
  availableEvidence: readonly Evidence[];
  serviceOffer: ServiceOffer;
}

const QUESTIONS: Readonly<Record<QualificationDimensionKey, string>> = {
  transformationNeed:
    "What would need to change operationally for an AI-native transformation to be worth pursuing?",
  workflowPain:
    "Which workflow currently creates the most repeated manual effort or coordination friction?",
  businessImpact:
    "What business impact does that workflow create today when it stays slow or manual?",
  aiMaturity:
    "What AI or automation have you already tried, and where has it worked or broken down?",
  sponsor:
    "Who would need to care enough about this problem internally for a change to move forward?",
  decisionProcess:
    "How would a project like this normally get evaluated and approved?",
  timeline:
    "Is there a business event or timeframe that would make solving this more useful?",
  budgetSignal:
    "How do you usually think about funding work like this when the value case is credible?",
  securityCompliance:
    "What security, privacy, compliance, or workforce constraints would we need to design around?",
  nextStepReadiness:
    "What would you need to see or learn before a concrete next step would make sense?"
};

function firstUnknownQualification(
  opportunity: Opportunity
): QualificationDimensionKey | null {
  for (const dimension of QUALIFICATION_DIMENSIONS) {
    if (opportunity.qualification[dimension].status === "unknown") {
      return dimension;
    }
  }

  return null;
}

function ask(
  target: QualificationDimensionKey,
  objective: string,
  responseGuidance: string
): SalesDecision {
  return {
    objective,
    responseGuidance,
    question: QUESTIONS[target],
    questionTarget: target,
    claims: [],
    nextAction: {
      kind: "ask_question",
      rationale: `Learn the highest-value missing qualification dimension: ${target}.`,
      requiresApproval: false
    },
    confidence: 0.6
  };
}

function hasUsableEvidence(evidence: readonly Evidence[]): boolean {
  return evidence.some((item) =>
    item.kind === "observed_fact" || item.kind === "approved_claim"
  );
}

export function selectConsultativeBaseline(
  input: ConsultativePolicyInput
): SalesDecision {
  const signalSet = new Set(input.signals);

  if (
    input.prospect.fit === "disqualified" ||
    signalSet.has("not_fit")
  ) {
    return {
      objective: "Exit cleanly rather than manufacture an opportunity.",
      responseGuidance:
        "Be direct and respectful that there is no clear fit now. Do not create urgency or propose an external action.",
      question: null,
      questionTarget: null,
      claims: [],
      nextAction: {
        kind: "no_action",
        rationale: "The prospect is explicitly disqualified or not a fit.",
        requiresApproval: false
      },
      confidence: 0.9
    };
  }

  if (signalSet.has("no_current_need")) {
    return {
      objective:
        "Preserve trust and leave a low-pressure path for a future relevant trigger.",
      responseGuidance:
        "Acknowledge that there is no active need. Do not manufacture urgency or push a meeting.",
      question: null,
      questionTarget: null,
      claims: [],
      nextAction: {
        kind: "defer",
        rationale: "No active need is a valid outcome.",
        requiresApproval: false
      },
      confidence: 0.85
    };
  }

  if (signalSet.has("existing_supplier")) {
    return ask(
      "workflowPain",
      "Understand where the current approach becomes difficult without attacking the incumbent.",
      "Respect the existing partner. Explore only whether there are difficult, uncovered, or transformation-specific workflows worth understanding."
    );
  }

  if (signalSet.has("security_concern")) {
    return ask(
      "securityCompliance",
      "Understand the buyer's non-negotiable trust and governance constraints.",
      "Treat security and compliance as design inputs. Do not claim compliance or approval that has not been established."
    );
  }

  if (signalSet.has("workforce_concern")) {
    return ask(
      "workflowPain",
      "Understand the work and employee friction before discussing automation.",
      "Frame AI as workflow and workforce design, not automatic employee replacement."
    );
  }

  if (signalSet.has("ai_skepticism")) {
    return ask(
      "aiMaturity",
      "Understand the buyer's prior AI experience before defending AI.",
      "Diagnose what has failed or disappointed before proposing another AI initiative."
    );
  }

  if (signalSet.has("budget_question")) {
    return ask(
      "budgetSignal",
      "Understand commercial constraints without inventing pricing.",
      "Do not quote unapproved pricing or discounts. Learn how the buyer evaluates funding when value is credible."
    );
  }

  if (signalSet.has("timeline_question")) {
    return ask(
      "timeline",
      "Understand whether there is a real timing trigger.",
      "Do not manufacture urgency. Learn the business timing that would make change useful."
    );
  }

  if (signalSet.has("decision_process")) {
    return ask(
      "decisionProcess",
      "Understand how a transformation decision would actually be made.",
      "Map the evaluation and approval path without turning the conversation into an interrogation."
    );
  }

  if (
    (signalSet.has("send_info") || signalSet.has("proof_request")) &&
    hasUsableEvidence(input.availableEvidence)
  ) {
    return {
      objective: "Use the smallest relevant piece of verified evidence.",
      responseGuidance:
        "Share only evidence that is already approved or observed. Do not invent a customer result or quantified outcome.",
      question: null,
      questionTarget: null,
      claims: [],
      nextAction: {
        kind: "share_evidence",
        rationale: "The buyer asked for information and verified evidence exists.",
        requiresApproval: false
      },
      confidence: 0.8
    };
  }

  if (signalSet.has("ready_next_step")) {
    return {
      objective:
        "Convert earned intent into a controlled human next step.",
      responseGuidance:
        "Summarize the fit concisely and propose a human handoff. Do not claim the handoff happened until execution is confirmed.",
      question: null,
      questionTarget: null,
      claims: [],
      nextAction: {
        kind: "human_handoff",
        rationale: "The buyer has indicated readiness for a concrete next step.",
        requiresApproval: true
      },
      confidence: 0.8
    };
  }

  const missing = firstUnknownQualification(input.opportunity);
  if (missing) {
    return ask(
      missing,
      "Learn the single highest-value missing fact before prescribing a solution.",
      "Ask one useful question and update the opportunity before making a stronger recommendation."
    );
  }

  return {
    objective:
      "Convert a sufficiently understood opportunity into a controlled next step.",
    responseGuidance:
      "Summarize the understood need and propose a human handoff without claiming it has already happened.",
    question: null,
    questionTarget: null,
    claims: [],
    nextAction: {
      kind: "human_handoff",
      rationale: "Core qualification dimensions are already known.",
      requiresApproval: true
    },
    confidence: 0.75
  };
}
