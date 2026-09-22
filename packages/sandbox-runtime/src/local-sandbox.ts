import {
  randomUUID
} from "node:crypto";

import {
  ConnectionBoundEgressProxy,
  type ConnectionBoundEgressProxyOptions
} from "./connection-bound-proxy.js";
import {
  DefaultSandboxNetworkPolicy,
  type SandboxNetworkPolicyOptions
} from "./network-policy.js";

import type {
  SandboxRuntime,
  SandboxSession,
  SandboxSessionOptions,
  SandboxStatus
} from "./types.js";

class LocalSandboxSession
  implements SandboxSession {
  public readonly id =
    randomUUID();
  public readonly networkPolicy:
    DefaultSandboxNetworkPolicy;
  public readonly networkProxyUrl?:
    string;

  readonly #proxy?:
    ConnectionBoundEgressProxy;
  #status: SandboxStatus =
    "ACTIVE";
  #closePromise?:
    Promise<void>;

  public constructor(
    policy:
      DefaultSandboxNetworkPolicy,
    proxy?:
      ConnectionBoundEgressProxy
  ) {
    this.networkPolicy =
      policy;

    if (
      proxy !== undefined
    ) {
      this.#proxy =
        proxy;
      this.networkProxyUrl =
        proxy.proxyUrl;
    }
  }

  public get status(): SandboxStatus {
    return this.#status;
  }

  public close(): Promise<void> {
    this.#closePromise ??=
      this.#closeOnce();

    return this.#closePromise;
  }

  async #closeOnce():
    Promise<void> {
    try {
      await this.#proxy
        ?.close();
    } finally {
      this.#status =
        "CLOSED";
    }
  }
}

export interface LocalSandboxRuntimeOptions
  extends SandboxNetworkPolicyOptions {
  connectionProxy?:
    ConnectionBoundEgressProxyOptions;
}

export class LocalSandboxRuntime
  implements SandboxRuntime {
  readonly #policyOptions:
    SandboxNetworkPolicyOptions;
  readonly #connectionProxy?:
    ConnectionBoundEgressProxyOptions;

  public constructor(
    {
      connectionProxy,
      ...policyOptions
    }:
      LocalSandboxRuntimeOptions = {}
  ) {
    this.#policyOptions =
      policyOptions;

    if (
      connectionProxy !==
        undefined
    ) {
      this.#connectionProxy =
        connectionProxy;
    }
  }

  public async createSession(
    options: SandboxSessionOptions = {}
  ): Promise<SandboxSession> {
    if (options.signal?.aborted) {
      throw (
        options.signal.reason ??
        new DOMException(
          "The operation was aborted.",
          "AbortError"
        )
      );
    }

    const policy =
      new DefaultSandboxNetworkPolicy(
        this.#policyOptions
      );
    const proxy =
      this.#connectionProxy ===
        undefined
        ? undefined
        : await ConnectionBoundEgressProxy
            .start(
              policy,
              this.#connectionProxy
            );

    if (options.signal?.aborted) {
      await proxy
        ?.close()
        .catch(
          () => undefined
        );
      throw (
        options.signal.reason ??
        new DOMException(
          "The operation was aborted.",
          "AbortError"
        )
      );
    }

    return new LocalSandboxSession(
      policy,
      proxy
    );
  }
}
