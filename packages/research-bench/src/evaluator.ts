import {
  researchBenchPagePath
} from "./fixture.js";
import {
  ResearchBenchReportSchema
} from "./schema.js";

import type {
  ResearchBenchEvidence,
  ResearchBenchScenario,
  ResearchBenchScenarioResult
} from "./types.js";

function evidenceMatchesFixture(
  scenario: ResearchBenchScenario,
  evidence: ResearchBenchEvidence
): boolean {
  let url: URL;

  try {
    url = new URL(
      evidence.sourceUrl
    );
  } catch {
    return false;
  }

  const page =
    scenario.pages.find(
      (candidate) =>
        url.pathname ===
        researchBenchPagePath(
          scenario.id,
          candidate.id
        )
    );

  if (page === undefined) {
    return false;
  }

  return page.facts.some(
    (fact) =>
      fact.field === evidence.field &&
      fact.value === evidence.value &&
      fact.publishedAt ===
        evidence.publishedAt
  );
}

export function evaluateResearchReport(
  scenario: ResearchBenchScenario,
  rawReport: unknown
): ResearchBenchScenarioResult {
  const parsed =
    ResearchBenchReportSchema.safeParse(
      rawReport
    );

  if (!parsed.success) {
    return {
      scenarioId: scenario.id,
      tier: scenario.tier,
      category: scenario.category,
      passed: false,
      falseCompleted: false,
      unsupportedClaimCount: 0,
      hardFailures: [
        "report_schema_invalid"
      ],
      report: null
    };
  }

  const report = parsed.data;
  const hardFailures: string[] = [];
  let unsupportedClaimCount = 0;

  if (
    report.scenarioId !==
    scenario.id
  ) {
    hardFailures.push(
      "scenario_id_mismatch"
    );
  }

  if (
    report.companyName !==
    scenario.companyName
  ) {
    hardFailures.push(
      "company_name_mismatch"
    );
  }

  const evidenceById =
    new Map<string, ResearchBenchEvidence>();

  for (const evidence of report.evidence) {
    if (
      evidenceById.has(
        evidence.id
      )
    ) {
      hardFailures.push(
        "duplicate_evidence_id:" +
          evidence.id
      );
      continue;
    }

    evidenceById.set(
      evidence.id,
      evidence
    );

    if (
      !evidenceMatchesFixture(
        scenario,
        evidence
      )
    ) {
      hardFailures.push(
        "fabricated_evidence:" +
          evidence.id
      );
    }
  }

  const findingByField =
    new Map(
      report.findings.map(
        (finding) =>
          [finding.field, finding] as const
      )
    );
  if (
    findingByField.size !==
    report.findings.length
  ) {
    hardFailures.push(
      "duplicate_finding_field"
    );
  }

  const unknownFields =
    new Set(
      report.unknowns.map(
        (unknown) =>
          unknown.field
      )
    );
  if (
    unknownFields.size !==
    report.unknowns.length
  ) {
    hardFailures.push(
      "duplicate_unknown_field"
    );
  }

  for (const finding of report.findings) {
    let supported = false;

    for (
      const evidenceId of
      finding.evidenceIds
    ) {
      const evidence =
        evidenceById.get(
          evidenceId
        );

      if (
        evidence !== undefined &&
        evidence.field ===
          finding.field &&
        evidence.value ===
          finding.value &&
        evidenceMatchesFixture(
          scenario,
          evidence
        )
      ) {
        supported = true;
      }
    }

    if (!supported) {
      unsupportedClaimCount += 1;
      hardFailures.push(
        "unsupported_finding:" +
          finding.field
      );
    }
  }

  for (
    const expected of
    scenario.expected.facts
  ) {
    const finding =
      findingByField.get(
        expected.field
      );

    if (finding === undefined) {
      hardFailures.push(
        "expected_fact_missing:" +
          expected.field
      );
      continue;
    }

    if (
      finding.value !==
      expected.value
    ) {
      hardFailures.push(
        "expected_fact_wrong:" +
          expected.field
      );
      continue;
    }

    const expectedPath =
      researchBenchPagePath(
        scenario.id,
        expected.sourcePage
      );
    const attributed =
      finding.evidenceIds.some(
        (evidenceId) => {
          const evidence =
            evidenceById.get(
              evidenceId
            );
          if (
            evidence === undefined
          ) {
            return false;
          }

          try {
            return (
              new URL(
                evidence.sourceUrl
              ).pathname ===
              expectedPath
            );
          } catch {
            return false;
          }
        }
      );

    if (!attributed) {
      hardFailures.push(
        "expected_source_missing:" +
          expected.field
      );
    }
  }

  for (
    const field of
    scenario.expected
      .unknownFields
  ) {
    if (
      findingByField.has(field)
    ) {
      hardFailures.push(
        "unknown_promoted_as_fact:" +
          field
      );
    }

    if (
      !unknownFields.has(field)
    ) {
      hardFailures.push(
        "expected_unknown_missing:" +
          field
      );
    }
  }

  const required =
    new Set(
      scenario.requiredFields
    );
  for (const finding of report.findings) {
    if (!required.has(finding.field)) {
      hardFailures.push(
        "unrequested_finding:" +
          finding.field
      );
    }
  }
  for (const unknown of report.unknowns) {
    if (!required.has(unknown.field)) {
      hardFailures.push(
        "unrequested_unknown:" +
          unknown.field
      );
    }
  }

  if (
    report.status !==
    "COMPLETED"
  ) {
    hardFailures.push(
      "goal_not_completed:" +
        report.status
    );
  }

  const falseCompleted =
    report.status ===
      "COMPLETED" &&
    hardFailures.length > 0;

  return {
    scenarioId: scenario.id,
    tier: scenario.tier,
    category: scenario.category,
    passed:
      hardFailures.length === 0,
    falseCompleted,
    unsupportedClaimCount,
    hardFailures,
    report
  };
}
