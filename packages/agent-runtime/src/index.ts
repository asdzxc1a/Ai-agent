import type { BrowserSession } from "@astra/browser-runtime";

export interface RuntimeSchema<T> {
  parse(input: unknown): T;
}

export type AgentActionEffect =
  | "none"
  | "committed"
  | "unknown";

export interface AgentUsageSnapshot {
  modelTokens: number;
  modelCostUsd: number;
}

export interface AgentUsageMeter {
  snapshot():
    | AgentUsageSnapshot
    | Promise<AgentUsageSnapshot>;
}

export interface AgentOperationOptions {
  signal?: AbortSignal;
}

export interface AgentAction {
  selector: string;
  description: string;
  method?: string;
  arguments?: string[];
}

export interface AgentActionResult {
  success: boolean;
  message: string;
  actionDescription?: string;
  actions: AgentAction[];
  effect?: AgentActionEffect;
}

export interface AgentPageEvidenceSnapshot {
  url: string;
  title: string;
  text: string;
}

export interface AgentSession {
  navigate(
    url: string,
    options?: AgentOperationOptions
  ): Promise<void>;

  observe(
    instruction: string,
    options?: AgentOperationOptions
  ): Promise<AgentAction[]>;

  act(
    action: AgentAction,
    options?: AgentOperationOptions
  ): Promise<AgentActionResult>;

  extract<T>(
    instruction: string,
    schema: RuntimeSchema<T>,
    options?: AgentOperationOptions
  ): Promise<T>;

  capturePageEvidence?(
    options?: AgentOperationOptions
  ): Promise<AgentPageEvidenceSnapshot>;

  close(): Promise<void>;
}

export interface OpenAgentSessionOptions {
  browser: BrowserSession;
  signal?: AbortSignal;
}

export interface AgentRuntime {
  openSession(
    options: OpenAgentSessionOptions
  ): Promise<AgentSession>;
}
