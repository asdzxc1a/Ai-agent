import type {
  BrowserDiagnostic,
  BrowserNetworkPolicy,
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions,
  BrowserScreenshotOptions
} from "@astra/browser-runtime";

import type {
  SandboxRuntime,
  SandboxSession,
  SandboxedBrowserRuntimeOptions
} from "./types.js";

class SandboxedBrowserSession
  implements BrowserSession {
  public readonly id: string;
  public readonly cdpUrl: string;
  public readonly viewerUrl?: string;
  public readonly isolationId: string;
  public readonly networkPolicy:
    BrowserNetworkPolicy;

  readonly #browser:
    BrowserSession;
  readonly #sandbox:
    SandboxSession;
  #closePromise?: Promise<void>;

  public constructor(
    browser: BrowserSession,
    sandbox: SandboxSession
  ) {
    this.#browser = browser;
    this.#sandbox = sandbox;
    this.id = browser.id;
    this.cdpUrl = browser.cdpUrl;
    this.isolationId = sandbox.id;
    this.networkPolicy =
      sandbox.networkPolicy;

    if (
      browser.viewerUrl !==
      undefined
    ) {
      this.viewerUrl =
        browser.viewerUrl;
    }
  }

  public captureScreenshot(
    options?: BrowserScreenshotOptions
  ): Promise<Uint8Array> {
    if (
      this.#browser
        .captureScreenshot ===
      undefined
    ) {
      return Promise.reject(
        new Error(
          "Browser session does not support screenshots."
        )
      );
    }

    return this.#browser
      .captureScreenshot(options);
  }

  public getDiagnostics(): Promise<BrowserDiagnostic[]> {
    if (
      this.#browser
        .getDiagnostics ===
      undefined
    ) {
      return Promise.resolve([]);
    }

    return this.#browser
      .getDiagnostics();
  }

  public close(): Promise<void> {
    this.#closePromise ??=
      this.#closeOnce();
    return this.#closePromise;
  }

  async #closeOnce(): Promise<void> {
    let browserError: unknown;

    try {
      await this.#browser.close();
    } catch (error) {
      browserError = error;
    }

    let sandboxError: unknown;

    try {
      await this.#sandbox.close();
    } catch (error) {
      sandboxError = error;
    }

    if (
      browserError !== undefined &&
      sandboxError !== undefined
    ) {
      throw new AggregateError(
        [
          browserError,
          sandboxError
        ],
        "Browser and sandbox cleanup both failed."
      );
    }

    if (browserError !== undefined) {
      throw browserError;
    }

    if (sandboxError !== undefined) {
      throw sandboxError;
    }
  }
}

export class SandboxedBrowserRuntime
  implements BrowserRuntime {
  readonly #sandboxRuntime:
    SandboxRuntime;
  readonly #browserRuntime:
    BrowserRuntime;

  public constructor({
    sandboxRuntime,
    browserRuntime
  }: SandboxedBrowserRuntimeOptions) {
    this.#sandboxRuntime =
      sandboxRuntime;
    this.#browserRuntime =
      browserRuntime;
  }

  public async createSession(
    options: BrowserSessionOptions = {}
  ): Promise<BrowserSession> {
    const sandbox =
      await this.#sandboxRuntime
        .createSession(
          options.signal ===
            undefined
            ? {}
            : {
                signal:
                  options.signal
              }
        );

    try {
      const browser =
        await this.#browserRuntime
          .createSession({
            ...options,
            ...(sandbox
              .networkProxyUrl ===
                undefined
              ? {}
              : {
                  networkProxyUrl:
                    sandbox
                      .networkProxyUrl
                })
          });

      return new SandboxedBrowserSession(
        browser,
        sandbox
      );
    } catch (error) {
      await sandbox.close().catch(
        () => undefined
      );
      throw error;
    }
  }
}
