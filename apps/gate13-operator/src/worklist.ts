import type {
  ProspectResearchAttempt,
  ProspectResearchAttemptReservation,
  ProspectResearchHumanBaseline,
  ProspectResearchSample,
  ProspectResearchSampleOutcome
} from "@astra/prospect-research";

export const GATE13_ACCEPTANCE_WORKLIST_TRANSITIONS =
  [
    "RECORD_MEASURED_HUMAN_BASELINE",
    "RUN_TARGET",
    "RELEASE_ORPHAN_ATTEMPT_RESERVATION",
    "WAIT_FOR_TERMINAL_RUN",
    "REVIEW_COMPLETED_RUN",
    "RECORD_FAILED_ATTEMPT",
    "RECORD_OUTCOME",
    "COMPLETE"
  ] as const;

export type Gate13AcceptanceWorklistTransition =
  typeof GATE13_ACCEPTANCE_WORKLIST_TRANSITIONS[
    number
  ];

export type Gate13AcceptanceRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Gate13AcceptanceWorklistInput {
  targetId: string;
  companyName: string | null;
  baseline:
    | {
        id: string;
      }
    | null;
  reservation:
    | {
        runId: string;
        reservedAt: string;
      }
    | null;
  reservedRun:
    | {
        id: string;
        status:
          Gate13AcceptanceRunStatus;
      }
    | null;
  attempts:
    readonly {
      id: string;
      status:
        | "COMPLETED"
        | "FAILED";
      runId: string | null;
    }[];
  outcome:
    | {
        id: string;
        attemptId: string;
      }
    | null;
}

export interface Gate13AcceptanceWorkItem {
  targetId: string;
  companyName: string | null;
  nextTransition:
    Gate13AcceptanceWorklistTransition;
  baselineId: string | null;
  reservedRunId: string | null;
  runStatus:
    Gate13AcceptanceRunStatus | null;
  attemptId: string | null;
  outcomeId: string | null;
}

export interface Gate13AcceptanceWorklistSummary {
  targetCount: number;
  completeCount: number;
  pendingCount: number;
  countsByTransition:
    Record<
      Gate13AcceptanceWorklistTransition,
      number
    >;
}

function inconsistent(
  targetId: string,
  message: string
): never {
  throw new Error(
    "Gate 13 acceptance state is inconsistent for target " +
      targetId +
      ": " +
      message
  );
}

