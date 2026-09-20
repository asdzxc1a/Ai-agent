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
  ): Promise<unknown>;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const unexpected =
    Object.keys(value).find(
      (key) =>
        !allowed.includes(key)
    );

  if (
    unexpected !== undefined
  ) {
    throw new TypeError(
      "Completion verification contains unsupported fields."
    );
  }
}

export function parseCompletionVerificationResult(
  input: unknown
): CompletionVerificationResult {
  if (!isRecord(input)) {
    throw new TypeError(
      "Completion verifier must return an object."
    );
  }

  if (input.verified === true) {
    assertKnownKeys(
      input,
      ["verified"]
    );

    return {
      verified: true
    };
  }

  if (input.verified === false) {
    assertKnownKeys(
      input,
      [
        "verified",
        "goalState",
        "message"
      ]
    );

    if (
      input.goalState !==
        "FAILED" &&
      input.goalState !==
        "BLOCKED"
    ) {
      throw new TypeError(
        "Rejected completion must use FAILED or BLOCKED goal state."
      );
    }

    if (
      typeof input.message !==
        "string" ||
      input.message.trim().length ===
        0
    ) {
      throw new TypeError(
        "Rejected completion requires a non-empty message."
      );
    }

    return {
      verified: false,
      goalState:
        input.goalState,
      message:
        input.message
    };
  }

  throw new TypeError(
    "Completion verification requires boolean verified."
  );
}
