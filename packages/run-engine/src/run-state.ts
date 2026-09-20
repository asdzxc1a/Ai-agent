import type {
  RunSnapshot
} from "@astra/contracts";

import type {
  RunUpdate
} from "./repository.js";

function isTerminalStatus(
  status: RunSnapshot["status"]
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

export function validateRunSnapshot(
  snapshot: RunSnapshot
): void {
  if (
    snapshot.status === "PENDING" ||
    snapshot.status === "RUNNING"
  ) {
    if (
      snapshot.goalState !==
      "IN_PROGRESS"
    ) {
      throw new Error(
        "Non-terminal runs must have goalState IN_PROGRESS."
      );
    }

    if (
      snapshot.terminalReason !==
        undefined ||
      snapshot.result !== undefined ||
      snapshot.error !== undefined
    ) {
      throw new Error(
        "Non-terminal runs cannot contain terminal result, error, or reason."
      );
    }

    return;
  }

  if (
    snapshot.terminalReason ===
    undefined
  ) {
    throw new Error(
      "Terminal runs must contain a typed terminal reason."
    );
  }

  if (
    snapshot.status ===
    "COMPLETED"
  ) {
    if (
      snapshot.goalState !==
      "COMPLETED"
    ) {
      throw new Error(
        "COMPLETED runs must have goalState COMPLETED."
      );
    }

    if (
      snapshot.result ===
      undefined
    ) {
      throw new Error(
        "COMPLETED runs must contain a validated result."
      );
    }

    if (
      snapshot.terminalReason
        .code !==
      "GOAL_VERIFIED"
    ) {
      throw new Error(
        "COMPLETED runs must use GOAL_VERIFIED as the terminal reason."
      );
    }

    if (
      snapshot.error !== undefined
    ) {
      throw new Error(
        "COMPLETED runs cannot contain an error."
      );
    }

    return;
  }

  if (
    snapshot.status ===
    "CANCELLED"
  ) {
    if (
      snapshot.goalState !==
      "BLOCKED"
    ) {
      throw new Error(
        "CANCELLED runs must have goalState BLOCKED."
      );
    }

    if (
      snapshot.terminalReason
        .code !== "CANCELLED" ||
      snapshot.error?.code !==
        "CANCELLED"
    ) {
      throw new Error(
        "CANCELLED runs must contain matching CANCELLED reason and error."
      );
    }

    if (
      snapshot.result !== undefined
    ) {
      throw new Error(
        "CANCELLED runs cannot contain a result."
      );
    }

    return;
  }

  if (
    snapshot.goalState !==
      "FAILED" &&
    snapshot.goalState !==
      "BLOCKED"
  ) {
    throw new Error(
      "FAILED runs must have goalState FAILED or BLOCKED."
    );
  }

  if (
    snapshot.error === undefined
  ) {
    throw new Error(
      "FAILED runs must contain a typed error."
    );
  }

  if (
    snapshot.terminalReason.code !==
    snapshot.error.code
  ) {
    throw new Error(
      "FAILED run error and terminal reason codes must match."
    );
  }

  if (
    snapshot.result !== undefined
  ) {
    throw new Error(
      "FAILED runs cannot contain a result."
    );
  }
}

export function applyRunUpdate(
  current: RunSnapshot,
  update: RunUpdate,
  updatedAt =
    new Date().toISOString()
): RunSnapshot {
  if (
    isTerminalStatus(
      current.status
    )
  ) {
    throw new Error(
      "Run " +
        current.id +
        " is already terminal (" +
        current.status +
        ")."
    );
  }

  const next: RunSnapshot = {
    ...current,
    ...structuredClone(update),
    updatedAt
  };

  if (
    current.status ===
      "PENDING" &&
    next.status !== "PENDING" &&
    next.status !== "RUNNING" &&
    next.status !== "FAILED" &&
    next.status !== "CANCELLED"
  ) {
    throw new Error(
      "Invalid run transition PENDING -> " +
        next.status +
        "."
    );
  }

  if (
    current.status ===
      "RUNNING" &&
    next.status === "PENDING"
  ) {
    throw new Error(
      "Invalid run transition RUNNING -> PENDING."
    );
  }

  validateRunSnapshot(next);
  return next;
}
