import {
  describe,
  expect,
  it
} from "vitest";

import type {
  AgentAction,
  AgentActionResult,
  AgentOperationOptions,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import {
  InMemoryArtifactStore
} from "@astra/artifact-store";
import type {
  BrowserRuntime,
  BrowserSession
} from "@astra/browser-runtime";
import {
  InMemoryRunRepository
} from "@astra/run-engine";
import {
  LocalSandboxRuntime
} from "@astra/sandbox-runtime";

import {
  ApprovedResearchTargetSchema,
  InMemoryProspectResearchRepository,
  ProspectResearchSampleSchema,
  ProspectResearchWorkflow,
  ResearchApprovalBatchSchema,
  ProspectResearchValidationError,
  type ProspectResearchResult
} from "../src/index.js";

const startUrl =
  "https://example.com/";
const timestamp =
  "2026-09-20T12:00:00.000Z";

function target() {
  return ApprovedResearchTargetSchema
    .parse({
      id: "target.workflow",
      domain: "example.com",
      startUrl,
      approvedDomains: [
        "example.com"
      ],
      companyNameHint:
        "Example Systems",
      icpContext:
        "Industrial operations.",
      approval: {
        id:
          "approval.workflow",
        scope:
          "public_research_only",
        approvedBy:
          "operator",
        approvedAt:
          timestamp
      }
    });
}

const sampleId =
  "sample.workflow";

function sample() {
  return ProspectResearchSampleSchema
    .parse({
      id: sampleId,
      status: "FROZEN",
      protocolVersion:
        "gate13-measured-research-v7",
      purpose:
        "CALIBRATION",
      cohortDefinition:
        "Single-target workflow calibration fixture; diagnostic only.",
      selectionMethod:
        "Single deterministic fixture target.",
      selectionUniverse:
        null,
      marketScope:
        "SINGLE_MARKET",
      marketDescription:
        "Fixture market",
      humanBaselineMode:
        "SCOPE_MATCHED",
      targets: [
        target()
      ],
      criteria: {
        maxUnsupportedMaterialClaims:
          0,
        minUsableBriefRate:
          0.9,
        minMedianHumanTimeReductionFraction:
          0.5,
        requireNoUnauthorizedActions:
          true,
        maxDeliveryCostUsdPerBrief:
          25
      },
      costCeilingRationale:
        "Fixture ceiling used only for workflow calibration.",
      humanBaselineDescription:
        "Operator manually researches the approved public page and drafts the same brief.",
      comparisonBaselineDescription:
        null,
      reviewRubricVersion:
        "gate13-brief-review-v1",
      frozenBy:
        "operator",
      frozenAt:
        "2026-09-20T12:10:00.000Z"
    });
}

function acceptanceTarget(
  index: number
) {
  const suffix =
    String(index)
      .padStart(2, "0");

  return ApprovedResearchTargetSchema
    .parse({
      ...target(),
      id:
        "target.acceptance." +
        suffix,
      companyNameHint:
        "Acceptance Company " +
        suffix,
      approval: {
        ...target().approval,
        id:
          "approval.acceptance." +
          suffix
      }
    });
}

function acceptanceSample() {
  return ProspectResearchSampleSchema
    .parse({
      id:
        "sample.acceptance.workflow",
      status: "FROZEN",
      protocolVersion:
        "gate13-measured-research-v7",
      purpose:
        "ACCEPTANCE",
      cohortDefinition:
        "Thirty deterministic U.S. industrial/logistics fixture targets.",
      selectionMethod:
        "Complete deterministic fixture universe.",
      selectionUniverse: {
        id:
          "universe.acceptance.workflow",
        sourceName:
          "Deterministic workflow acceptance universe",
        sourceUrl:
          "https://example.test/workflow-acceptance-universe.csv",
        methodologyUrl:
          "https://example.test/workflow-acceptance-methodology",
        sourceAsOfDate:
          "2026-09-19",
        sourceDeclaredCount:
          30,
        candidateTargetIds:
          Array.from(
            {
              length: 30
            },
            (_value, index) =>
              "target.acceptance." +
              String(
                index + 1
              ).padStart(
                2,
                "0"
              )
          ),
        selectionStrategy:
          "COMPLETE_UNIVERSE",
        selectionSeed:
          null
      },
      marketScope:
        "SINGLE_MARKET",
      marketDescription:
        "United States",
      humanBaselineMode:
        "NORMAL_TOOLS",
      targets:
        Array.from(
          {
            length: 30
          },
          (_value, index) =>
            acceptanceTarget(
              index + 1
            )
        ),
      criteria: {
        maxUnsupportedMaterialClaims:
          0,
        minUsableBriefRate:
          0.9,
        minMedianHumanTimeReductionFraction:
          0.5,
        requireNoUnauthorizedActions:
          true,
        maxDeliveryCostUsdPerBrief:
          25
      },
      deliveryCostPlan: {
        version:
          "gate13-delivery-cost-v1",
        methodologyDescription:
          "Deterministic workflow fixture allocation.",
        rates: [
          {
            id:
              "cost.workflow.model",
            category:
              "MODEL",
            label:
              "Fixture model",
            meter:
              "FIXED_PER_RUN",
            unitsPerBillingUnit:
              1,
            usdPerBillingUnit:
              1,
            rounding:
              "NONE",
            sourceDescription:
              "Deterministic workflow fixture model rate.",
            sourceUrl:
              "https://example.test/model-pricing",
            sourceAsOfDate:
              "2026-09-20"
          },
          {
            id:
              "cost.workflow.browser",
            category:
              "BROWSER_PROVIDER",
            label:
              "Fixture browser",
            meter:
              "FIXED_PER_RUN",
            unitsPerBillingUnit:
              1,
            usdPerBillingUnit:
              1,
            rounding:
              "NONE",
            sourceDescription:
              "Deterministic workflow fixture browser allocation.",
            sourceUrl:
              "https://example.test/browser-pricing",
            sourceAsOfDate:
              "2026-09-20"
          }
        ]
      },
      costCeilingRationale:
        "Fixture acceptance ceiling.",
      humanBaselineDescription:
        "Human researcher uses normal research tools before Astra.",
      comparisonBaselineDescription:
        null,
      reviewRubricVersion:
        "gate13-brief-review-v1",
      frozenBy:
        "operator",
      frozenAt:
        "2026-09-20T12:10:00.000Z"
    });
}

function acceptanceApprovalBatch(
  targets =
    acceptanceSample()
      .targets
) {
  return ResearchApprovalBatchSchema
    .parse({
      id:
        "approval-batch.acceptance.workflow",
      sourceManifestId:
        "manifest.acceptance.workflow",
      sourceManifestSha256:
        "c".repeat(64),
      approvedBy:
        "operator",
      approvedAt:
        timestamp,
      targets
    });
}

function outsideTarget() {
  return ApprovedResearchTargetSchema
    .parse({
      ...target(),
      id:
        "target.outside",
      approval: {
        ...target().approval,
        id:
          "approval.outside"
      }
    });
}

function result():
  ProspectResearchResult {
  return {
    companyName: null,
    companySummary: [
      {
        id:
          "claim.summary",
        kind:
          "observed_fact",
        statement:
          "Example Systems builds automation software.",
        evidenceIds: [
          "e.home"
        ]
      }
    ],
    transformationOpportunities:
      [],
    buyingSignals: [],
    unknowns: [],
    evidence: [
      {
        id: "e.home",
        sourceUrl:
          startUrl,
        observation:
          "Example Systems builds automation software.",
        uncertainty:
          "none",
        uncertaintyNote:
          null
      }
    ]
  };
}

class ReadOnlyBrowser
  implements BrowserSession {
  public readonly id =
    "browser.workflow";
  public readonly cdpUrl =
    "ws://fixture/workflow";
  public closeCalls = 0;

  public async captureScreenshot():
    Promise<Uint8Array> {
    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xd9
    ]);
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class ReadOnlyBrowserRuntime
  implements BrowserRuntime {
  public readonly session =
    new ReadOnlyBrowser();

  public async createSession():
    Promise<BrowserSession> {
    return this.session;
  }
}

class ReadOnlyResearchAgent
  implements AgentSession {
  public actCalls = 0;
  public navigateCalls = 0;

  public constructor(
    private readonly researchResult:
      ProspectResearchResult =
        result()
  ) {}

  public async navigate(
    url: string
  ): Promise<void> {
    this.navigateCalls += 1;
    expect(url).toBe(
      startUrl
    );
  }

  public async observe():
    Promise<AgentAction[]> {
    return [
      {
        selector:
          "#submit-contact-form",
        description:
          "Submit the contact form",
        method:
          "click"
      }
    ];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    this.actCalls += 1;

    return {
      success: true,
      message:
        "This must never execute.",
      actions: [action],
      effect: "committed"
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    expect(
      instruction
    ).toContain(
      "Do not submit forms"
    );

    return schema.parse(
      this.researchResult
    );
  }

  public async capturePageEvidence() {
    return {
      url: startUrl,
      title:
        "Example Systems",
      text:
        "Example Systems builds automation software."
    };
  }

  public async close():
    Promise<void> {}
}

class BlockingResearchAgent
  implements AgentSession {
  public navigateStarted =
    false;

  public async navigate(
    url: string,
    options:
      AgentOperationOptions = {}
  ): Promise<void> {
    expect(url).toBe(
      startUrl
    );
    this.navigateStarted =
      true;

    await new Promise<void>(
      (_resolve, reject) => {
        const signal =
          options.signal;

        if (signal?.aborted) {
          reject(
            signal.reason
          );
          return;
        }

        signal?.addEventListener(
          "abort",
          () => {
            reject(
              signal.reason
            );
          },
          {
            once: true
          }
        );
      }
    );
  }

  public async observe():
    Promise<AgentAction[]> {
    return [];
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    return {
      success: false,
      message:
        "Blocking fixture must not act.",
      actions: [action],
      effect: "none"
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse(
      result()
    );
  }

  public async close():
    Promise<void> {}
}

class BlockingResearchRuntime
  implements AgentRuntime {
  public readonly session =
    new BlockingResearchAgent();

  public async openSession():
    Promise<AgentSession> {
    return this.session;
  }
}

class ReadOnlyResearchRuntime
  implements AgentRuntime {
  public readonly session:
    ReadOnlyResearchAgent;
  public openedBrowser:
    BrowserSession | undefined;

  public constructor(
    researchResult:
      ProspectResearchResult =
        result()
  ) {
    this.session =
      new ReadOnlyResearchAgent(
        researchResult
      );
  }

  public async openSession(
    options:
      OpenAgentSessionOptions
  ): Promise<AgentSession> {
    this.openedBrowser =
      options.browser;

    return this.session;
  }
}

async function waitForTerminal(
  workflow:
    ProspectResearchWorkflow,
  runId: string
) {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    const run =
      await workflow
        .getRun(runId);

    if (
      run?.status ===
        "COMPLETED" ||
      run?.status === "FAILED" ||
      run?.status ===
        "CANCELLED"
    ) {
      return run;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          5
        )
    );
  }

  throw new Error(
    "Research workflow did not reach terminal state."
  );
}

describe(
  "ProspectResearchWorkflow",
  () => {
    it(
      "starts only from stored approval, never acts, and persists the operator-reviewed evidence mapping",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository(
            () =>
              "2026-09-20T12:15:00.000Z"
          );
        const runRepository =
          new InMemoryRunRepository();
        const artifacts =
          new InMemoryArtifactStore();
        const browser =
          new ReadOnlyBrowserRuntime();
        const agent =
          new ReadOnlyResearchRuntime();
        const workflow =
          new ProspectResearchWorkflow({
            repository,
            runRepository,
            artifactStore:
              artifacts,
            browserRuntime:
              browser,
            agentRuntime:
              agent,
            sandboxRuntimeFactory(
              policy
            ) {
              return new LocalSandboxRuntime({
                ...policy,
                resolver: {
                  async resolve() {
                    return [
                      "93.184.216.34"
                    ];
                  }
                }
              });
            },
            executionBudget: {
              maxActions: 1,
              maxDurationMs:
                5_000,
              repeatedActionLimit:
                1
            },
            diagnosticsTimeoutMs:
              100,
            cleanupTimeoutMs:
              100
          });

        await expect(
          workflow.freezeSample(
            sample()
          )
        ).rejects.toBeInstanceOf(
          ProspectResearchValidationError
        );

        await expect(
          workflow.start({
            sampleId,
            targetId:
              "target.workflow"
          })
        ).rejects.toBeInstanceOf(
          ProspectResearchValidationError
        );

        await workflow
          .approveTarget(
            target()
          );
        await workflow
          .freezeSample(
            sample()
          );
        const humanBaseline =
          await workflow
            .recordHumanBaseline({
              id:
                "baseline.workflow",
              sampleId,
              targetId:
                "target.workflow",
              source:
                "FIXED_CAP",
              preparedBy:
                "operator",
              humanPreparationMinutes:
                20,
              toolingDescription:
                "Scope-matched calibration fixture tools.",
              notes: null
            });
        await workflow
          .approveTarget(
            outsideTarget()
          );

        await expect(
          workflow.start({
            sampleId,
            targetId:
              "target.outside"
          })
        ).rejects.toThrow(
          "outside the frozen measured sample"
        );

        const started =
          await workflow.start({
            sampleId,
            targetId:
              "target.workflow"
          });
        const terminal =
          await waitForTerminal(
            workflow,
            started.id
          );

        expect(
          terminal?.status
        ).toBe("COMPLETED");
        expect(
          agent.session.actCalls
        ).toBe(0);
        expect(
          agent.session
            .navigateCalls
        ).toBe(1);

        const policy =
          agent.openedBrowser
            ?.networkPolicy;

        expect(policy)
          .toBeDefined();
        await expect(
          policy!.assertAllowed({
            url: startUrl,
            isNavigation: true
          })
        ).resolves.toBeUndefined();
        await expect(
          policy!.assertAllowed({
            url:
              "https://example.com.evil.test/",
            isNavigation: true
          })
        ).rejects.toThrow();

        const records =
          await workflow
            .listArtifacts(
              started.id
            );
        const settled =
          records.find(
            (record) =>
              record.name ===
              "final-observation.jpg"
          );

        expect(settled)
          .toBeDefined();
        expect(
          settled?.metadata
        ).toMatchObject({
          captureVersion:
            "page-evidence-v1",
          semanticSettled:
            true,
          pageUrl:
            startUrl
        });

        const attempt =
          await workflow
            .reviewCompleted({
              targetId:
                "target.workflow",
              runId:
                started.id,
              artifactIdsByEvidenceId: {
                "e.home": [
                  settled!.id
                ]
              }
            });

        expect(
          attempt.status
        ).toBe("COMPLETED");
        expect(
          attempt
            .unauthorizedActions
        ).toBe(0);
        expect(
          attempt
            .runDurationMs
        ).toBeGreaterThan(0);
        expect(
          attempt.report
            .evidence[0]
            ?.captureReceipts[0]
        ).toMatchObject({
          artifactId:
            settled!.id,
          semanticSettled:
            true,
          pageUrl:
            startUrl
        });
        expect(
          await repository
            .getProspect(
              "target.workflow"
            )
        ).toEqual(
          attempt.report
            .prospect
        );

        await workflow
          .recordSampleOutcome({
            id:
              "outcome.workflow",
            sampleId,
            targetId:
              "target.workflow",
            attemptId:
              attempt.id,
            baselineId:
              humanBaseline.id,
            reviewRubricVersion:
              "gate13-brief-review-v1",
            attemptStatus:
              "COMPLETED",
            briefDisposition:
              "minor_edit",
            reviewedBy:
              "operator",
            reviewedAt:
              "2026-09-20T12:20:00.000Z",
            reviewMode:
              "UNBLINDED",
            baselineSource:
              humanBaseline.source,
            baselineMeasuredAt:
              humanBaseline.recordedAt,
            materialClaimsReviewed:
              1,
            unsupportedMaterialClaims:
              0,
            corrections: {
              minor: 1,
              major: 0,
              critical: 0
            },
            requestedFieldsTotal:
              3,
            requestedFieldsCovered:
              3,
            baselineHumanPreparationMinutes:
              humanBaseline
                .humanPreparationMinutes,
            astraHumanTime: {
              targetSetupMinutes:
                1,
              evidenceMappingAndAuditMinutes:
                4,
              correctionAndFinalizationMinutes:
                3,
              failureTriageMinutes:
                0,
              otherMinutes:
                0,
              measurementMethod:
                "STOPWATCH",
              otherDescription:
                null
            },
            endToEndDurationMs:
              4_000,
            deliveryCostUsd:
              5,
            unauthorizedActions:
              0,
            notes:
              "Minor wording edit only."
          });

        await expect(
          workflow.sampleEvaluation(
            sampleId
          )
        ).resolves.toMatchObject({
          complete: true,
          passed: null,
          metrics: {
            targetCount: 1,
            outcomeCount: 1,
            usableBriefRate: 1,
            unsupportedMaterialClaims:
              0,
            medianHumanTimeReductionFraction:
              0.6,
            medianAstraHumanPreparationMinutes:
              8,
            requestedFieldCoverageRate:
              1,
            unauthorizedActions:
              0,
            maxDeliveryCostUsdPerBrief:
              5
          },
          failures: []
        });

        expect(
          browser.session
            .closeCalls
        ).toBe(1);
      }
    );

    it(
      "rejects an acceptance freeze assembled from individual approvals instead of one batch",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository();
        const workflow =
          new ProspectResearchWorkflow({
            repository,
            runRepository:
              new InMemoryRunRepository(),
            artifactStore:
              new InMemoryArtifactStore(),
            browserRuntime:
              new ReadOnlyBrowserRuntime(),
            agentRuntime:
              new ReadOnlyResearchRuntime(),
            sandboxRuntimeFactory(
              policy
            ) {
              return new LocalSandboxRuntime({
                ...policy,
                resolver: {
                  async resolve() {
                    return [
                      "93.184.216.34"
                    ];
                  }
                }
              });
            }
          });
        const acceptance =
          acceptanceSample();

        for (
          const approved of
          acceptance.targets
        ) {
          await workflow
            .approveTarget(
              approved
            );
        }

        await expect(
          workflow.freezeSample(
            acceptance
          )
        ).rejects.toThrow(
          "must come from one atomic approval batch"
        );
      }
    );

    it(
      "requires a durable human baseline before an acceptance target can start",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository(
            () =>
              "2026-09-20T12:15:00.000Z"
          );
        const agent =
          new BlockingResearchRuntime();
        const workflow =
          new ProspectResearchWorkflow({
            repository,
            runRepository:
              new InMemoryRunRepository(),
            artifactStore:
              new InMemoryArtifactStore(),
            browserRuntime:
              new ReadOnlyBrowserRuntime(),
            agentRuntime:
              agent,
            sandboxRuntimeFactory(
              policy
            ) {
              return new LocalSandboxRuntime({
                ...policy,
                resolver: {
                  async resolve() {
                    return [
                      "93.184.216.34"
                    ];
                  }
                }
              });
            }
          });
        const acceptance =
          acceptanceSample();

        await workflow
          .approveTargetBatch(
            acceptanceApprovalBatch(
              acceptance.targets
            )
          );

        await workflow
          .freezeSample(
            acceptance
          );

        await expect(
          workflow.start({
            sampleId:
              acceptance.id,
            targetId:
              acceptance.targets[0]!
                .id
          })
        ).rejects.toThrow(
          "requires a durable human baseline before Astra starts"
        );

        const baseline =
          await workflow
            .recordHumanBaseline({
              id:
                "baseline.acceptance.01",
              sampleId:
                acceptance.id,
              targetId:
                acceptance.targets[0]!
                  .id,
              source:
                "MEASURED_HUMAN",
              preparedBy:
                "human.researcher",
              humanPreparationMinutes:
                18,
              toolingDescription:
                "Normal human research tools.",
              notes: null
            });

        expect(
          baseline.recordedAt
        ).toBe(
          "2026-09-20T12:15:00.000Z"
        );

        const started =
          await workflow.start({
            sampleId:
              acceptance.id,
            targetId:
              acceptance.targets[0]!
                .id
          });

        await workflow
          .cancelRun(
            started.id
          );

        await expect(
          waitForTerminal(
            workflow,
            started.id
          )
        ).resolves.toMatchObject({
          status:
            "CANCELLED"
        });
      }
    );

    it(
      "rejects a second research start while the serial Gate 13 executor is active",
      async () => {
        const agent =
          new BlockingResearchRuntime();
        const workflow =
          new ProspectResearchWorkflow({
            repository:
              new InMemoryProspectResearchRepository(),
            runRepository:
              new InMemoryRunRepository(),
            artifactStore:
              new InMemoryArtifactStore(),
            browserRuntime:
              new ReadOnlyBrowserRuntime(),
            agentRuntime:
              agent,
            sandboxRuntimeFactory(
              policy
            ) {
              return new LocalSandboxRuntime({
                ...policy,
                resolver: {
                  async resolve() {
                    return [
                      "93.184.216.34"
                    ];
                  }
                }
              });
            }
          });

        await workflow
          .approveTarget(
            target()
          );
        await workflow
          .freezeSample(
            sample()
          );

        const first =
          await workflow.start({
            sampleId,
            targetId:
              "target.workflow"
          });

        for (
          let attempt = 0;
          attempt < 100 &&
          !agent.session
            .navigateStarted;
          attempt += 1
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                5
              )
          );
        }

        expect(
          agent.session
            .navigateStarted
        ).toBe(true);

        await expect(
          workflow.start({
            sampleId,
            targetId:
              "target.workflow"
          })
        ).rejects.toThrow(
          "Gate 13 research workflow is serial"
        );

        await workflow.cancelRun(
          first.id
        );

        await expect(
          waitForTerminal(
            workflow,
            first.id
          )
        ).resolves.toMatchObject({
          status:
            "CANCELLED"
        });
      }
    );

    it(
      "rejects completion when read-only extraction cites an approved-domain page that was not observed",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository();
        const unobserved =
          result();

        unobserved.evidence[0] = {
          ...unobserved
            .evidence[0]!,
          sourceUrl:
            "https://example.com/careers"
        };

        const workflow =
          new ProspectResearchWorkflow({
            repository,
            runRepository:
              new InMemoryRunRepository(),
            artifactStore:
              new InMemoryArtifactStore(),
            browserRuntime:
              new ReadOnlyBrowserRuntime(),
            agentRuntime:
              new ReadOnlyResearchRuntime(
                unobserved
              ),
            sandboxRuntimeFactory(
              policy
            ) {
              return new LocalSandboxRuntime({
                ...policy,
                resolver: {
                  async resolve() {
                    return [
                      "93.184.216.34"
                    ];
                  }
                }
              });
            }
          });

        await workflow
          .approveTarget(
            target()
          );
        await workflow
          .freezeSample(
            sample()
          );

        const started =
          await workflow.start({
            sampleId,
            targetId:
              "target.workflow"
          });
        const terminal =
          await waitForTerminal(
            workflow,
            started.id
          );

        expect(
          terminal?.status
        ).toBe("FAILED");
        expect(
          terminal?.error?.code
        ).toBe(
          "COMPLETION_REJECTED"
        );
        expect(
          terminal
            ?.terminalReason
            ?.message
        ).toContain(
          "approved start page"
        );
      }
    );
  }
);
