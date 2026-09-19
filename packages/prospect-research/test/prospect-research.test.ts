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
  ProspectResearchResultSchema,
  ProspectResearchService,
  ProspectResearchValidationError,
  isApprovedResearchUrl,
  toSalesEvidence,
  validateProspectResearch,
  validateProspectResearchResult,
  type ApprovedResearchTarget,
  type CompletedProspectResearchAttempt,
  type ProspectResearchResult
} from "../src/index.js";

const timestamp =
  "2026-09-19T12:00:00.000Z";
const runId =
  "run_example";

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
    id: runId,
    target: target(),
    createdAt: timestamp,
    status: "COMPLETED",
    report: {
      id: runId,
      runId,
      targetId:
        "target.example",
      researchedAt:
        timestamp,
      prospect: {
        id:
          "target.example",
        domain:
          "example.com",
        companyName:
          null,
        fit: "unknown",
        disqualifiers: [],
        evidenceIds: [
          "e.industry",
          "e.workflow",
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

function researchResult(
  artifactIds: {
    industry: string;
    workflow: string;
    hiring: string;
  }
): ProspectResearchResult {
  const attempt =
    completedAttempt(
      artifactIds
    );

  return {
    companyName: null,
    companySummary:
      attempt.report
        .companySummary,
    transformationOpportunities:
      attempt.report
        .transformationOpportunities,
    buyingSignals:
      attempt.report
        .buyingSignals,
    unknowns:
      attempt.report.unknowns,
    evidence:
      attempt.report.evidence
        .map(
          (evidence) => ({
            id: evidence.id,
            sourceUrl:
              evidence.sourceUrl,
            observation:
              evidence.observation,
            uncertainty:
              evidence.uncertainty,
            uncertaintyNote:
              evidence
                .uncertaintyNote,
            artifactIds: [
              ...evidence.artifactIds
            ]
          })
        )
  };
}

async function screenshot(
  artifacts:
    InMemoryArtifactStore,
  name: string,
  artifactRunId: string =
    runId
): Promise<string> {
  const record =
    await artifacts.putArtifact({
      runId:
        artifactRunId,
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
      runId,
      kind: "DIAGNOSTICS",
      name,
      value: {
        safe: true
      }
    });

  return record.id;
}

function service(
  repository:
    InMemoryProspectResearchRepository,
  artifacts:
    InMemoryArtifactStore
): ProspectResearchService {
  return new ProspectResearchService(
    repository,
    artifacts,
    () => new Date(timestamp)
  );
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

    it("rejects model-authored protected state and capture time", () => {
      const result =
        researchResult({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });

      expect(() =>
        ProspectResearchResultSchema
          .parse({
            ...result,
            runId:
              "forged.run",
            prospect: {
              fit: "strong"
            }
          })
      ).toThrow();

      expect(() =>
        ProspectResearchResultSchema
          .parse({
            ...result,
            evidence:
              result.evidence.map(
                (evidence, index) =>
                  index === 0
                    ? {
                        ...evidence,
                        capturedAt:
                          "2025-01-01T00:00:00.000Z"
                      }
                    : evidence
              )
          })
      ).toThrow();
    });

    it("requires prospect evidence and hypothesis references to exactly match durable research", () => {
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });

      attempt.report
        .prospect.evidenceIds = [
          "e.industry"
        ];

      expect(
        validateProspectResearch(
          attempt.target,
          attempt.report
        )
      ).toContain(
        "prospect evidenceIds must exactly match durable observed evidence"
      );
    });

    it("rejects graph id collisions across evidence, claims, and unknowns", () => {
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });

      attempt.report
        .unknowns[0] = {
          ...attempt.report
            .unknowns[0]!,
          id: "e.industry"
        };

      expect(
        validateProspectResearch(
          attempt.target,
          attempt.report
        )
      ).toContain(
        "research evidence, claim, and unknown ids must be globally unique"
      );
    });
  }
);

