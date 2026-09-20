import { createHash } from "node:crypto";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  InMemoryArtifactStore
} from "../../artifact-store/src/index.js";
import type {
  RunSnapshot
} from "../../contracts/src/index.js";

import {
  ApprovedResearchTargetSchema,
  InMemoryProspectResearchRepository,
  ProspectResearchResultSchema,
  ProspectResearchService,
  ProspectResearchValidationError,
  isApprovedResearchUrl,
  toSalesEvidence,
  validateHumanBaselineBrief,
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

const pageContentSha256 =
  "a".repeat(64);

function sourceUrlFor(
  kind:
    | "industry"
    | "workflow"
    | "hiring"
): string {
  switch (kind) {
    case "industry":
      return "https://www.example.com/about";
    case "workflow":
      return "https://operations.example.com/workflows";
    case "hiring":
      return "https://www.example.com/careers";
  }
}

function captureReceipt(
  artifactId: string,
  pageUrl: string
) {
  return {
    artifactId,
    captureVersion:
      "page-evidence-v1" as const,
    semanticSettled:
      true as const,
    pageUrl,
    capturedAt:
      timestamp,
    pageContentSha256,
    screenshotSha256:
      "b".repeat(64)
  };
}

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
    startedAt: timestamp,
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
          ],
          captureReceipts: [
            captureReceipt(
              artifactIds.industry,
              sourceUrlFor(
                "industry"
              )
            )
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
          ],
          captureReceipts: [
            captureReceipt(
              artifactIds.workflow,
              sourceUrlFor(
                "workflow"
              )
            )
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
          ],
          captureReceipts: [
            captureReceipt(
              artifactIds.hiring,
              sourceUrlFor(
                "hiring"
              )
            )
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
                .uncertaintyNote
          })
        )
  };
}

function artifactMapping(
  artifactIds: {
    industry: string;
    workflow: string;
    hiring: string;
  }
): Record<
  string,
  readonly string[]
> {
  return {
    "e.industry": [
      artifactIds.industry
    ],
    "e.workflow": [
      artifactIds.workflow
    ],
    "e.hiring": [
      artifactIds.hiring
    ]
  };
}

