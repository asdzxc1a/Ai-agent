import {
  mkdir,
  writeFile
} from "node:fs/promises";
import { dirname } from "node:path";

import {
  chromium,
  type Browser,
  type Page
} from "playwright-core";
import {
  expect,
  test
} from "vitest";

import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";
import {
  InMemoryArtifactStore
} from "@astra/artifact-store";
import {
  SteelBrowserRuntime
} from "@astra/browser-steel";
import type {
  RunSnapshot
} from "@astra/contracts";
import {
  InMemoryRunRepository,
  RunEngine
} from "@astra/run-engine";

import {
  buildBenchmarkReport,
  EVAL_FIXTURE_VERSION,
  EVAL_TASKS,
  evaluateTask,
  resolveTaskStartUrl,
  serializeBenchmarkReport,
  type EvalTask,
  type EvalTaskResult
} from "../src/index.js";

const steelBaseUrl =
  process.env.STEEL_BASE_URL ??
  "http://127.0.0.1:3000";
const fixtureBaseUrl =
  process.env.EVAL_FIXTURE_URL ??
  "http://host.docker.internal:4174";
const reportPath =
  process.env.EVAL_REPORT_PATH ??
  "artifacts/gate8/baseline-0.json";

interface TaskProbe {
  finalState?: unknown;
  finalUrl?: string;
}

class ScriptedBrowserAgentSession
  implements AgentSession {
  readonly #browser: Browser;
  readonly #task: EvalTask;
  readonly #probe: TaskProbe;
  #page: Page;

  private constructor(
    browser: Browser,
    page: Page,
    task: EvalTask,
    probe: TaskProbe
  ) {
    this.#browser = browser;
    this.#page = page;
    this.#task = task;
    this.#probe = probe;
  }

  public static async open(
    options: OpenAgentSessionOptions,
    task: EvalTask,
    probe: TaskProbe
  ): Promise<ScriptedBrowserAgentSession> {
    const browser =
      await chromium.connectOverCDP(
        options.browser.cdpUrl
      );

    const context =
      browser.contexts()[0];

    if (context === undefined) {
      throw new Error(
        "Eval browser exposed no context."
      );
    }

    const page =
      context.pages()[0] ??
      (await context.newPage());

    return new ScriptedBrowserAgentSession(
      browser,
      page,
      task,
      probe
    );
  }

  public async navigate(
    url: string
  ): Promise<void> {
    await this.#page.goto(url, {
      waitUntil: "domcontentloaded"
    });
  }

  public async observe(
    instruction: string
  ): Promise<AgentAction[]> {
    void instruction;

    return this.#task.contractActions.map(
      (action) => ({
        selector: action.selector,
        description: action.description,
        method: action.method,
        ...(action.arguments === undefined
          ? {}
          : {
              arguments: [
                ...action.arguments
              ]
            })
      })
    );
  }

  public async act(
    action: AgentAction
  ): Promise<AgentActionResult> {
    await this.#executeAction(action);

    return {
      success: true,
      message:
        `scripted ${action.method ?? "unknown"} completed`,
      actionDescription:
        action.description,
      actions: [action]
    };
  }

  async #executeAction(
    action: AgentAction
  ): Promise<void> {
    switch (action.method) {
      case "click":
        await this.#page
          .locator(action.selector)
          .click();
        return;

      case "fill": {
        const value =
          action.arguments?.[0];

        if (value === undefined) {
          throw new Error(
            "fill action requires a value."
          );
        }

        await this.#page
          .locator(action.selector)
          .fill(value);
        return;
      }

      case "select": {
        const value =
          action.arguments?.[0];

        if (value === undefined) {
          throw new Error(
            "select action requires a value."
          );
        }

        await this.#page
          .locator(action.selector)
          .selectOption(value);
        return;
      }

      case "frame-click": {
        const innerSelector =
          action.arguments?.[0];

        if (innerSelector === undefined) {
          throw new Error(
            "frame-click requires an inner selector."
          );
        }

        await this.#page
          .frameLocator(action.selector)
          .locator(innerSelector)
          .click();
        return;
      }

      case "click-new-page": {
        const context =
          this.#page.context();
        const [nextPage] =
          await Promise.all([
            context.waitForEvent("page"),
            this.#page
              .locator(action.selector)
              .click()
          ]);

        await nextPage.waitForLoadState(
          "domcontentloaded"
        );
        this.#page = nextPage;
        return;
      }

      default:
        throw new Error(
          `Unsupported scripted method: ${String(
            action.method
          )}`
        );
    }
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({});
  }

  public async close(): Promise<void> {
    const text =
      await this.#page
        .locator("#eval-result")
        .textContent()
        .catch(() => null);

    if (text !== null) {
      this.#probe.finalState =
        JSON.parse(text) as unknown;
    }

    this.#probe.finalUrl =
      this.#page.url();

    void this.#browser;
  }
}

