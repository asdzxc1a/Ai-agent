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
  AgentOperationOptions,
  AgentRuntime,
  AgentSession,
  OpenAgentSessionOptions,
  RuntimeSchema
} from "@astra/agent-runtime";

export type CreateStagehand = (cdpUrl: string) => Stagehand;

function abortReason(
  signal: AbortSignal
): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
}

async function abortable<T>(
  operation: () => Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (signal === undefined) {
    return operation();
  }

  if (signal.aborted) {
    throw abortReason(signal);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortReason(signal));
    };

    signal.addEventListener(
      "abort",
      onAbort,
      {
        once: true
      }
    );

    void operation().then(
      (value) => {
        signal.removeEventListener(
          "abort",
          onAbort
        );
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener(
          "abort",
          onAbort
        );
        reject(error);
      }
    );
  });
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

  public async navigate(
    url: string,
    options: AgentOperationOptions = {}
  ): Promise<void> {
    const page = this.#stagehand.context.pages()[0];

    if (page === undefined) {
      throw new Error("Stagehand session has no active page.");
    }

    await abortable(
      () => page.goto(url).then(() => undefined),
      options.signal
    );
  }

  public async observe(
    instruction: string,
    options: AgentOperationOptions = {}
  ): Promise<AgentAction[]> {
    const actions = await abortable(
      () => this.#stagehand.observe(instruction),
      options.signal
    );
    return actions.map(toAgentAction);
  }

  public async act(
    action: AgentAction,
    options: AgentOperationOptions = {}
  ): Promise<AgentActionResult> {
    const result = await abortable(
      () =>
        this.#stagehand.act({
          selector: action.selector,
          description:
            action.description,
          ...(action.method ===
            undefined
            ? {}
            : {
                method:
                  action.method
              }),
          ...(action.arguments ===
            undefined
            ? {}
            : {
                arguments: [
                  ...action.arguments
                ]
              })
        } as Action),
      options.signal
    );

    return {
      success: result.success,
      message: result.message,
      ...(result.actionDescription === undefined
        ? {}
        : { actionDescription: result.actionDescription }),
      actions: (result.actions ?? []).map(toAgentAction),
      effect:
        result.success
          ? "committed"
          : "unknown"
    };
  }

  public async extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>,
    options: AgentOperationOptions = {}
  ): Promise<T> {
    const parse = schema.parse.bind(schema);

    if (!(schema instanceof z.ZodType)) {
      throw new TypeError(
        "StagehandAgentRuntime currently requires a Zod schema."
      );
    }

    const value = await abortable(
      () =>
        this.#stagehand.extract(
          instruction,
          schema as z.ZodType
        ),
      options.signal
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
    const stagehand = this.#createStagehand(browser.cdpUrl);

    try {
      await abortable(
        () => stagehand.init(),
        signal
      );
    } catch (error) {
      await stagehand.close().catch(
        () => undefined
      );
      throw error;
    }

    return new StagehandAgentSession(stagehand);
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
