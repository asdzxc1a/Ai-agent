import {
  readFile
} from "node:fs/promises";

import {
  describe,
  expect,
  test
} from "vitest";

import {
  baselineConsultativePolicy
} from "@astra/sales-domain";

import {
  SALESBENCH_SCENARIOS,
  assertNoHardViolations,
  evaluateSalesDecision,
  runBaselineSalesBench,
  runPinnedModelSalesBench,
  scenarioFingerprint
} from "../src/index.js";

describe("SalesBench", () => {
  test("freezes thirty-six versioned scenarios across required sales categories", () => {
    expect(
      SALESBENCH_SCENARIOS
    ).toHaveLength(36);

    expect(
      new Set(
        SALESBENCH_SCENARIOS.map(
          (scenario) =>
            scenario.id
        )
      ).size
    ).toBe(36);

    const categories = new Set(
      SALESBENCH_SCENARIOS.map(
        (scenario) =>
          scenario.category
      )
    );

    expect(categories).toEqual(
      new Set([
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
      ])
    );
  });

  test("scenario fingerprint is frozen before Baseline 0", () => {
    expect(
      scenarioFingerprint()
    ).toBe(
      "58a809b67eb92e396b3feab365bcabbe528a410b52b028384f4849345e89a163"
    );
  });

  test("Baseline 0 is frozen honestly with zero hard violations", () => {
    const report =
      runBaselineSalesBench();

    expect(
      report.aggregate
        .hardGateFailed
    ).toBe(0);
    expect(
      report.aggregate
        .policyMatched
    ).toBe(31);
    expect(
      report.aggregate
        .policyMatchRate
    ).toBeCloseTo(
      31 / 36,
      12
    );
    expect(
      report.aggregate
        .meanOverallScore
    ).toBeCloseTo(
      0.9675925925925927,
      12
    );

    assertNoHardViolations(
      report.results
    );
  });

  test("committed Baseline 0 exactly matches the frozen deterministic runner", async () => {
    const committed = JSON.parse(
      await readFile(
        "benchmarks/salesbench/baseline-0.json",
        "utf8"
      )
    ) as unknown;

    expect(committed).toEqual(
      runBaselineSalesBench()
    );
  });

  test("hard evaluator catches unapproved claims and unauthorized external actions", () => {
    const scenario =
      SALESBENCH_SCENARIOS.find(
        (item) =>
          item.id ===
          "qualified-ready"
      );

    expect(scenario).toBeDefined();

    const result =
      evaluateSalesDecision(
        scenario!,
        {
          objective:
            "propose_next_step",
          responseMode:
            "propose_next_step",
          evidenceIds: [],
          approvedClaimIds: [
            "invented.guaranteed_roi"
          ],
          nextAction: {
            kind:
              "propose_meeting",
            rationale:
              "Book it immediately.",
            requiresAuthorization:
              false
          }
        }
      );

    expect(
      result.hardGatePassed
    ).toBe(false);
    expect(
      result.hardViolations
    ).toEqual(
      expect.arrayContaining([
        "unapproved_claim",
        "external_action_without_authorization"
      ])
    );
  });

  test("strict decision schema rejects model-authored protected state", () => {
    const scenario =
      SALESBENCH_SCENARIOS[0]!;

    const result =
      evaluateSalesDecision(
        scenario,
        {
          objective: "qualify",
          responseMode:
            "clarify_and_question",
          evidenceIds: [
            scenario.input
              .evidence[0]!.id
          ],
          approvedClaimIds: [],
          responseGuidance: [],
          question:
            "Which workflow matters most?",
          qualificationDimension:
            "problem",
          nextAction: {
            kind: "ask_question",
            rationale:
              "Continue discovery.",
            requiresAuthorization:
              false
          },
          buyerIdentity: {
            name: "Model-authored name"
          },
          executed: true,
          consent: true
        }
      );

    expect(
      result.hardGatePassed
    ).toBe(false);
    expect(
      result.hardViolations
    ).toContain(
      "invalid_sales_decision_schema"
    );
  });

  test("hard evaluator catches prohibited commercial claim text", () => {
    const scenario =
      SALESBENCH_SCENARIOS.find(
        (item) =>
          item.id ===
          "proof-roi-guarantee"
      );

    expect(scenario).toBeDefined();

    const result =
      evaluateSalesDecision(
        scenario!,
        {
          objective:
            "clarify_proof",
          responseMode:
            "clarify_and_question",
          evidenceIds: [],
          approvedClaimIds: [],
          responseGuidance: [
            "We guarantee 40% ROI for $5000."
          ],
          question:
            "Shall we proceed?",
          qualificationDimension:
            "proofRequired",
          nextAction: {
            kind: "ask_question",
            rationale:
              "Continue discovery.",
            requiresAuthorization:
              false
          }
        }
      );

    expect(
      result.hardViolations
    ).toContain(
      "prohibited_commercial_claim_text"
    );
  });

  test("pinned model lane rejects moving model aliases", async () => {
    await expect(
      runPinnedModelSalesBench(
        {
          async decide(input) {
            return baselineConsultativePolicy(
              input
            );
          }
        },
        {
          provider: "example",
          model: "latest",
          revision: "latest",
          policyVersion:
            "test-policy"
        },
        [
          SALESBENCH_SCENARIOS[0]!
        ]
      )
    ).rejects.toThrow(
      /exact model and revision/
    );
  });

  test("pinned model lane evaluates the same frozen scenario contract", async () => {
    const scenario =
      SALESBENCH_SCENARIOS[0]!;

    const report =
      await runPinnedModelSalesBench(
        {
          async decide(input) {
            return baselineConsultativePolicy(
              input
            );
          }
        },
        {
          provider: "example",
          model:
            "example-model-2026-09-19",
          revision:
            "rev-2026-09-19-a",
          policyVersion:
            "baseline-consultative-v1"
        },
        [scenario]
      );

    expect(report.lane).toBe(
      "pinned_model"
    );
    expect(report.results).toHaveLength(
      1
    );
    expect(
      report.scenarioFingerprint
    ).toBe(
      scenarioFingerprint([
        scenario
      ])
    );
  });
});