class ScriptedBrowserAgentRuntime
  implements AgentRuntime {
  readonly #task: EvalTask;
  public readonly probe: TaskProbe = {};

  public constructor(task: EvalTask) {
    this.#task = task;
  }

  public openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession> {
    return ScriptedBrowserAgentSession.open(
      options,
      this.#task,
      this.probe
    );
  }
}

async function waitForTerminal(
  engine: RunEngine,
  runId: string,
  timeoutMs: number
): Promise<RunSnapshot> {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run =
      await engine.getRun(runId);

    if (
      run?.status === "COMPLETED" ||
      run?.status === "FAILED" ||
      run?.status === "CANCELLED"
    ) {
      return run;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error(
    `Eval run ${runId} exceeded ${timeoutMs}ms.`
  );
}

async function runBaselineTask(
  task: EvalTask
): Promise<EvalTaskResult> {
  const repository =
    new InMemoryRunRepository();
  const artifactStore =
    new InMemoryArtifactStore();
  const agentRuntime =
    new ScriptedBrowserAgentRuntime(task);
  const engine = new RunEngine({
    repository,
    browserRuntime:
      new SteelBrowserRuntime({
        baseUrl: steelBaseUrl,
        skipFingerprintInjection:
          true
      }),
    agentRuntime,
    artifactStore
  });

  const startedAt = Date.now();
  const started =
    await engine.createRun({
      request: {
        url: resolveTaskStartUrl(
          task,
          fixtureBaseUrl
        ),
        goal: task.goal
      }
    });
  const terminal =
    await waitForTerminal(
      engine,
      started.id,
      task.timeoutMs
    );
  const durationMs =
    Date.now() - startedAt;
  const steps =
    await repository.listSteps(
      started.id
    );
  const actSteps =
    steps.filter(
      (step) => step.kind === "ACT"
    );
  const artifacts =
    await engine.listArtifacts(
      started.id
    );
  const names = new Set(
    artifacts.map(
      (artifact) => artifact.name
    )
  );
  const artifactComplete =
    names.has(
      "after-navigation.jpg"
    ) &&
    names.has(
      "after-action.jpg"
    ) &&
    names.has(
      "run-summary.json"
    );

  return evaluateTask(task, {
    runId: started.id,
    runStatus: terminal.status,
    ...(agentRuntime.probe
      .finalState === undefined
      ? {}
      : {
          finalState:
            agentRuntime.probe
              .finalState
        }),
    stepCount: actSteps.length,
    durationMs,
    artifactComplete,
    ...(terminal.error === undefined
      ? {}
      : {
          failureCode:
            terminal.error.code
        }),
    actionFailures:
      actSteps.filter((step) => {
        const payload =
          step.payload as {
            result?: {
              success?: boolean;
            };
          };

        return (
          payload.result?.success ===
          false
        );
      }).length,
    loopCount: 0
  });
}

test(
  "Baseline 0 exposes the one-action engine limit across deterministic browser tasks",
  async () => {
    const results: EvalTaskResult[] = [];

    for (const task of EVAL_TASKS) {
      results.push(
        await runBaselineTask(task)
      );
    }

    const report =
      buildBenchmarkReport(
        {
          lane: "contract",
          fixtureVersion:
            EVAL_FIXTURE_VERSION,
          gitCommit:
            process.env.GITHUB_SHA ??
            "local",
          generatedAt:
            new Date().toISOString(),
          model: {
            provider: "scripted",
            model:
              "contract-browser-v1",
            configuration: {
              engine:
                "current-one-action-run-engine"
            }
          }
        },
        results
      );

    await mkdir(
      dirname(reportPath),
      {
        recursive: true
      }
    );
    await writeFile(
      reportPath,
      serializeBenchmarkReport(report),
      "utf8"
    );

    expect(report.aggregate.total).toBe(
      13
    );
    expect(report.aggregate.passed).toBe(
      5
    );
    expect(report.aggregate.failed).toBe(
      8
    );
    expect(
      report.aggregate.falseCompleted
    ).toBe(8);
    expect(
      report.aggregate.successRate
    ).toBeCloseTo(5 / 13, 8);
    expect(
      report.tasks.every(
        (task) =>
          task.artifactComplete
      )
    ).toBe(true);
    expect(
      report.tasks.every(
        (task) =>
          task.stepCount === 1
      )
    ).toBe(true);
  },
  300_000
);
