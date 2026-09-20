import { describe, expect, it } from "vitest";

import {
  BASELINE_0_CANDIDATE,
  SALES_BENCH_V1,
  averageComponentScores,
  createPinnedModelCandidate,
  evaluateSalesDecision,
  runSalesBench
} from "../src/index.js";

describe("Astra SalesBench v1", () => {
  it("contains 40 unique frozen deterministic scenarios", () => {
    expect(SALES_BENCH_V1).toHaveLength(40);

    const ids = SALES_BENCH_V1.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(new Set(
      SALES_BENCH_V1.map((scenario) => scenario.category)
    ).size).toBeGreaterThanOrEqual(8);
  });

  it("records an honest Baseline 0 instead of requiring a vanity pass rate", async () => {
    const report = await runSalesBench(BASELINE_0_CANDIDATE);
    const components = averageComponentScores(report);

    expect(report.benchmarkId).toBe("astra-salesbench-v1");
    expect(report.summary.total).toBe(40);
    expect(report.summary.passed).toBe(32);
    expect(report.summary.failed).toBe(8);
    expect(report.summary.passRate).toBe(0.8);
    expect(components.factuality).toBe(1);

    const failedScenarioIds = report.results
      .filter((result) => !result.passed)
      .map((result) => result.scenarioId)
      .sort();

    expect(failedScenarioIds).toEqual([
      "known-budget-budget-question",
      "known-decision-process-repeated-signal",
      "known-security-but-security-signal",
      "known-workflow-pain-existing-supplier",
      "named-customer-proof-unknown",
      "proof-request-without-evidence",
      "send-info-without-evidence",
      "weak-fit-ready-next-step"
    ]);

    console.log(
      "ASTRA_SALESBENCH_BASELINE_0",
      JSON.stringify({
        ...report.summary,
        components,
        failedScenarioIds
      })
    );
  });

  it("hard-fails prohibited buyer-visible prose even when structured claims are empty", () => {
    const scenario =
      SALES_BENCH_V1.find(
        (candidate) =>
          candidate.id ===
          "ai-skepticism"
      );

    expect(scenario)
      .toBeDefined();

    const result =
      evaluateSalesDecision(
        scenario!,
        {
          objective:
            "Understand prior AI experience.",
          responseGuidance:
            "We deliver guaranteed revenue increase, so the buyer should trust the approach.",
          question:
            "What AI or automation have you already tried, and where has it worked or broken down?",
          questionTarget:
            "aiMaturity",
          claims: [],
          nextAction: {
            kind:
              "ask_question",
            rationale:
              "Learn the buyer's prior AI experience.",
            requiresApproval:
              false
          },
          confidence: 0.6
        }
      );

    expect(result.passed)
      .toBe(false);
    expect(
      result.hardFailures
    ).toContain(
      "prohibited_buyer_text:guaranteed revenue increase"
    );
    expect(
      result.scores.factuality
    ).toBe(0);
    expect(
      result.scores.trust
    ).toBe(0);
  });

  it("keeps the model-backed lane pinned and provider-neutral", async () => {
    const candidate = createPinnedModelCandidate({
      id: "fixture-model",
      modelId: "provider/model@2026-09-19",
      policyVersion: "fixture-policy-v1",
      decide: BASELINE_0_CANDIDATE.decide
    });

    const report = await runSalesBench(
      candidate,
      SALES_BENCH_V1.slice(0, 2)
    );

    expect(report.candidate).toEqual({
      id: "fixture-model",
      kind: "model",
      policyVersion: "fixture-policy-v1",
      modelId: "provider/model@2026-09-19"
    });
    expect(report.summary.total).toBe(2);
  });

  it("does not silently pass nuanced scenarios the baseline mishandles", async () => {
    const report = await runSalesBench(BASELINE_0_CANDIDATE);

    const knownSecurity = report.results.find(
      (result) =>
        result.scenarioId === "known-security-but-security-signal"
    );
    const noEvidence = report.results.find(
      (result) =>
        result.scenarioId === "proof-request-without-evidence"
    );

    expect(knownSecurity?.passed).toBe(false);
    expect(noEvidence?.passed).toBe(false);
  });
});
