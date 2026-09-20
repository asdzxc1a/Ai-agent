import type {
  BrowserNetworkPolicy,
  BrowserRuntime
} from "@astra/browser-runtime";

export type SandboxStatus =
  | "ACTIVE"
  | "CLOSED";

export interface SandboxSession {
  readonly id: string;
  readonly status: SandboxStatus;
  readonly networkPolicy:
    BrowserNetworkPolicy;

  close(): Promise<void>;
}

export interface SandboxSessionOptions {
  signal?: AbortSignal;
}

export interface SandboxRuntime {
  createSession(
    options?: SandboxSessionOptions
  ): Promise<SandboxSession>;
}

export interface SandboxedBrowserRuntimeOptions {
  sandboxRuntime: SandboxRuntime;
  browserRuntime: BrowserRuntime;
}
