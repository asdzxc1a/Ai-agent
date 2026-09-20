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
  ProspectResearchWorkflow,
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
          new InMemoryProspectResearchRepository();
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
          workflow.start({
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

        const started =
          await workflow.start({
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
        expect(
          browser.session
            .closeCalls
        ).toBe(1);
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

        const first =
          await workflow.start({
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

        const started =
          await workflow.start({
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
