import type { BrowserSession } from "@astra/browser-runtime";

export interface RuntimeSchema<T> {
  parse(input: unknown): T;
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
}

export interface AgentSession {
  navigate(url: string): Promise<void>;
  observe(instruction: string): Promise<AgentAction[]>;
  act(action: AgentAction): Promise<AgentActionResult>;
  extract<T>(instruction: string, schema: RuntimeSchema<T>): Promise<T>;
  close(): Promise<void>;
}

export interface OpenAgentSessionOptions {
  browser: BrowserSession;
  signal?: AbortSignal;
}

export interface AgentRuntime {
  openSession(options: OpenAgentSessionOptions): Promise<AgentSession>;
}
