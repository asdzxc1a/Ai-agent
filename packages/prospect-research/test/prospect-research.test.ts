import {
  describe,
  expect,
  it
} from "vitest";

import {
  InMemoryArtifactStore
} from "../../artifact-store/src/index.js";

import {
  ApprovedResearchTargetSchema,
  InMemoryProspectResearchRepository,
  ProspectResearchService,
  ProspectResearchValidationError,
  isApprovedResearchUrl,
  toSalesEvidence,
  validateProspectResearch,
  type ApprovedResearchTarget,
  type CompletedProspectResearchAttempt
} from "../src/index.js";

const timestamp =
  "2026-09-19T12:00:00Z";

function target():
  ApprovedResearchTarget {
  return ApprovedResearchTargetSchema.parse({
    id: "target.example",
    domain: "example.com",
    startUrl:
      "https://www.example.com/",
    approvedDomains: [
      "example.com"
    ],
    companyNameHint:
      "Example Systems",
    icpContext:
      "Industrial operations with manual coordination.",
    approval: {
      id: "approval.example",
      scope:
        "public_research_only",
      approvedBy:
        "operator",
      approvedAt: timestamp
    }
  });
}

function completedAttempt(
  artifactIds: {
    industry: string;
    workflow: string;
    hiring: string;
  }
): CompletedProspectResearchAttempt {
  return {
    id: "attempt.example",
    target: target(),
    createdAt: timestamp,
    status: "COMPLETED",
    report: {
      id: "report.example",
      runId: "run_example",
      targetId:
        "target.example",
      researchedAt:
        timestamp,
      prospect: {
        id:
          "prospect.example",
        domain:
          "example.com",
        companyName:
          "Example Systems",
        fit: "strong",
        disqualifiers: [],
        evidenceIds: [
          "e.industry",
          "e.hiring"
        ],
        hypothesisIds: [
          "h.workflow"
        ]
      },
      companySummary: [
        {
          id: "c.industry",
          kind:
            "observed_fact",
          statement:
            "Example Systems builds industrial automation software.",
          evidenceIds: [
            "e.industry"
          ]
        }
      ],
      transformationOpportunities: [
        {
          id: "h.workflow",
          kind:
            "inferred_hypothesis",
          statement:
            "Workflow orchestration may be a useful transformation opportunity.",
          evidenceIds: [
            "e.workflow"
          ],
          confidence: 0.72,
          uncertainty:
            "The public site describes manual coordination but does not quantify the operational impact."
        }
      ],
      buyingSignals: [
        {
          id: "c.hiring",
          kind:
            "observed_fact",
          statement:
            "The company is hiring an AI automation lead.",
          evidenceIds: [
            "e.hiring"
          ]
        }
      ],
      unknowns: [
        {
          id: "u.budget",
          field:
            "budgetSignal",
          reason:
            "No public budget signal was observed."
        }
      ],
      evidence: [
        {
          id:
            "e.industry",
          sourceUrl:
            "https://www.example.com/about",
          observation:
            "Example Systems builds industrial automation software.",
          capturedAt:
            timestamp,
          uncertainty:
            "none",
          uncertaintyNote:
            null,
          artifactIds: [
            artifactIds.industry
          ]
        },
        {
          id:
            "e.workflow",
          sourceUrl:
            "https://operations.example.com/workflows",
          observation:
            "Operations copy describes manual coordination between planning teams.",
          capturedAt:
            timestamp,
          uncertainty:
            "limited",
          uncertaintyNote:
            "The page does not quantify frequency or cost.",
          artifactIds: [
            artifactIds.workflow
          ]
        },
        {
          id:
            "e.hiring",
          sourceUrl:
            "https://www.example.com/careers",
          observation:
            "The company is hiring an AI automation lead.",
          capturedAt:
            timestamp,
          uncertainty:
            "none",
          uncertaintyNote:
            null,
          artifactIds: [
            artifactIds.hiring
          ]
        }
      ]
    }
  };
}

