import type {
  BrowserDiagnostic,
  BrowserDiagnosticKind,
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions,
  BrowserScreenshotOptions
} from "@astra/browser-runtime";

import {
  SteelClient,
  type SteelSessionDetails
} from "./steel-client.js";

export interface SteelBrowserRuntimeOptions {
  baseUrl?: string;
  skipFingerprintInjection?: boolean;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object"
  );
}

function diagnosticKind(
  type: string
): BrowserDiagnosticKind | undefined {
  switch (type) {
    case "Console":
      return "console";
    case "PageError":
      return "page-error";
    case "BrowserError":
      return "browser-error";
    case "RequestFailed":
      return "request-failed";
    case "Error":
      return "error";
    default:
      return undefined;
  }
}

function mapDiagnostic(
  value: unknown
): BrowserDiagnostic | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type =
    typeof value.type === "string"
      ? value.type
      : undefined;
  const kind =
    type === undefined
      ? undefined
      : diagnosticKind(type);

  if (kind === undefined) {
    return undefined;
  }

  const base = {
    kind,
    ...(typeof value.timestamp === "string"
      ? {
          timestamp: value.timestamp
        }
      : {})
  };

  if (
    isRecord(value.console) &&
    typeof value.console.text === "string"
  ) {
    return {
      ...base,
      message: value.console.text,
      ...(typeof value.console.level === "string"
        ? {
            level: value.console.level
          }
        : {}),
      ...(typeof value.console.loc === "string"
        ? {
            location: value.console.loc
          }
        : {})
    };
  }

  if (
    isRecord(value.error) &&
    typeof value.error.message === "string"
  ) {
    return {
      ...base,
      message: value.error.message,
      ...(typeof value.error.url === "string"
        ? {
            url: value.error.url
          }
        : {})
    };
  }

  if (typeof value.message === "string") {
    return {
      ...base,
      message: value.message,
      ...(typeof value.logLevel === "string"
        ? {
            level: value.logLevel
          }
        : {}),
      ...(typeof value.loc === "string"
        ? {
            location: value.loc
          }
        : {})
    };
  }

  return undefined;
}

class SteelBrowserSession implements BrowserSession {
  public readonly id: string;
  public readonly cdpUrl: string;
  public readonly viewerUrl?: string;

  readonly #client: SteelClient;
  readonly #createdAt: string;
  #closePromise?: Promise<void>;

  public constructor(
    client: SteelClient,
    details: SteelSessionDetails
  ) {
    this.#client = client;
    this.id = details.id;
    this.cdpUrl = details.websocketUrl;
    this.#createdAt =
      details.createdAt ??
      new Date().toISOString();

    if (details.sessionViewerUrl !== undefined) {
      this.viewerUrl = details.sessionViewerUrl;
    }
  }

  public captureScreenshot(
    options: BrowserScreenshotOptions = {}
  ): Promise<Uint8Array> {
    return this.#client.captureScreenshot(
      options
    );
  }

  public async getDiagnostics(): Promise<BrowserDiagnostic[]> {
    const result = await this.#client.queryLogs({
      startTime: this.#createdAt,
      eventTypes: [
        "Console",
        "PageError",
        "BrowserError",
        "Error",
        "RequestFailed"
      ],
      limit: 1000
    });

    return result.events
      .map(mapDiagnostic)
      .filter(
        (entry): entry is BrowserDiagnostic =>
          entry !== undefined
      );
  }

  public close(): Promise<void> {
    this.#closePromise ??= this.#closeOnce();
    return this.#closePromise;
  }

  async #closeOnce(): Promise<void> {
    const current =
      await this.#client.getSession(this.id);

    if (current.status === "released") {
      return;
    }

    if (
      current.status !== "live" &&
      current.status !== "idle"
    ) {
      throw new Error(
        `Steel session ${this.id} cannot be closed from status ${current.status}.`
      );
    }

    const released =
      await this.#client.releaseSession(this.id);

    if (
      !released.success ||
      released.status !== "released"
    ) {
      throw new Error(
        `Steel session ${this.id} did not reach released state.`
      );
    }
  }
}

function throwIfAborted(
  signal: AbortSignal | undefined
): void {
  if (signal?.aborted !== true) {
    return;
  }

  const error =
    new Error(
      "Browser session creation aborted."
    );
  error.name = "AbortError";
  throw error;
}

export class SteelBrowserRuntime
  implements BrowserRuntime {
  readonly #client: SteelClient;
  readonly #skipFingerprintInjection: boolean;

  public constructor({
    baseUrl,
    skipFingerprintInjection = false
  }: SteelBrowserRuntimeOptions = {}) {
    this.#client =
      baseUrl === undefined
        ? new SteelClient()
        : new SteelClient(baseUrl);
    this.#skipFingerprintInjection =
      skipFingerprintInjection;
  }

  public async createSession(
    options: BrowserSessionOptions = {}
  ): Promise<BrowserSession> {
    // Reject before the request starts. Once Steel session creation is
    // in flight, keep the request alive so RunEngine receives the session
    // id and can deterministically release it after observing cancellation.
    throwIfAborted(
      options.signal
    );

    const details =
      await this.#client.createSession({
        ...(options.headless === undefined
          ? {}
          : {
              headless: options.headless
            }),
        ...(options.viewport === undefined
          ? {}
          : {
              dimensions: options.viewport
            }),
        ...(this.#skipFingerprintInjection
          ? {
              skipFingerprintInjection: true
            }
          : {})
      });

    return new SteelBrowserSession(
      this.#client,
      details
    );
  }
}
