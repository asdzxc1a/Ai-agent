import type {
  AgentLoopTrajectoryEntry
} from "@astra/agent-loop";
import type {
  GoalState
} from "@astra/contracts";

export interface CompletionVerificationInput {
  url: string;
  goal: string;
  candidateResult: unknown;
  source:
    | "AGENT_LOOP"
    | "ONE_STEP";
  trajectory:
    readonly AgentLoopTrajectoryEntry[];
  signal: AbortSignal;
}

export type CompletionVerificationResult =
  | {
      verified: true;
    }
  | {
      verified: false;
      goalState:
        Extract<
          GoalState,
          "FAILED" | "BLOCKED"
        >;
      message: string;
    };

export interface CompletionVerifier {
  verify(
    input: CompletionVerificationInput
  ): Promise<CompletionVerificationResult>;
}
