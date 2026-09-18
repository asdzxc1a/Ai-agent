import type {
  BrowserRuntime,
  BrowserSession,
  BrowserSessionOptions
} from "@astra/browser-runtime";

import {
  SteelClient,
  type SteelSessionDetails
} from "./steel-client.js";

export interface SteelBrowserRuntimeOptions {
  baseUrl?: string;
  skipFingerprintInjection?: boolean;
}

class SteelBrowserSession implements BrowserSession {
  public readonly id: string;
  public readonly cdpUrl: string;
  public readonly viewerUrl?: string;

  readonly #client: SteelClient;
  #closePromise?: Promise<void>;

  public constructor(
    client: SteelClient,
    details: SteelSessionDetails
  ) {
    this.#client = client;
    this.id = details.id;
    this.cdpUrl = details.websocketUrl;

    if (details.sessionViewerUrl !== undefined) {
      this.viewerUrl = details.sessionViewerUrl;
    }
  }

  public close(): Promise<void> {
    this.#closePromise ??= this.#closeOnce();
    return this.#closePromise;
  }

  async #closeOnce(): Promise<void> {
    const current = await this.#client.getSession(this.id);

    if (current.status === "released") {
      return;
    }

    if (current.status !== "live" && current.status !== "idle") {
      throw new Error(
        `Steel session ${this.id} cannot be closed from status ${current.status}.`
      );
    }

    const released = await this.#client.releaseSession(this.id);

    if (!released.success || released.status !== "released") {
      throw new Error(
        `Steel session ${this.id} did not reach released state.`
      );
    }
  }
}

export class SteelBrowserRuntime implements BrowserRuntime {
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
    this.#skipFingerprintInjection = skipFingerprintInjection;
  }

  public async createSession(
    options: BrowserSessionOptions = {}
  ): Promise<BrowserSession> {
    const details = await this.#client.createSession({
      ...(options.headless === undefined
        ? {}
        : { headless: options.headless }),
      ...(options.viewport === undefined
        ? {}
        : { dimensions: options.viewport }),
      ...(this.#skipFingerprintInjection
        ? { skipFingerprintInjection: true }
        : {})
    });

    return new SteelBrowserSession(this.#client, details);
  }
}
