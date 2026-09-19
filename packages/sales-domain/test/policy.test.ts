import { describe, expect, it } from "vitest";

import {
  ASTRA_SERVICE_OFFER_V1,
  emptyQualificationState,
  selectConsultativeBaseline,
  type Opportunity,
  type Prospect
} from "../src/index.js";

function prospect(fit: Prospect["fit"] = "strong"): Prospect {
  return {
    id: "prospect-1",
    domain: "example.test",
    companyName: "Example",
    fit,
    disqualifiers: [],
    evidenceIds: [],
    hypothesisIds: []
  };
}

function opportunity(): Opportunity {
  return {
    id: "opportunity-1",
    prospectId: "prospect-1",
    buyerIds: [],
    stage: "discovery",
    qualification: emptyQualificationState(),
    activeSignals: [],
    evidenceIds: [],
    nextAction: null
  };
}

describe("consultative baseline policy", () => {
  it("treats no current need as a valid defer outcome", () => {
    const state = opportunity();
    state.activeSignals = ["no_current_need"];

    const decision = selectConsultativeBaseline({
      prospect: prospect(),
      opportunity: state,
      availableEvidence: [],
      serviceOffer: ASTRA_SERVICE_OFFER_V1
    });

    expect(decision.nextAction.kind).toBe("defer");
    expect(decision.question).toBeNull();
  });

  it("does not attack an existing supplier and asks about workflow pain", () => {
    const state = opportunity();
    state.activeSignals = ["existing_supplier"];

    const decision = selectConsultativeBaseline({
      prospect: prospect(),
      opportunity: state,
      availableEvidence: [],
      serviceOffer: ASTRA_SERVICE_OFFER_V1
    });

    expect(decision.nextAction.kind).toBe("ask_question");
    expect(decision.questionTarget).toBe("workflowPain");
    expect(decision.responseGuidance.toLowerCase()).toContain(
      "respect the existing partner"
    );
  });

  it("does not invent pricing when the buyer asks about budget", () => {
    const state = opportunity();
    state.activeSignals = ["budget_question"];

    const decision = selectConsultativeBaseline({
      prospect: prospect(),
      opportunity: state,
      availableEvidence: [],
      serviceOffer: ASTRA_SERVICE_OFFER_V1
    });

    expect(decision.questionTarget).toBe("budgetSignal");
    expect(decision.responseGuidance.toLowerCase()).toContain(
      "do not quote unapproved pricing"
    );
  });

  it("requires approval for an earned human handoff", () => {
    const state = opportunity();
    for (const dimension of Object.values(state.qualification)) {
      dimension.status = "known";
      dimension.value = "known";
    }

    const decision = selectConsultativeBaseline({
      prospect: prospect(),
      opportunity: state,
      availableEvidence: [],
      serviceOffer: ASTRA_SERVICE_OFFER_V1
    });

    expect(decision.nextAction).toEqual({
      kind: "human_handoff",
      rationale: "Core qualification dimensions are already known.",
      requiresApproval: true
    });
  });
});
