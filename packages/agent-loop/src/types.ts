import type {
  AgentSession
} from "@astra/agent-runtime";
import type {
  ActionEffectState,
  RunTerminalReason
} from "@astra/contracts";

export interface AgentLoopActionSummary {
  selector: string;
  description: string;
  method?: string;
}

export interface AgentLoopActionOutcome {
  action: AgentLoopActionSummary;
  success: boolean;
  recoverable: boolean;
  effect: ActionEffectState;
}

export interface AgentLoopActionDecision {
  type: "ACTION";
  actionIndex: number;
  rationale: string;
  onFailure: "CONTINUE" | "FAIL";
}

export interface AgentLoopCompleteDecision {
  type: "COMPLETE";
  rationale: string;
  result?: unknown;
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
  ): Promise<unknown>;
}

export interface AgentLoopUsageSnapshot {
  modelTokens: number;
  estimatedCostUsd: number;
}

export interface AgentLoopUsageMeter {
  getUsage():
    | AgentLoopUsageSnapshot
    | Promise<AgentLoopUsageSnapshot>;
}

export interface AgentLoopBudget {
  maxSteps?: number;
  maxModelTokens?: number;
  maxEstimatedCostUsd?: number;
  maxRepeatedActionSelections?: number;
}

export interface AgentLoopActionEffectInput {
  action: AgentLoopActionSummary;
  success: boolean;
  threw: boolean;
}

export interface AgentLoopActionEffectPolicy {
  classify(
    input: AgentLoopActionEffectInput
  ):
    | ActionEffectState
    | Promise<ActionEffectState>;
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
      result: unknown;
    })
  | (AgentLoopTerminalBase & {
      type: "FAIL";
      message: string;
      reason: RunTerminalReason;
    })
  | (AgentLoopTerminalBase & {
      type: "BLOCKED";
      message: string;
      reason: RunTerminalReason;
    });

export interface AgentLoopOptions {
  goal: string;
  policy: AgentLoopPolicy;
  iterationCeiling?: number;
  budget?: AgentLoopBudget;
  usageMeter?: AgentLoopUsageMeter;
  effectPolicy?:
    AgentLoopActionEffectPolicy;
  signal?: AbortSignal;
  onProgress?(
    event: AgentLoopProgressEvent
  ): Promise<void>;
}

export interface AgentLoopExecutorOptions {
  policy: AgentLoopPolicy;
  iterationCeiling?: number;
  budget?: AgentLoopBudget;
  usageMeter?: AgentLoopUsageMeter;
  effectPolicy?:
    AgentLoopActionEffectPolicy;
}

export interface ExecuteAgentLoopInput {
  session: AgentSession;
  goal: string;
  signal?: AbortSignal;
  onProgress?(
    event: AgentLoopProgressEvent
  ): Promise<void>;
}
