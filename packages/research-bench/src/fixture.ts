import type { ResearchBenchScenario } from "./types.js";

export function researchBenchPagePath(
  scenarioId: string,
  pageId: string
): string {
  return "/research-bench/" +
    encodeURIComponent(scenarioId) +
    "/" +
    encodeURIComponent(pageId);
}

export function researchBenchPageUrl(
  baseUrl: string,
  scenario: ResearchBenchScenario,
  pageId: string
): string {
  return new URL(
    researchBenchPagePath(
      scenario.id,
      pageId
    ),
    baseUrl
  ).toString();
}
