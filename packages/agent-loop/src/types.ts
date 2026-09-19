import type {
  AgentSession
} from "@astra/agent-runtime";

export interface AgentLoopActionSummary {
  selector: string;
  description: string;
  method?: string;
}

export interface AgentLoopActionOutcome {
  action: AgentLoopActionSummary;
  success: boolean;
  message: string;
}

export interface AgentLoopActionDecision {
  type: "ACTION";
  actionIndex: number;
  rationale: string;
}

export interface AgentLoopCompleteDecision {
  type: "COMPLETE";
  rationale: string;
}

export interface AgentLoopFailDecision {
  type: "FAIL";
  message: string;
  rationale?: string;
}

export interface AgentLoopBlockedDecision {
  type: "BLOCKED";
  message: string;
  rationale?: string;
}

export type AgentLoopDecision =
  | AgentLoopActionDecision
  | AgentLoopCompleteDecision
  | AgentLoopFailDecision
  | AgentLoopBlockedDecision;

export interface AgentLoopTrajectoryEntry {
  iteration: number;
  observedActions:
    readonly AgentLoopActionSummary[];
  decision: AgentLoopDecision;
  actionOutcome?:
    AgentLoopActionOutcome;
}

export interface AgentLoopPolicyInput {
  goal: string;
  iteration: number;
  observedActions:
    readonly AgentLoopActionSummary[];
  trajectory:
    readonly AgentLoopTrajectoryEntry[];
}

export interface AgentLoopPolicy {
  decide(
    input: AgentLoopPolicyInput
  ): Promise<AgentLoopDecision>;
}

export type AgentLoopProgressEvent =
  | {
      type: "OBSERVED";
      iteration: number;
      actions:
        readonly AgentLoopActionSummary[];
      durationMs: number;
    }
  | {
      type: "DECIDED";
      iteration: number;
      decision: AgentLoopDecision;
      durationMs: number;
    }
  | {
      type: "ACTED";
      iteration: number;
      outcome:
        AgentLoopActionOutcome;
      durationMs: number;
    }
  | {
      type: "DECISION_REJECTED";
      iteration: number;
      message: string;
      durationMs: number;
    };

interface AgentLoopTerminalBase {
  iterations: number;
  trajectory:
    readonly AgentLoopTrajectoryEntry[];
}

export type AgentLoopOutcome =
  | (AgentLoopTerminalBase & {
      type: "COMPLETE";
    })
  | (AgentLoopTerminalBase & {
      type: "FAIL";
      message: string;
    })
  | (AgentLoopTerminalBase & {
      type: "BLOCKED";
      message: string;
    });

export interface AgentLoopOptions {
  goal: string;
  policy: AgentLoopPolicy;
  iterationCeiling?: number;
  onProgress?(
    event: AgentLoopProgressEvent
  ): Promise<void>;
}

export interface AgentLoopExecutorOptions {
  policy: AgentLoopPolicy;
  iterationCeiling?: number;
}

export interface ExecuteAgentLoopInput {
  session: AgentSession;
  goal: string;
  onProgress?(
    event: AgentLoopProgressEvent
  ): Promise<void>;
}
