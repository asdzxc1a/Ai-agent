import { describe, expect, it } from "vitest";

import {
  BASELINE_0_CANDIDATE,
  SALES_BENCH_V1,
  averageComponentScores,
  createPinnedModelCandidate,
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
    expect(report.summary.passed).toBeGreaterThan(20);
    expect(report.summary.failed).toBeGreaterThan(0);
    expect(report.summary.passRate).toBeLessThan(1);
    expect(components.factuality).toBe(1);

    console.log(
      "ASTRA_SALESBENCH_BASELINE_0",
      JSON.stringify({
        ...report.summary,
        components
      })
    );
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
