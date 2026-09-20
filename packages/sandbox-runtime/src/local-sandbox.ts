import {
  randomUUID
} from "node:crypto";

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

  #status: SandboxStatus =
    "ACTIVE";

  public constructor(
    policyOptions:
      SandboxNetworkPolicyOptions
  ) {
    this.networkPolicy =
      new DefaultSandboxNetworkPolicy(
        policyOptions
      );
  }

  public get status(): SandboxStatus {
    return this.#status;
  }

  public async close(): Promise<void> {
    this.#status = "CLOSED";
  }
}

export type LocalSandboxRuntimeOptions =
  SandboxNetworkPolicyOptions;

export class LocalSandboxRuntime
  implements SandboxRuntime {
  readonly #policyOptions:
    LocalSandboxRuntimeOptions;

  public constructor(
    options:
      LocalSandboxRuntimeOptions = {}
  ) {
    this.#policyOptions = options;
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

    return new LocalSandboxSession(
      this.#policyOptions
    );
  }
}
