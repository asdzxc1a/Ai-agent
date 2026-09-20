import {
  describe,
  expect,
  test
} from "vitest";

import {
  ASTRA_SERVICE_OFFER_V1,
  ConsultativePolicyInputSchema,
  EvidenceSchema,
  ProspectSchema,
  OutcomeSchema,
  PublicProofSchema,
  SalesDecisionSchema,
  ServiceOfferSchema,
  TRANSFORMATION_ONTOLOGY_V1,
  baselineConsultativePolicy,
  canonicalizeSalesDecision,
  unknownClaimIds
} from "../src/index.js";

const evidence = {
  id: "ev-1",
  sourceKind: "public_web",
  sourceRef: "https://example.test",
  statement:
    "The company describes a manual onboarding workflow.",
  capturedAt:
    "2026-09-19T00:00:00.000Z",
  reliability: "direct",
  confidence: 1,
  tags: ["workflow"]
} as const;

function policyInput() {
  return ConsultativePolicyInputSchema.parse({
    prospect: {
      id: "prospect-1",
      companyName: "Example Co",
      domain: "example.test",
      fitStatus: "strong",
      fitRationale:
        "Evidence shows workflow friction.",
      evidenceIds: ["ev-1"],
      hypotheses: [],
      disqualifiers: [],
      transformationSignals: []
    },
    buyer: {
      id: "buyer-1",
      prospectId: "prospect-1",
      role: "COO",
      seniority: "c_suite",
      identityEvidenceIds: ["ev-1"],
      concerns: [],
      evidenceIds: ["ev-1"]
    },
    opportunity: {
      id: "opp-1",
      prospectId: "prospect-1",
      buyerIds: ["buyer-1"],
      stage: "discovery",
      currentNeed: "yes",
      incumbentStatus: "none",
      concerns: [],
      proofRequests: ["none"],
      evidenceIds: ["ev-1"]
    },
    qualification: {
      opportunityId: "opp-1",
      problem: {
        status: "unknown",
        evidenceIds: []
      },
      impact: {
        status: "unknown",
        evidenceIds: []
      },
      urgency: {
        status: "unknown",
        evidenceIds: []
      },
      authority: {
        status: "known",
        summary: "COO is involved.",
        evidenceIds: ["ev-1"]
      },
      decisionProcess: {
        status: "unknown",
        evidenceIds: []
      },
      commercialSignal: {
        status: "unknown",
        evidenceIds: []
      },
      proofRequired: {
        status: "unknown",
        evidenceIds: []
      }
    },
    evidence: [evidence],
    latestBuyerTurn:
      "We are exploring how AI could help."
  });
}

describe("sales domain", () => {
  test("service offer contains approved claims and explicit boundaries", () => {
    const offer = ServiceOfferSchema.parse(
      ASTRA_SERVICE_OFFER_V1
    );

    expect(
      offer.approvedClaims.map(
        (claim) => claim.id
      )
    ).toEqual([
      "service.workflow_redesign",
      "service.employee_augmentation",
      "service.ai_workers",
      "service.operating_model"
    ]);

    expect(
      offer.nonClaims.some(
        (item) =>
          item.id ===
          "nonclaim.pricing"
      )
    ).toBe(true);
    expect(
      offer.explicitUnknowns.some(
        (item) =>
          item.id ===
          "unknown.customer_proof"
      )
    ).toBe(true);

    const approvedText =
      offer.approvedClaims
        .map((claim) => claim.text)
        .join(" ");

    expect(approvedText).not.toMatch(
      /(?:\$|€|£)\s*\d+/
    );
    expect(approvedText).not.toMatch(
      /guarantee|guaranteed/i
    );
    expect(approvedText).not.toMatch(
      /customer (?:case study|result|testimonial)/i
    );
  });

  test("public schemas validate provider-neutral structured truth", () => {
    expect(() =>
      EvidenceSchema.parse(evidence)
    ).not.toThrow();

    expect(() =>
      ProspectSchema.parse(
        policyInput().prospect
      )
    ).not.toThrow();

    expect(() =>
      SalesDecisionSchema.parse(
        baselineConsultativePolicy(
          policyInput()
        )
      )
    ).not.toThrow();

    expect(() =>
      OutcomeSchema.parse({
        id: "outcome-1",
        opportunityId: "opp-1",
        kind: "learned",
        effect: "none",
        evidenceIds: ["ev-1"],
        recordedAt:
          "2026-09-19T00:00:00.000Z"
      })
    ).not.toThrow();

    expect(() =>
      PublicProofSchema.parse({
        id: "proof-1",
        status: "draft",
        sourceRunIds: ["run-1"],
        claims: [
          {
            statement:
              "The run completed one approved task.",
            kind: "observed_result",
            evidenceIds: ["ev-1"]
          }
        ],
        piiSanitized: true
      })
    ).not.toThrow();

    expect(() =>
      PublicProofSchema.parse({
        id: "proof-published",
        status: "published",
        sourceRunIds: ["run-1"],
        claims: [
          {
            statement:
              "The run completed one approved task.",
            kind: "observed_result",
            evidenceIds: ["ev-1"]
          }
        ],
        piiSanitized: true
      })
    ).toThrow(/authorization/);
  });

  test("unknown claims are rejected and external authorization is server-derived", () => {
    expect(
      unknownClaimIds(
        ASTRA_SERVICE_OFFER_V1,
        [
          "service.workflow_redesign",
          "invented.roi_guarantee"
        ]
      )
    ).toEqual([
      "invented.roi_guarantee"
    ]);

    expect(() =>
      canonicalizeSalesDecision({
        objective: "propose_next_step",
        responseMode:
          "propose_next_step",
        evidenceIds: [],
        approvedClaimIds: [
          "invented.roi_guarantee"
        ],
        nextAction: {
          kind: "propose_meeting",
          rationale: "Advance.",
          requiresAuthorization: false
        }
      })
    ).toThrow(/Unapproved claim IDs/);

    const canonical =
      canonicalizeSalesDecision({
        objective: "propose_next_step",
        responseMode:
          "propose_next_step",
        evidenceIds: [],
        approvedClaimIds: [],
        nextAction: {
          kind: "propose_meeting",
          rationale: "Advance.",
          requiresAuthorization: false
        }
      });

    expect(
      canonical.nextAction
        .requiresAuthorization
    ).toBe(true);
  });

  test("baseline policy asks one useful question and never invents proof", () => {
    const input = policyInput();
    const decision =
      baselineConsultativePolicy({
        ...input,
        latestBuyerTurn:
          "Can you guarantee ROI and show customer case studies?"
      });

    expect(decision.objective).toBe(
      "clarify_proof"
    );
    expect(decision.question).toMatch(
      /evidence/i
    );
    expect(
      decision.approvedClaimIds
    ).toEqual([]);
    expect(
      decision.nextAction.kind
    ).toBe("ask_question");
  });

  test("transformation ontology covers company, workforce, agents, governance, and foundations", () => {
    expect(
      TRANSFORMATION_ONTOLOGY_V1
    ).toHaveLength(10);

    const ids = new Set(
      TRANSFORMATION_ONTOLOGY_V1.map(
        (area) => area.id
      )
    );

    expect(ids).toContain(
      "workflow_redesign"
    );
    expect(ids).toContain(
      "employee_augmentation"
    );
    expect(ids).toContain(
      "agentic_automation"
    );
    expect(ids).toContain(
      "ai_governance_operating_model"
    );
    expect(ids).toContain(
      "data_knowledge_foundation"
    );
  });
});
