import {
  expect,
  test
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
  SteelBrowserRuntime,
  SteelClient
} from "@astra/browser-steel";

import {
  InMemoryRunRepository,
  RunEngine
} from "../src/index.js";

const steelBaseUrl =
  process.env.STEEL_BASE_URL ??
  "http://127.0.0.1:3000";

class BlockingAgentSession
  implements AgentSession {
  public closeCalls = 0;

  public async navigate(
    url: string,
    options:
      AgentOperationOptions = {}
  ): Promise<void> {
    void url;

    const signal =
      options.signal;

    if (signal === undefined) {
      throw new Error(
        "Steel cancellation test requires an abort signal."
      );
    }

    await new Promise<void>(
      (_resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }

        signal.addEventListener(
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
      success: true,
      message: "unused",
      actions: [action]
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    void instruction;
    return schema.parse({});
  }

  public async close():
    Promise<void> {
    this.closeCalls += 1;
  }
}

class BlockingAgentRuntime
  implements AgentRuntime {
  public browserId:
    string | undefined;
  public readonly session =
    new BlockingAgentSession();

  public async openSession(
    options:
      OpenAgentSessionOptions
  ): Promise<AgentSession> {
    this.browserId =
      options.browser.id;
    return this.session;
  }
}

async function waitForBrowserId(
  runtime:
    BlockingAgentRuntime
): Promise<string> {
  for (
    let attempt = 0;
    attempt < 200;
    attempt += 1
  ) {
    if (
      runtime.browserId !==
      undefined
    ) {
      return runtime.browserId;
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 10);
      }
    );
  }

  throw new Error(
    "Steel browser session did not open."
  );
}

async function waitForCancelled(
  engine: RunEngine,
  runId: string
) {
  for (
    let attempt = 0;
    attempt < 200;
    attempt += 1
  ) {
    const run =
      await engine.getRun(runId);

    if (
      run?.status ===
      "CANCELLED"
    ) {
      return run;
    }

    if (
      run?.status ===
        "FAILED" ||
      run?.status ===
        "COMPLETED"
    ) {
      throw new Error(
        "Cancellation reached unexpected terminal state " +
          run.status
      );
    }

    await new Promise(
      (resolve) => {
        setTimeout(resolve, 10);
      }
    );
  }

  throw new Error(
    "Steel cancellation run did not cancel."
  );
}

test(
  "cancellation releases the real Steel session",
  async () => {
    const runtime =
      new BlockingAgentRuntime();
    const engine =
      new RunEngine({
        repository:
          new InMemoryRunRepository(),
        browserRuntime:
          new SteelBrowserRuntime({
            baseUrl:
              steelBaseUrl,
            skipFingerprintInjection:
              true
          }),
        agentRuntime: runtime
      });

    const started =
      await engine.createRun({
        request: {
          url:
            "http://host.docker.internal:4173/",
          goal:
            "Hold until cancelled."
        }
      });

    const browserId =
      await waitForBrowserId(
        runtime
      );

    await engine.cancelRun(
      started.id
    );

    const terminal =
      await waitForCancelled(
        engine,
        started.id
      );

    expect(
      terminal.terminalReason?.code
    ).toBe("RUN_CANCELLED");
    expect(
      runtime.session.closeCalls
    ).toBe(1);

    const details =
      await new SteelClient(
        steelBaseUrl
      ).getSession(
        browserId
      );

    expect(details.status).toBe(
      "released"
    );
  },
  300_000
);