describe(
  "server-owned approval persistence",
  () => {
    it("rejects direct in-memory attempts before approval and after approval widening", async () => {
      const repository =
        new InMemoryProspectResearchRepository();
      const attempt =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });

      await expect(
        repository.saveAttempt(
          attempt
        )
      ).rejects.toThrow(
        "Research target was not approved before the attempt."
      );

      await repository.saveTarget(
        target()
      );

      const widened =
        completedAttempt({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });
      widened.target = {
        ...widened.target,
        approvedDomains: [
          "example.com",
          "evil.test"
        ]
      };

      await expect(
        repository.saveAttempt(
          widened
        )
      ).rejects.toThrow(
        "Research attempt target differs from the stored approval."
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
      const research =
        service(
          repository,
          artifacts
        );

      await expect(
        research.networkPolicy(
          "target.example"
        )
      ).rejects.toThrow(
        "research target was not approved before network policy creation"
      );

      await research.approveTarget(
        target()
      );

      await expect(
        research.networkPolicy(
          "target.example"
        )
      ).resolves.toEqual({
        allowedDomains: [
          "example.com"
        ]
      });
    });

    it("creates a semantic completion verifier only from stored approval", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );

      await expect(
        research.completionVerifier(
          "target.example"
        )
      ).rejects.toThrow(
        "research target was not approved before completion verifier creation"
      );

      await research.approveTarget(
        target()
      );
      const verifier =
        await research
          .completionVerifier(
            "target.example"
          );
      const result =
        researchResult({
          industry: "artifact.1",
          workflow: "artifact.2",
          hiring: "artifact.3"
        });
      const accepted =
        verifier.verify({
          request: {
            url:
              "https://www.example.com/",
            goal:
              "Research the approved company."
          },
          result,
          signal:
            new AbortController()
              .signal
        });

      expect(accepted).toEqual({
        verified: true,
        message:
          "Prospect research result passed semantic grounding validation."
      });

      result.companySummary[0] = {
        ...result
          .companySummary[0]!,
        statement:
          "Example Systems is the market leader."
      };

      const rejected =
        verifier.verify({
          request: {
            url:
              "https://www.example.com/",
            goal:
              "Research the approved company."
          },
          result,
          signal:
            new AbortController()
              .signal
        });

      expect(rejected).toEqual({
        verified: false,
        message:
          "Prospect research result failed semantic grounding validation."
      });
    });

    it("derives protected state, requires run screenshots, persists the prospect, and writes research evidence", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );
      const artifactIds = {
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
      };

      await research.approveTarget(
        target()
      );

      const attempt =
        await research.recordCompleted({
          targetId:
            "target.example",
          runId,
          result:
            researchResult(
              artifactIds
            )
        });

      expect(attempt).toEqual(
        completedAttempt(
          artifactIds
        )
      );

      expect(
        await repository
          .getProspect(
            "target.example"
          )
      ).toEqual(
        attempt.report.prospect
      );

      const records =
        await artifacts
          .listArtifacts(
            runId
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
          runId,
        prospectId:
          "target.example",
        targetId:
          "target.example"
      });
      expect(
        attempt.report.prospect
          .fit
      ).toBe("unknown");
      expect(
        attempt.report.prospect
          .disqualifiers
      ).toEqual([]);
      expect(
        attempt.report.evidence
          .every(
            (evidence) =>
              evidence.capturedAt ===
              timestamp
          )
      ).toBe(true);
    });

    it("requires a screenshot artifact for every material observed evidence item", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );
      const diagnosticsOnly =
        await diagnosticsArtifact(
          artifacts,
          "page-diagnostics.json"
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          result:
            researchResult({
              industry:
                diagnosticsOnly,
              workflow:
                diagnosticsOnly,
              hiring:
                diagnosticsOnly
            })
        })
      ).rejects.toThrow(
        "research evidence requires a screenshot artifact"
      );
    });

    it("fails closed when evidence references a real screenshot from another run", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );
      const foreign =
        await screenshot(
          artifacts,
          "foreign.jpg",
          "other_run"
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          result:
            researchResult({
              industry: foreign,
              workflow: foreign,
              hiring: foreign
            })
        })
      ).rejects.toBeInstanceOf(
        ProspectResearchValidationError
      );

      expect(
        await repository
          .getProspect(
            "target.example"
          )
      ).toBeUndefined();
    });

    it("rejects any completed result whose target approval was not stored first", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          result:
            researchResult({
              industry:
                "missing.industry",
              workflow:
                "missing.workflow",
              hiring:
                "missing.hiring"
            })
        })
      ).rejects.toThrow(
        "research target was not approved before the attempt"
      );
    });

    it("does not write a second evidence bundle for a duplicate attempt", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );
      const artifactIds = {
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
      };
      const input = {
        targetId:
          "target.example",
        runId,
        result:
          researchResult(
            artifactIds
          )
      };

      await research.approveTarget(
        target()
      );
      await research.recordCompleted(
        input
      );

      await expect(
        research.recordCompleted(
          input
        )
      ).rejects.toThrow(
        "research attempt already exists"
      );

      const evidenceBundles =
        (
          await artifacts
            .listArtifacts(
              runId
            )
        ).filter(
          (record) =>
            record.kind ===
            "RESEARCH_EVIDENCE"
        );

      expect(
        evidenceBundles
      ).toHaveLength(1);
    });

    it("persists live-research failures with server-owned approval, identity, and time", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts
        );

      await research.approveTarget(
        target()
      );

      const failure =
        await research.recordFailure({
          targetId:
            "target.example",
          runId:
            "run.failed",
          code:
            "ACCESS_BLOCKED",
          message:
            "The approved public site blocked automated access."
        });

      expect(
        failure
      ).toMatchObject({
        id: "run.failed",
        target: target(),
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
        await repository.getAttempt(
          "run.failed"
        )
      ).toEqual(failure);
    });
  }
);

it(
  "validates the model-facing result independently of durable protected state",
  () => {
    const result =
      researchResult({
        industry: "artifact.1",
        workflow: "artifact.2",
        hiring: "artifact.3"
      });

    expect(
      validateProspectResearchResult(
        target(),
        result
      )
    ).toEqual(result);
  }
);