async function screenshot(
  artifacts:
    InMemoryArtifactStore,
  name: string
): Promise<string> {
  const record =
    await artifacts.putArtifact({
      runId: "run_example",
      kind: "SCREENSHOT",
      name,
      mediaType:
        "image/jpeg",
      data:
        new Uint8Array([
          0xff,
          0xd8,
          0xff,
          0xd9
        ])
    });

  return record.id;
}

async function diagnosticsArtifact(
  artifacts:
    InMemoryArtifactStore,
  name: string
): Promise<string> {
  const record =
    await artifacts.putJsonArtifact({
      runId: "run_example",
      kind: "DIAGNOSTICS",
      name,
      value: {
        safe: true
      }
    });

  return record.id;
}

describe(
  "approved live research boundary",
  () => {
    it("allows only the pre-approved company domain and its subdomains", () => {
      const approved =
        target();

      expect(
        isApprovedResearchUrl(
          approved,
          "https://example.com/"
        )
      ).toBe(true);
      expect(
        isApprovedResearchUrl(
          approved,
          "https://news.example.com/article"
        )
      ).toBe(true);
      expect(
        isApprovedResearchUrl(
          approved,
          "https://example.com.evil.test/"
        )
      ).toBe(false);
      expect(
        isApprovedResearchUrl(
          approved,
          "https://evil.test/example.com"
        )
      ).toBe(false);
      expect(
        isApprovedResearchUrl(
          approved,
          "file:///etc/passwd"
        )
      ).toBe(false);
      expect(
        isApprovedResearchUrl(
          approved,
          "https://example.com:8443/private"
        )
      ).toBe(false);
    });

    it("rejects an approved target whose start URL is outside the frozen domain set", () => {
      expect(() =>
        ApprovedResearchTargetSchema.parse({
          ...target(),
          startUrl:
            "https://unapproved.test/"
        })
      ).toThrow(
        "startUrl must be an HTTP(S) URL within approvedDomains"
      );
    });

    it("rejects nonstandard live-research ports even on an approved domain", () => {
      expect(() =>
        ApprovedResearchTargetSchema.parse({
          ...target(),
          startUrl:
            "https://example.com:8443/"
        })
      ).toThrow(
        "startUrl must be an HTTP(S) URL within approvedDomains"
      );
    });
  }
);

describe(
  "prospect research evidence",
  () => {
    it("keeps observed facts, hypotheses, unknowns, and source evidence separate", () => {
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });

      expect(
        validateProspectResearch(
          attempt.target,
          attempt.report
        )
      ).toEqual([]);

      const evidence =
        toSalesEvidence(
          attempt.report
        );

      expect(
        evidence.find(
          (item) =>
            item.id ===
            "e.industry"
        )?.kind
      ).toBe(
        "observed_fact"
      );
      expect(
        evidence.find(
          (item) =>
            item.id ===
            "h.workflow"
        )?.kind
      ).toBe(
        "inferred_hypothesis"
      );
      expect(
        evidence.find(
          (item) =>
            item.id ===
            "u.budget"
        )?.kind
      ).toBe("unknown");
    });

    it("rejects observed claims that do not exactly match referenced observed evidence", () => {
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });
      attempt.report
        .companySummary[0] = {
          id: "c.industry",
          kind:
            "observed_fact",
          statement:
            "Example Systems is the market leader.",
          evidenceIds: [
            "e.industry"
          ]
        };

      expect(
        validateProspectResearch(
          attempt.target,
          attempt.report
        )
      ).toContain(
        "observed fact must exactly match referenced observed evidence: c.industry"
      );
    });

    it("rejects evidence from outside the approved target domains", () => {
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });
      attempt.report
        .evidence[0]!.sourceUrl =
        "https://lookalike.test/about";

      expect(
        validateProspectResearch(
          attempt.target,
          attempt.report
        )
      ).toContain(
        "research evidence source is outside approved domains: e.industry"
      );
    });
  }
);