async function screenshot(
  artifacts:
    InMemoryArtifactStore,
  name: string,
  artifactRunId: string =
    runId,
  semanticSettled = true
): Promise<string> {
  const data =
    new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  const pageUrl =
    name.includes(
      "workflow"
    )
      ? sourceUrlFor(
          "workflow"
        )
      : name.includes(
          "hiring"
        )
        ? sourceUrlFor(
            "hiring"
          )
        : sourceUrlFor(
            "industry"
          );
  const record =
    await artifacts.putArtifact({
      runId:
        artifactRunId,
      kind: "SCREENSHOT",
      name,
      mediaType:
        "image/jpeg",
      data,
      metadata: {
        captureVersion:
          "page-evidence-v1",
        semanticSettled,
        pageUrl,
        pageTitle:
          "Example Systems",
        pageContentSha256,
        pageContentBytes:
          42,
        screenshotSha256:
          createHash(
            "sha256"
          )
            .update(data)
            .digest("hex")
      }
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

function completedRun(
  result: unknown,
  id: string =
    runId
): RunSnapshot {
  return {
    id,
    status: "COMPLETED",
    goalStatus:
      "COMPLETED",
    createdAt:
      "2026-09-19T11:59:00.000Z",
    updatedAt:
      timestamp,
    result,
    terminalReason: {
      code:
        "GOAL_COMPLETED",
      message:
        "Completion verifier accepted the run result."
    }
  };
}

function failedRun(
  id: string,
  code:
    | "EXECUTION_FAILED"
    | "RUN_TIMEOUT"
    | "CLEANUP_FAILED"
    | "RUN_CANCELLED",
  message: string
): RunSnapshot {
  return {
    id,
    status:
      code === "RUN_CANCELLED"
        ? "CANCELLED"
        : "FAILED",
    goalStatus: "FAILED",
    createdAt:
      "2026-09-19T11:59:00.000Z",
    updatedAt:
      timestamp,
    ...(code ===
      "RUN_CANCELLED"
      ? {}
      : {
          error: {
            code,
            message
          }
        }),
    terminalReason: {
      code,
      message
    }
  };
}

function service(
  repository:
    InMemoryProspectResearchRepository,
  artifacts:
    InMemoryArtifactStore,
  run?: RunSnapshot
): ProspectResearchService {
  return new ProspectResearchService(
    repository,
    artifacts,
    {
      async getRun(id) {
        return (
          run !== undefined &&
          run.id === id
        )
          ? structuredClone(
              run
            )
          : undefined;
      }
    }
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

    it.each([
      ["127.0.0.1", "http://127.0.0.1/"],
      ["::1", "http://[::1]/"],
      ["service.local", "https://service.local/"],
      ["metadata.internal", "https://metadata.internal/"],
      ["host.localhost", "http://host.localhost/"]
    ])(
      "rejects non-public approved domain %s before network policy creation",
      (domain, startUrl) => {
        expect(() =>
          ApprovedResearchTargetSchema.parse({
            ...target(),
            domain,
            startUrl,
            approvedDomains: [
              domain
            ]
          })
        ).toThrow(
          "research domain must be a public DNS-style domain name"
        );
      }
    );

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
        )
      ).toMatchObject({
        kind:
          "observed_fact",
        uncertainty:
          "none",
        uncertaintyNote:
          null,
        artifactIds: [
          "artifact.1"
        ],
        captureReceipts: [
          {
            artifactId:
              "artifact.1",
            pageUrl:
              "https://www.example.com/about",
            pageContentSha256:
              pageContentSha256
          }
        ]
      });
      expect(
        evidence.find(
          (item) =>
            item.id ===
            "h.workflow"
        )
      ).toMatchObject({
        kind:
          "inferred_hypothesis",
        uncertainty:
          "The public site describes manual coordination but does not quantify the operational impact."
      });
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
                        artifactIds: [
                          "forged.artifact"
                        ]
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

    it("binds durable research to the verifier-accepted run and derives protected state", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
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
      const result =
        researchResult(
          artifactIds
        );
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await research.approveTarget(
        target()
      );

      const attempt =
        await research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            artifactMapping(
              artifactIds
            )
        });

      expect(attempt).toMatchObject({
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
          }
        }
      });

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

      for (
        const evidence of
        attempt.report.evidence
      ) {
        const screenshotRecord =
          records.find(
            (record) =>
              record.id ===
              evidence.artifactIds[0]
          );

        expect(
          screenshotRecord?.kind
        ).toBe("SCREENSHOT");
        expect(
          evidence.capturedAt
        ).toBe(
          screenshotRecord
            ?.createdAt
        );
        expect(
          evidence.captureReceipts
        ).toHaveLength(1);
        expect(
          evidence.captureReceipts[0]
        ).toMatchObject({
          artifactId:
            evidence.artifactIds[0],
          captureVersion:
            "page-evidence-v1",
          pageUrl:
            evidence.sourceUrl,
          capturedAt:
            screenshotRecord
              ?.createdAt,
          pageContentSha256,
          screenshotSha256:
            createHash(
              "sha256"
            )
              .update(
                new Uint8Array([
                  0xff,
                  0xd8,
                  0xff,
                  0xd9
                ])
              )
              .digest("hex")
        });
      }
    });

    it("rejects persistence when the durable run was not verifier-accepted", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts,
          failedRun(
            runId,
            "EXECUTION_FAILED",
            "The run failed."
          )
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            {}
        })
      ).rejects.toThrow(
        "only a verifier-accepted completed run can be persisted as prospect research"
      );
    });

    it("requires a screenshot artifact for every material observed evidence item", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const diagnosticsOnly =
        await diagnosticsArtifact(
          artifacts,
          "page-diagnostics.json"
        );
      const result =
        researchResult({
          industry:
            diagnosticsOnly,
          workflow:
            diagnosticsOnly,
          hiring:
            diagnosticsOnly
        });
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            artifactMapping({
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

    it("rejects an immediate screenshot that was not captured after semantic settle", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const artifactIds = {
        industry:
          await screenshot(
            artifacts,
            "industry.jpg",
            runId,
            false
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
      const result =
        researchResult(
          artifactIds
        );
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            artifactMapping(
              artifactIds
            )
        })
      ).rejects.toThrow(
        "research screenshot is missing a server-owned page capture receipt"
      );
    });

    it("rejects a screenshot whose captured page URL does not match the claimed source", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
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
      const result =
        researchResult(
          artifactIds
        );
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId: {
            ...artifactMapping(
              artifactIds
            ),
            "e.workflow": [
              artifactIds.industry
            ]
          }
        })
      ).rejects.toThrow(
        "research screenshot page URL must match evidence source URL"
      );

      expect(
        await repository
          .getProspect(
            "target.example"
          )
      ).toBeUndefined();
    });

    it("fails closed when evidence references a real screenshot from another run", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const foreign =
        await screenshot(
          artifacts,
          "foreign.jpg",
          "other_run"
        );
      const result =
        researchResult({
          industry: foreign,
          workflow: foreign,
          hiring: foreign
        });
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            artifactMapping({
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
      const result =
        researchResult({
          industry:
            "missing.industry",
          workflow:
            "missing.workflow",
          hiring:
            "missing.hiring"
        });
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );

      await expect(
        research.recordCompleted({
          targetId:
            "target.example",
          runId,
          artifactIdsByEvidenceId:
            {}
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
      const result =
        researchResult(
          artifactIds
        );
      const research =
        service(
          repository,
          artifacts,
          completedRun(result)
        );
      const input = {
        targetId:
          "target.example",
        runId,
        artifactIdsByEvidenceId:
          artifactMapping(
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

    it("persists failures using durable run identity, time, and message", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const message =
        "The approved public site blocked automated access.";
      const research =
        service(
          repository,
          artifacts,
          failedRun(
            "run.failed",
            "EXECUTION_FAILED",
            message
          )
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
            "ACCESS_BLOCKED"
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
          message
        }
      });
      expect(
        await repository.getAttempt(
          "run.failed"
        )
      ).toEqual(failure);
    });

    it("derives timeout and cancellation classifications from durable terminal state", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();

      const timeoutResearch =
        service(
          repository,
          artifacts,
          failedRun(
            "run.timeout",
            "RUN_TIMEOUT",
            "Research exceeded its execution budget."
          )
        );
      await timeoutResearch
        .approveTarget(
          target()
        );

      await expect(
        timeoutResearch.recordFailure({
          targetId:
            "target.example",
          runId:
            "run.timeout"
        })
      ).resolves.toMatchObject({
        failure: {
          code: "TIMEOUT"
        }
      });

      const cancelledRepository =
        new InMemoryProspectResearchRepository();
      const cancelledResearch =
        service(
          cancelledRepository,
          artifacts,
          failedRun(
            "run.cancelled",
            "RUN_CANCELLED",
            "Operator cancelled the run."
          )
        );
      await cancelledResearch
        .approveTarget(
          target()
        );

      await expect(
        cancelledResearch.recordFailure({
          targetId:
            "target.example",
          runId:
            "run.cancelled"
        })
      ).resolves.toMatchObject({
        failure: {
          code: "CANCELLED"
        }
      });
    });

    it("rejects a failure classification that contradicts durable terminal state", async () => {
      const artifacts =
        new InMemoryArtifactStore();
      const repository =
        new InMemoryProspectResearchRepository();
      const research =
        service(
          repository,
          artifacts,
          failedRun(
            "run.timeout",
            "RUN_TIMEOUT",
            "Research exceeded its execution budget."
          )
        );

      await research.approveTarget(
        target()
      );

      await expect(
        research.recordFailure({
          targetId:
            "target.example",
          runId:
            "run.timeout",
          code:
            "PROVIDER_FAILED"
        })
      ).rejects.toThrow(
        "RUN_TIMEOUT must be classified as TIMEOUT"
      );
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

it(
  "validates normal-tools human baseline evidence without restricting it to Astra's approved company domain",
  () => {
    const brief = {
      companyName: null,
      companySummary: [
        {
          id:
            "human.claim",
          kind:
            "observed_fact" as const,
          statement:
            "A third-party industry source reports an operational expansion.",
          evidenceIds: [
            "human.evidence"
          ]
        }
      ],
      transformationOpportunities:
        [],
      buyingSignals: [],
      unknowns: [],
      evidence: [
        {
          id:
            "human.evidence",
          sourceUrl:
            "https://industry-source.example/research/example-systems",
          observation:
            "A third-party industry source reports an operational expansion.",
          uncertainty:
            "none" as const,
          uncertaintyNote:
            null
        }
      ]
    };

    expect(
      validateHumanBaselineBrief(
        brief
      )
    ).toEqual(brief);

    expect(() =>
      validateHumanBaselineBrief({
        ...brief,
        companySummary: [
          {
            ...brief
              .companySummary[0],
            evidenceIds: [
              "missing.evidence"
            ]
          }
        ]
      })
    ).toThrow(
      "human baseline claim references unknown evidence"
    );
  }
);