export function buildGate13AcceptanceWorkItem(
  input:
    Gate13AcceptanceWorklistInput
): Gate13AcceptanceWorkItem {
  if (
    input.reservedRun !==
      null &&
    (
      input.reservation ===
        null ||
      input.reservedRun.id !==
        input.reservation.runId
    )
  ) {
    inconsistent(
      input.targetId,
      "durable run does not match the measured-attempt reservation"
    );
  }

  if (
    input.outcome !==
      null &&
    input.reservation ===
      null
  ) {
    inconsistent(
      input.targetId,
      "reviewed outcome exists without a measured-attempt reservation"
    );
  }

  if (
    input.reservation !==
      null &&
    input.baseline ===
      null
  ) {
    inconsistent(
      input.targetId,
      "measured-attempt reservation exists before the durable human baseline"
    );
  }

  const matchingAttempts =
    input.reservation ===
      null
      ? []
      : input.attempts.filter(
          (attempt) =>
            attempt.runId ===
              input.reservation!
                .runId
        );

  if (
    matchingAttempts.length >
      1
  ) {
    inconsistent(
      input.targetId,
      "more than one persisted attempt references the reserved run"
    );
  }

  const attempt =
    matchingAttempts[0] ??
    null;

  if (
    input.outcome !== null
  ) {
    if (attempt === null) {
      inconsistent(
        input.targetId,
        "reviewed outcome exists before the reserved run was persisted as an attempt"
      );
    }

    if (
      input.reservedRun ===
        null ||
      input.reservedRun.status ===
        "PENDING" ||
      input.reservedRun.status ===
        "RUNNING"
    ) {
      inconsistent(
        input.targetId,
        "reviewed outcome exists without the reserved run in terminal durable state"
      );
    }

    if (
      input.outcome.attemptId !==
        attempt.id
    ) {
      inconsistent(
        input.targetId,
        "reviewed outcome references a different attempt than the reserved run"
      );
    }

    return {
      targetId:
        input.targetId,
      companyName:
        input.companyName,
      nextTransition:
        "COMPLETE",
      baselineId:
        input.baseline?.id ??
        null,
      reservedRunId:
        input.reservation
          ?.runId ??
        null,
      runStatus:
        input.reservedRun
          ?.status ??
        null,
      attemptId:
        attempt.id,
      outcomeId:
        input.outcome.id
    };
  }

  if (attempt !== null) {
    if (
      input.reservedRun ===
        null
    ) {
      inconsistent(
        input.targetId,
        "persisted attempt exists but the reserved durable run is missing"
      );
    }

    if (
      input.reservedRun.status ===
        "PENDING" ||
      input.reservedRun.status ===
        "RUNNING"
    ) {
      inconsistent(
        input.targetId,
        "persisted attempt exists before the reserved run is terminal"
      );
    }

    return {
      targetId:
        input.targetId,
      companyName:
        input.companyName,
      nextTransition:
        "RECORD_OUTCOME",
      baselineId:
        input.baseline!.id,
      reservedRunId:
        input.reservation!.runId,
      runStatus:
        input.reservedRun.status,
      attemptId:
        attempt.id,
      outcomeId:
        null
    };
  }

  if (
    input.reservation !==
      null
  ) {
    if (
      input.reservedRun ===
        null
    ) {
      return {
        targetId:
          input.targetId,
        companyName:
          input.companyName,
        nextTransition:
          "RELEASE_ORPHAN_ATTEMPT_RESERVATION",
        baselineId:
          input.baseline!.id,
        reservedRunId:
          input.reservation.runId,
        runStatus:
          null,
        attemptId:
          null,
        outcomeId:
          null
      };
    }

    const nextTransition:
      Gate13AcceptanceWorklistTransition =
      input.reservedRun
        .status ===
          "PENDING" ||
      input.reservedRun
        .status ===
          "RUNNING"
        ? "WAIT_FOR_TERMINAL_RUN"
        : input.reservedRun
            .status ===
              "COMPLETED"
          ? "REVIEW_COMPLETED_RUN"
          : "RECORD_FAILED_ATTEMPT";

    return {
      targetId:
        input.targetId,
      companyName:
        input.companyName,
      nextTransition,
      baselineId:
        input.baseline!.id,
      reservedRunId:
        input.reservation.runId,
      runStatus:
        input.reservedRun.status,
      attemptId:
        null,
      outcomeId:
        null
    };
  }

  if (
    input.baseline !==
      null
  ) {
    return {
      targetId:
        input.targetId,
      companyName:
        input.companyName,
      nextTransition:
        "RUN_TARGET",
      baselineId:
        input.baseline.id,
      reservedRunId:
        null,
      runStatus:
        null,
      attemptId:
        null,
      outcomeId:
        null
    };
  }

  return {
    targetId:
      input.targetId,
    companyName:
      input.companyName,
    nextTransition:
      "RECORD_MEASURED_HUMAN_BASELINE",
    baselineId:
      null,
    reservedRunId:
      null,
    runStatus:
      null,
    attemptId:
      null,
    outcomeId:
      null
  };
}

export function summarizeGate13AcceptanceWorklist(
  items:
    readonly Gate13AcceptanceWorkItem[]
): Gate13AcceptanceWorklistSummary {
  const countsByTransition =
    Object.fromEntries(
      GATE13_ACCEPTANCE_WORKLIST_TRANSITIONS
        .map(
          (transition) => [
            transition,
            0
          ]
        )
    ) as Record<
      Gate13AcceptanceWorklistTransition,
      number
    >;

  for (const item of items) {
    countsByTransition[
      item.nextTransition
    ] += 1;
  }

  const completeCount =
    countsByTransition.COMPLETE;

  return {
    targetCount:
      items.length,
    completeCount,
    pendingCount:
      items.length -
      completeCount,
    countsByTransition
  };
}