describe(
  "ProspectResearchService",
  () => {
    it("creates egress policy only from a stored approved target", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );

      await expect(
        service.networkPolicy(
          "target.example"
        )
      ).rejects.toThrow(
        "research target was not approved before network policy creation"
      );

      await service.approveTarget(
        target()
      );

      await expect(
        service.networkPolicy(
          "target.example"
        )
      ).resolves.toEqual({
        allowedDomains: [
          "example.com"
        ]
      });
    });

    it("requires referenced run artifacts, persists the prospect, and writes a redacted research evidence bundle", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );

      const attempt =
        completedAttempt({
          industry:
            await screenshot(
              artifacts,
              "industry.jpg"
            ),
          workflow:
            await screenshot(
              artifacts,
              "workflow.jpg"
            ),
          hiring:
            await screenshot(
              artifacts,
              "hiring.jpg"
            )
        });

      await service.approveTarget(
        attempt.target
      );

      await expect(
        service.recordCompleted(
          attempt
        )
      ).resolves.toEqual(
        attempt
      );

      expect(
        await repository
          .getProspect(
            "prospect.example"
          )
      ).toEqual(
        attempt.report.prospect
      );

      const records =
        await artifacts
          .listArtifacts(
            "run_example"
          );
      const bundle =
        records.find(
          (record) =>
            record.kind ===
            "RESEARCH_EVIDENCE"
        );

      expect(bundle).toBeDefined();
      expect(
        bundle?.metadata
      ).toMatchObject({
        attemptId:
          "attempt.example",
        prospectId:
          "prospect.example",
        targetId:
          "target.example"
      });
    });

    it("requires a screenshot artifact for every material observed evidence item", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );
      const diagnosticsOnly =
        await diagnosticsArtifact(
          artifacts,
          "page-diagnostics.json"
        );
      const attempt =
        completedAttempt({
          industry:
            diagnosticsOnly,
          workflow:
            diagnosticsOnly,
          hiring:
            diagnosticsOnly
        });

      await service.approveTarget(
        attempt.target
      );

      await expect(
        service.recordCompleted(
          attempt
        )
      ).rejects.toThrow(
        "research evidence requires a screenshot artifact"
      );
    });

    it("fails closed when a material evidence item references an artifact outside the run", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );
      const attempt =
        completedAttempt({
          industry:
            "missing.industry",
          workflow:
            "missing.workflow",
          hiring:
            "missing.hiring"
        });

      await service.approveTarget(
        attempt.target
      );

      await expect(
        service.recordCompleted(
          attempt
        )
      ).rejects.toBeInstanceOf(
        ProspectResearchValidationError
      );

      expect(
        await repository
          .getProspect(
            "prospect.example"
          )
      ).toBeUndefined();
    });

    it("rejects any completed attempt whose target approval was not stored first", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );
      const attempt =
        completedAttempt({
          industry:
            await screenshot(
              artifacts,
              "industry.jpg"
            ),
          workflow:
            await screenshot(
              artifacts,
              "workflow.jpg"
            ),
          hiring:
            await screenshot(
              artifacts,
              "hiring.jpg"
            )
        });

      await expect(
        service.recordCompleted(
          attempt
        )
      ).rejects.toThrow(
        "research target was not approved before the attempt"
      );
    });

    it("persists live-research failures with an explicit failure kind", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const service =
        new ProspectResearchService(
          repository,
          artifacts
        );

      const approved = target();
      await service.approveTarget(
        approved
      );

      const failure =
        await service.recordFailure({
          id:
            "attempt.failed",
          target: approved,
          createdAt: timestamp,
          status: "FAILED",
          runId:
            "run.failed",
          failure: {
            kind:
              "LIVE_RESEARCH_FAILURE",
            code:
              "ACCESS_BLOCKED",
            message:
              "The approved public site blocked automated access."
          }
        });

      expect(
        failure.failure.kind
      ).toBe(
        "LIVE_RESEARCH_FAILURE"
      );
      expect(
        await repository.getAttempt(
          "attempt.failed"
        )
      ).toEqual(failure);
    });
  }
);
