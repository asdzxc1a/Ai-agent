import {
  Stagehand,
  type Action,
  type LLMClient,
  type ModelConfiguration
} from "@browserbasehq/stagehand";
import { z } from "zod";

import type {
  AgentAction,
  AgentActionResult,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";

export type CreateStagehand = (cdpUrl: string) => Stagehand;

function agentStartupAbortError(): Error {
  const error =
    new Error(
      "Agent session opening aborted."
    );
  error.name = "AbortError";
  return error;
}

function throwIfAborted(
  signal: AbortSignal | undefined
): void {
  if (signal?.aborted === true) {
    throw agentStartupAbortError();
  }
}

async function initializeStagehand(
  stagehand: Stagehand,
  signal: AbortSignal | undefined
): Promise<void> {
  let closePromise:
    Promise<void> | undefined;
  let aborted = false;

  const closePartial = () => {
    closePromise ??=
      stagehand
        .close()
        .catch(() => undefined);
    return closePromise;
  };

  if (signal === undefined) {
    try {
      await stagehand.init();
    } catch (error) {
      await closePartial();
      throw error;
    }
    return;
  }

  throwIfAborted(signal);

  const initPromise =
    stagehand.init();

  // If cancellation wins the race but init later succeeds,
  // close again. The first close may have run while the
  // provider was still initializing and therefore cannot
  // be treated as proof that a late-created session stayed closed.
  void initPromise.then(
    () => {
      if (aborted) {
        void stagehand
          .close()
          .catch(() => undefined);
      }
    },
    () => undefined
  );

  let onAbort:
    (() => void) | undefined;

  const abortedPromise =
    new Promise<never>(
      (_, reject) => {
        onAbort = () => {
          aborted = true;

          void closePartial().finally(
            () => {
              reject(
                agentStartupAbortError()
              );
            }
          );
        };

        signal.addEventListener(
          "abort",
          onAbort,
          {
            once: true
          }
        );

        if (signal.aborted) {
          onAbort();
        }
      }
    );

  try {
    await Promise.race([
      initPromise,
      abortedPromise
    ]);
  } catch (error) {
    if (!aborted) {
      await closePartial();
    }
    throw error;
  } finally {
    if (onAbort !== undefined) {
      signal.removeEventListener(
        "abort",
        onAbort
      );
    }
  }
}

function toAgentAction(action: {
  selector: string;
  description: string;
  method?: string;
  arguments?: string[];
}): AgentAction {
  return {
    selector: action.selector,
    description: action.description,
    ...(action.method === undefined ? {} : { method: action.method }),
    ...(action.arguments === undefined
      ? {}
      : { arguments: [...action.arguments] })
  };
}

class StagehandAgentSession implements AgentSession {
  readonly #stagehand: Stagehand;
  #closePromise?: Promise<void>;

  public constructor(stagehand: Stagehand) {
    this.#stagehand = stagehand;
  }

  public async navigate(url: string): Promise<void> {
    const page = this.#stagehand.context.pages()[0];

    if (page === undefined) {
      throw new Error("Stagehand session has no active page.");
    }

    await page.goto(url);
  }

  public async observe(instruction: string): Promise<AgentAction[]> {
    const actions = await this.#stagehand.observe(instruction);
    return actions.map(toAgentAction);
  }

  public async act(action: AgentAction): Promise<AgentActionResult> {
    const result = await this.#stagehand.act({
      selector: action.selector,
      description: action.description,
      ...(action.method === undefined ? {} : { method: action.method }),
      ...(action.arguments === undefined
        ? {}
        : { arguments: [...action.arguments] })
    } as Action);

    return {
      success: result.success,
      message: result.message,
      ...(result.actionDescription === undefined
        ? {}
        : { actionDescription: result.actionDescription }),
      actions: (result.actions ?? []).map(toAgentAction)
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>
  ): Promise<T> {
    const parse = schema.parse.bind(schema);

    if (!(schema instanceof z.ZodType)) {
      throw new TypeError(
        "StagehandAgentRuntime currently requires a Zod schema."
      );
    }

    const value = await this.#stagehand.extract(
      instruction,
      schema as z.ZodType
    );

    return parse(value);
  }

  public close(): Promise<void> {
    this.#closePromise ??= this.#stagehand.close();
    return this.#closePromise;
  }
}

export class StagehandRuntimeCore implements AgentRuntime {
  readonly #createStagehand: CreateStagehand;

  public constructor(createStagehand: CreateStagehand) {
    this.#createStagehand = createStagehand;
  }

  public async openSession({
    browser,
    signal
  }: OpenAgentSessionOptions): Promise<AgentSession> {
    throwIfAborted(signal);

    const stagehand =
      this.#createStagehand(
        browser.cdpUrl
      );

    await initializeStagehand(
      stagehand,
      signal
    );

    return new StagehandAgentSession(
      stagehand
    );
  }
}

export interface StagehandModelSettings {
  modelName: string;
  apiKey?: string;
  baseURL?: string;
}

export interface StagehandRuntimeSettings {
  model: string | StagehandModelSettings;
  selfHeal?: boolean;
}

export function createConfiguredStagehandRuntime({
  model,
  selfHeal = false
}: StagehandRuntimeSettings): AgentRuntime {
  return new StagehandRuntimeCore((cdpUrl) => {
    const resolvedModel = model as ModelConfiguration;

    return new Stagehand({
      env: "LOCAL",
      model: resolvedModel,
      disableAPI: true,
      localBrowserLaunchOptions: { cdpUrl },
      keepAlive: true,
      selfHeal,
      verbose: 0,
      disablePino: true
    });
  });
}

export function createStagehandRuntimeWithClient(
  createClient: () => LLMClient
): AgentRuntime {
  return new StagehandRuntimeCore((cdpUrl) => {
    return new Stagehand({
      env: "LOCAL",
      llmClient: createClient(),
      disableAPI: true,
      localBrowserLaunchOptions: { cdpUrl },
      keepAlive: true,
      selfHeal: false,
      verbose: 0,
      disablePino: true
    });
  });
}
