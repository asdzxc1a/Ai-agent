import { describe, expect, it } from "vitest";

import {
  ASTRA_SERVICE_OFFER_V1,
  EvidenceSchema,
  NextActionSchema,
  PublicProofSchema,
  SalesDecisionSchema,
  ServiceOfferSchema,
  emptyQualificationState,
  validatePublicProofEvidence
} from "../src/index.js";

describe("sales-domain contracts", () => {
  it("validates the operator-approved service offer", () => {
    expect(ServiceOfferSchema.parse(ASTRA_SERVICE_OFFER_V1)).toEqual(
      ASTRA_SERVICE_OFFER_V1
    );

    expect(ASTRA_SERVICE_OFFER_V1.prohibitedClaims).toContain(
      "guaranteed revenue increase"
    );
    expect(ASTRA_SERVICE_OFFER_V1.unknowns).toContain(
      "default pricing and commercial packaging"
    );
  });

  it("keeps observed facts, hypotheses, approved claims, and unknowns structurally distinct", () => {
    expect(EvidenceSchema.parse({
      id: "evidence.company.about",
      kind: "observed_fact",
      statement: "The company describes a global support operation.",
      sourceUrl: "https://example.test/about",
      capturedAt: "2026-09-19T12:00:00.000Z"
    }).kind).toBe("observed_fact");

    expect(() => EvidenceSchema.parse({
      id: "evidence.bad-hypothesis",
      kind: "inferred_hypothesis",
      statement: "They probably need an AI agent.",
      supportingEvidenceIds: [],
      confidence: 0.7
    })).toThrow();
  });

  it("requires approval only for external next actions", () => {
    expect(NextActionSchema.parse({
      kind: "human_handoff",
      rationale: "Buyer asked for a human.",
      requiresApproval: true
    }).kind).toBe("human_handoff");

    expect(() => NextActionSchema.parse({
      kind: "human_handoff",
      rationale: "Buyer asked for a human.",
      requiresApproval: false
    })).toThrow();

    expect(() => NextActionSchema.parse({
      kind: "ask_question",
      rationale: "Learn more.",
      requiresApproval: true
    })).toThrow();
  });

  it("requires ask_question decisions to identify one qualification target", () => {
    expect(() => SalesDecisionSchema.parse({
      objective: "Learn more.",
      responseGuidance: "Ask one question.",
      question: null,
      questionTarget: null,
      claims: [],
      nextAction: {
        kind: "ask_question",
        rationale: "Missing fact.",
        requiresApproval: false
      },
      confidence: 0.5
    })).toThrow();
  });

  it("initializes every qualification dimension as unknown", () => {
    const state = emptyQualificationState();

    expect(Object.values(state).every(
      (dimension) =>
        dimension.status === "unknown" &&
        dimension.value === null &&
        dimension.evidenceIds.length === 0
    )).toBe(true);
  });

  it("requires every public-proof claim to carry evidence references", () => {
    expect(() => PublicProofSchema.parse({
      id: "proof-1",
      runId: "run-1",
      outcomeId: "outcome-1",
      createdAt: "2026-09-19T12:00:00.000Z",
      claims: [{
        statement: "Astra produced a qualified handoff.",
        evidenceIds: [],
        interpretation: false
      }],
      redactions: [],
      approvedForPublication: false
    })).toThrow();

    const proof = PublicProofSchema.parse({
      id: "proof-2",
      runId: "run-1",
      outcomeId: "outcome-1",
      createdAt: "2026-09-19T12:00:00.000Z",
      claims: [{
        statement: "Astra produced a qualified handoff.",
        evidenceIds: ["outcome-1"],
        interpretation: false
      }],
      redactions: [],
      approvedForPublication: false
    });

    expect(validatePublicProofEvidence({
      proof,
      evidenceIds: new Set(["other-evidence"])
    })).toEqual([
      "public proof references unknown evidence: outcome-1"
    ]);
  });
});
