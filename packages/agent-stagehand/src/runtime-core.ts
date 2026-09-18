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
    if (!(schema instanceof z.ZodType)) {
      throw new TypeError(
        "StagehandAgentRuntime currently requires a Zod schema."
      );
    }

    const value = await this.#stagehand.extract(
      instruction,
      schema as z.ZodType<T>
    );

    return schema.parse(value);
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
    browser
  }: OpenAgentSessionOptions): Promise<AgentSession> {
    const stagehand = this.#createStagehand(browser.cdpUrl);
    await stagehand.init();

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
