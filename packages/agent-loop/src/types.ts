import type {
  AgentActionEffect,
  AgentSession,
  AgentUsageMeter
} from "@astra/agent-runtime";

export type AgentLoopGoalState =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export type AgentLoopEffectRisk =
  | "REVERSIBLE"
  | "IRREVERSIBLE";

export interface AgentLoopActionSummary {
  selector: string;
  description: string;
  method?: string;
}

export interface AgentLoopActionOutcome {
  action: AgentLoopActionSummary;
  success: boolean;
  recoverable: boolean;
  effect: AgentActionEffect;
  effectRisk: AgentLoopEffectRisk;
}

export interface AgentLoopActionDecision {
  type: "ACTION";
  actionIndex: number;
  rationale: string;
  onFailure: "CONTINUE" | "FAIL";
  effectRisk: AgentLoopEffectRisk;
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
  actionOutcome?: AgentLoopActionOutcome;
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

export type AgentLoopFailureReason =
  | "POLICY_REJECTED"
  | "POLICY_FAILED"
  | "INVALID_ACTION_SELECTION"
  | "ACTION_FAILED"
  | "ITERATION_LIMIT_EXCEEDED"
  | "STEP_LIMIT_EXCEEDED"
  | "MODEL_TOKEN_BUDGET_EXCEEDED"
  | "MODEL_COST_BUDGET_EXCEEDED"
  | "LOOP_DETECTED";

export type AgentLoopBlockedReason =
  | "POLICY_BLOCKED"
  | "IRREVERSIBLE_EFFECT_UNKNOWN"
  | "IRREVERSIBLE_EFFECT_COMMITTED";

export type AgentLoopLimitReason =
  | "STEP_LIMIT_EXCEEDED"
  | "MODEL_TOKEN_BUDGET_EXCEEDED"
  | "MODEL_COST_BUDGET_EXCEEDED"
  | "LOOP_DETECTED";

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
      outcome: AgentLoopActionOutcome;
      durationMs: number;
    }
  | {
      type: "DECISION_REJECTED";
      iteration: number;
      message: string;
      durationMs: number;
    }
  | {
      type: "LIMIT_REACHED";
      iteration: number;
      reason: AgentLoopLimitReason;
      message: string;
    };

interface AgentLoopTerminalBase {
  iterations: number;
  trajectory:
    readonly AgentLoopTrajectoryEntry[];
}

export type AgentLoopOutcome =
  | (AgentLoopTerminalBase & {
      type: "COMPLETE";
      goalState: "COMPLETED";
      result: unknown;
    })
  | (AgentLoopTerminalBase & {
      type: "FAIL";
      goalState: "FAILED";
      reason: AgentLoopFailureReason;
      message: string;
    })
  | (AgentLoopTerminalBase & {
      type: "BLOCKED";
      goalState: "BLOCKED";
      reason: AgentLoopBlockedReason;
      message: string;
    });

export interface AgentLoopExecutionLimits {
  maxActions?: number;
  maxModelTokens?: number;
  maxModelCostUsd?: number;
  repeatedActionLimit?: number;
}

export interface AgentLoopOptions {
  goal: string;
  policy: AgentLoopPolicy;
  iterationCeiling?: number;
  limits?: AgentLoopExecutionLimits;
  usageMeter?: AgentUsageMeter;
  signal?: AbortSignal;
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
  limits?: AgentLoopExecutionLimits;
  usageMeter?: AgentUsageMeter;
  signal?: AbortSignal;
  onProgress?(
    event: AgentLoopProgressEvent
  ): Promise<void>;
}
