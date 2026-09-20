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
import type {
  BrowserNetworkPolicy
} from "@astra/browser-runtime";

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

async function installNetworkPolicy(
  stagehand: Stagehand,
  policy: BrowserNetworkPolicy
): Promise<void> {
  if (
    policy.domainPolicy ===
    undefined
  ) {
    return;
  }

  await stagehand.context
    .setDomainPolicy({
      ...(policy.domainPolicy
        .allowedDomains ===
        undefined
        ? {}
        : {
            allowedDomains: [
              ...policy.domainPolicy
                .allowedDomains
            ]
          }),
      ...(policy.domainPolicy
        .blockedDomains ===
        undefined
        ? {}
        : {
            blockedDomains: [
              ...policy.domainPolicy
                .blockedDomains
            ]
          })
    });
}

function httpOrigin(
  value: string
): string | undefined {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

async function clearIsolatedBrowserState(
  stagehand: Stagehand,
  origins:
    ReadonlySet<string>
): Promise<void> {
  const failures: unknown[] = [];

  try {
    await stagehand.context
      .clearCookies();
  } catch (error) {
    failures.push(error);
  }

  const page =
    stagehand.context.pages()[0];

  if (
    page === undefined &&
    origins.size > 0
  ) {
    failures.push(
      new Error(
        "Cannot clear isolated origin storage without an active page."
      )
    );
  }

  if (page !== undefined) {
    for (const origin of origins) {
      try {
        await page.sendCDP(
          "Storage.clearDataForOrigin",
          {
            origin,
            storageTypes: "all"
          }
        );
      } catch (error) {
        failures.push(error);
      }
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Failed to clear isolated browser state."
    );
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
  readonly #networkPolicy?:
    BrowserNetworkPolicy;
  readonly #isolated: boolean;
  readonly #visitedOrigins =
    new Set<string>();
  #closePromise?: Promise<void>;

  public constructor(
    stagehand: Stagehand,
    networkPolicy?:
      BrowserNetworkPolicy,
    isolated = false
  ) {
    this.#stagehand = stagehand;
    this.#isolated = isolated;

    if (
      networkPolicy !== undefined
    ) {
      this.#networkPolicy =
        networkPolicy;
    }
  }

  #rememberOrigin(
    value: string
  ): void {
    const origin =
      httpOrigin(value);

    if (origin !== undefined) {
      this.#visitedOrigins.add(
        origin
      );
    }
  }

  #rememberCurrentOrigins(): void {
    for (
      const page of
      this.#stagehand.context.pages()
    ) {
      this.#rememberOrigin(
        page.url()
      );
    }
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
      async () => {
        await this.#networkPolicy
          ?.assertAllowed({
            url,
            isNavigation: true
          });
        this.#rememberOrigin(url);
        await page.goto(url);
        this.#rememberCurrentOrigins();
      },
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
    this.#rememberCurrentOrigins();
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

    this.#rememberCurrentOrigins();

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

    this.#rememberCurrentOrigins();
    return parse(value);
  }

  public close(): Promise<void> {
    this.#closePromise ??=
      this.#closeOnce();
    return this.#closePromise;
  }

  async #closeOnce(): Promise<void> {
    let cleanupError: unknown;

    if (this.#isolated) {
      try {
        this.#rememberCurrentOrigins();
        await clearIsolatedBrowserState(
          this.#stagehand,
          this.#visitedOrigins
        );
      } catch (error) {
        cleanupError = error;
      }
    }

    let closeError: unknown;

    try {
      await this.#stagehand.close();
    } catch (error) {
      closeError = error;
    }

    if (
      cleanupError !== undefined &&
      closeError !== undefined
    ) {
      throw new AggregateError(
        [
          cleanupError,
          closeError
        ],
        "Isolated browser-state cleanup and Stagehand close both failed."
      );
    }

    if (cleanupError !== undefined) {
      throw cleanupError;
    }

    if (closeError !== undefined) {
      throw closeError;
    }
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

      if (
        browser.networkPolicy !==
        undefined
      ) {
        await abortable(
          () =>
            installNetworkPolicy(
              stagehand,
              browser.networkPolicy!
            ),
          signal
        );
      }
    } catch (error) {
      await stagehand.close().catch(
        () => undefined
      );
      throw error;
    }

    return new StagehandAgentSession(
      stagehand,
      browser.networkPolicy,
      browser.isolationId !==
        undefined
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
