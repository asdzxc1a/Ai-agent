import {
  describe,
  expect,
  it
} from "vitest";

import {
  RESEARCH_BENCH_CATEGORIES,
  RESEARCH_BENCH_V1,
  evaluateResearchReport,
  researchBenchScenario,
  runResearchBench
} from "../src/index.js";

describe("Astra ResearchBench v1", () => {
  it("freezes 30 unique tasks with 20 core and 10 hard across every required category", () => {
    expect(
      RESEARCH_BENCH_V1
    ).toHaveLength(30);

    const ids =
      RESEARCH_BENCH_V1.map(
        (scenario) =>
          scenario.id
      );
    expect(
      new Set(ids).size
    ).toBe(ids.length);

    expect(
      RESEARCH_BENCH_V1.filter(
        (scenario) =>
          scenario.tier ===
          "core"
      )
    ).toHaveLength(20);
    expect(
      RESEARCH_BENCH_V1.filter(
        (scenario) =>
          scenario.tier ===
          "hard"
      )
    ).toHaveLength(10);

    for (
      const category of
      RESEARCH_BENCH_CATEGORIES
    ) {
      expect(
        RESEARCH_BENCH_V1.filter(
          (scenario) =>
            scenario.category ===
            category
        )
      ).toHaveLength(2);
    }
  });

  it("keeps every frozen task internally consistent", () => {
    for (
      const scenario of
      RESEARCH_BENCH_V1
    ) {
      const pages =
        new Map(
          scenario.pages.map(
            (page) =>
              [page.id, page] as const
          )
        );

      expect(
        pages.has(
          scenario.startPage
        )
      ).toBe(true);

      for (
        const page of
        scenario.pages
      ) {
        if (
          page.nextPage !==
          undefined
        ) {
          expect(
            pages.has(
              page.nextPage
            )
          ).toBe(true);
        }
      }

      const represented =
        new Set<string>();

      for (
        const expected of
        scenario.expected.facts
      ) {
        const page =
          pages.get(
            expected.sourcePage
          );

        expect(page).toBeDefined();
        expect(
          page?.facts.some(
            (fact) =>
              fact.field ===
                expected.field &&
              fact.value ===
                expected.value
          )
        ).toBe(true);
        expect(
          represented.has(
            expected.field
          )
        ).toBe(false);
        represented.add(
          expected.field
        );
      }

      for (
        const field of
        scenario.expected
          .unknownFields
      ) {
        expect(
          represented.has(field)
        ).toBe(false);
        represented.add(field);

        expect(
          scenario.pages.some(
            (page) =>
              page.unknownFields
                ?.includes(
                  field
                ) === true
          )
        ).toBe(true);
      }

      expect(
        [...represented].sort()
      ).toEqual(
        [
          ...scenario.requiredFields
        ].sort()
      );
    }
  });

  it("passes a fully grounded report with source attribution", () => {
    const scenario =
      researchBenchScenario(
        "source-attribution-two-facts"
      );

    const result =
      evaluateResearchReport(
        scenario,
        {
          scenarioId:
            scenario.id,
          status: "COMPLETED",
          companyName:
            scenario.companyName,
          findings: [
            {
              field:
                "headquarters",
              value:
                "brno-czechia",
              evidenceIds: [
                "e1"
              ]
            },
            {
              field:
                "chiefExecutive",
              value:
                "daniel-novak",
              evidenceIds: [
                "e2"
              ]
            }
          ],
          unknowns: [],
          evidence: [
            {
              id: "e1",
              sourceUrl:
                "http://fixture.test/research-bench/source-attribution-two-facts/about",
              statement:
                "headquarters=brno-czechia",
              field:
                "headquarters",
              value:
                "brno-czechia"
            },
            {
              id: "e2",
              sourceUrl:
                "http://fixture.test/research-bench/source-attribution-two-facts/leadership",
              statement:
                "chiefExecutive=daniel-novak",
              field:
                "chiefExecutive",
              value:
                "daniel-novak"
            }
          ]
        }
      );

    expect(result.passed).toBe(
      true
    );
    expect(
      result.falseCompleted
    ).toBe(false);
    expect(
      result
        .unsupportedClaimCount
    ).toBe(0);
  });

  it("marks fabricated evidence as false completion and an unsupported claim", () => {
    const scenario =
      researchBenchScenario(
        "about-company-industry"
      );

    const result =
      evaluateResearchReport(
        scenario,
        {
          scenarioId:
            scenario.id,
          status: "COMPLETED",
          companyName:
            scenario.companyName,
          findings: [
            {
              field: "industry",
              value:
                "space-mining",
              evidenceIds: [
                "fake"
              ]
            }
          ],
          unknowns: [],
          evidence: [
            {
              id: "fake",
              sourceUrl:
                "http://fixture.test/research-bench/about-company-industry/about",
              statement:
                "industry=space-mining",
              field: "industry",
              value:
                "space-mining"
            }
          ]
        }
      );

    expect(result.passed).toBe(
      false
    );
    expect(
      result.falseCompleted
    ).toBe(true);
    expect(
      result
        .unsupportedClaimCount
    ).toBe(1);
    expect(
      result.hardFailures
    ).toEqual(
      expect.arrayContaining([
        "fabricated_evidence:fake",
        "unsupported_finding:industry",
        "expected_fact_wrong:industry"
      ])
    );
  });

  it("never allows an expected unknown to be promoted as observed fact", () => {
    const scenario =
      researchBenchScenario(
        "missing-pricing"
      );

    const result =
      evaluateResearchReport(
        scenario,
        {
          scenarioId:
            scenario.id,
          status: "COMPLETED",
          companyName:
            scenario.companyName,
          findings: [
            {
              field: "pricing",
              value: "$99",
              evidenceIds: [
                "invented"
              ]
            }
          ],
          unknowns: [],
          evidence: [
            {
              id: "invented",
              sourceUrl:
                "http://fixture.test/research-bench/missing-pricing/pricing",
              statement:
                "pricing=$99",
              field: "pricing",
              value: "$99"
            }
          ]
        }
      );

    expect(result.passed).toBe(
      false
    );
    expect(
      result.falseCompleted
    ).toBe(true);
    expect(
      result.hardFailures
    ).toEqual(
      expect.arrayContaining([
        "unknown_promoted_as_fact:pricing",
        "expected_unknown_missing:pricing"
      ])
    );
  });

  it("does not expose fixture pages or expected answers to candidates", async () => {
    const seen:
      Array<Record<string, unknown>> =
        [];

    await runResearchBench(
      {
        id:
          "input-boundary-fixture",
        kind:
          "deterministic",
        policyVersion:
          "fixture-v1",
        modelId: null,
        run(task) {
          seen.push(
            task as unknown as
              Record<
                string,
                unknown
              >
          );

          return {
            scenarioId: task.id,
            status: "FAILED",
            companyName:
              task.companyName,
            findings: [],
            unknowns: [],
            evidence: []
          };
        }
      },
      RESEARCH_BENCH_V1.slice(
        0,
        1
      )
    );

    expect(
      seen[0]
    ).not.toHaveProperty(
      "expected"
    );
    expect(
      seen[0]
    ).not.toHaveProperty(
      "pages"
    );
  });
});