export interface Gate13AcceptanceWorklistRepository {
  getSample(
    sampleId: string
  ): Promise<
    ProspectResearchSample |
    undefined
  >;
  listSampleOutcomes(
    sampleId: string
  ): Promise<
    ProspectResearchSampleOutcome[]
  >;
  getHumanBaselineForTarget(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchHumanBaseline |
    undefined
  >;
  getAcceptanceAttemptReservation(
    sampleId: string,
    targetId: string
  ): Promise<
    ProspectResearchAttemptReservation |
    undefined
  >;
  listAttemptsForTarget(
    targetId: string
  ): Promise<
    ProspectResearchAttempt[]
  >;
}

export interface Gate13AcceptanceWorklistRunReader {
  getRun(
    runId: string
  ): Promise<
    | {
        id: string;
        status:
          Gate13AcceptanceRunStatus;
      }
    | undefined
  >;
}

export interface Gate13AcceptanceWorklist {
  sample: {
    id: string;
    frozenAt: string;
    targetCount: number;
  };
  summary:
    Gate13AcceptanceWorklistSummary;
  items:
    Gate13AcceptanceWorkItem[];
}

export async function loadGate13AcceptanceWorklist(
  repository:
    Gate13AcceptanceWorklistRepository,
  runReader:
    Gate13AcceptanceWorklistRunReader,
  sampleId: string
): Promise<
  Gate13AcceptanceWorklist
> {
  const sample =
    await repository.getSample(
      sampleId
    );

  if (sample === undefined) {
    throw new Error(
      "Measured research sample does not exist: " +
        sampleId
    );
  }

  if (
    sample.purpose !==
      "ACCEPTANCE"
  ) {
    throw new Error(
      "Gate 13 acceptance worklist requires an ACCEPTANCE sample."
    );
  }

  const outcomes =
    await repository
      .listSampleOutcomes(
        sampleId
      );
  const outcomeByTarget =
    new Map(
      outcomes.map(
        (outcome) =>
          [
            outcome.targetId,
            outcome
          ] as const
      )
    );

  const items =
    await Promise.all(
      sample.targets.map(
        async (
          target
        ) => {
          const [
            baseline,
            reservation,
            attempts
          ] =
            await Promise.all([
              repository
                .getHumanBaselineForTarget(
                  sampleId,
                  target.id
                ),
              repository
                .getAcceptanceAttemptReservation(
                  sampleId,
                  target.id
                ),
              repository
                .listAttemptsForTarget(
                  target.id
                )
            ]);
          const reservedRun =
            reservation ===
              undefined
              ? undefined
              : await runReader
                  .getRun(
                    reservation.runId
                  );
          const outcome =
            outcomeByTarget.get(
              target.id
            );

          return buildGate13AcceptanceWorkItem({
            targetId:
              target.id,
            companyName:
              target
                .companyNameHint,
            baseline:
              baseline ===
                undefined
                ? null
                : {
                    id:
                      baseline.id
                  },
            reservation:
              reservation ===
                undefined
                ? null
                : {
                    runId:
                      reservation
                        .runId,
                    reservedAt:
                      reservation
                        .reservedAt
                  },
            reservedRun:
              reservedRun ===
                undefined
                ? null
                : {
                    id:
                      reservedRun.id,
                    status:
                      reservedRun.status
                  },
            attempts:
              attempts.map(
                (attempt) => ({
                  id:
                    attempt.id,
                  status:
                    attempt.status,
                  runId:
                    attempt.status ===
                      "COMPLETED"
                      ? attempt
                          .report
                          .runId
                      : attempt
                          .runId
                })
              ),
            outcome:
              outcome ===
                undefined
                ? null
                : {
                    id:
                      outcome.id,
                    attemptId:
                      outcome
                        .attemptId
                  }
          });
        }
      )
    );

  return {
    sample: {
      id:
        sample.id,
      frozenAt:
        sample.frozenAt,
      targetCount:
        sample.targets.length
    },
    summary:
      summarizeGate13AcceptanceWorklist(
        items
      ),
    items
  };
}

