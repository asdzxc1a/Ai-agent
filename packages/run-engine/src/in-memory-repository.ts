import type {
  CreateRunRequest,
  RunSnapshot
} from "@astra/contracts";

import type {
  RunEventRecord,
  RunRepository,
  RunStepRecord,
  RunTerminalUpdate,
  RunUpdate
} from "./repository.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validateTerminal(snapshot: RunSnapshot): void {
  const terminal =
    snapshot.status === "COMPLETED" ||
    snapshot.status === "FAILED" ||
    snapshot.status === "CANCELLED";

  if (!terminal) {
    if (
      snapshot.goalStatus !==
        "IN_PROGRESS" ||
      snapshot.terminalReason !==
        undefined
    ) {
      throw new Error(
        "Non-terminal runs must remain IN_PROGRESS without a terminal reason."
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
    snapshot.status === "COMPLETED"
  ) {
    if (
      snapshot.goalStatus !==
        "COMPLETED" ||
      snapshot.result === undefined
    ) {
      throw new Error(
        "COMPLETED runs must contain a validated result and COMPLETED goal state."
      );
    }

    return;
  }

  if (
    snapshot.status === "CANCELLED"
  ) {
    if (
      snapshot.goalStatus !==
      "FAILED"
    ) {
      throw new Error(
        "CANCELLED runs must use FAILED goal state."
      );
    }

    return;
  }

  if (
    snapshot.error === undefined ||
    (
      snapshot.goalStatus !==
        "FAILED" &&
      snapshot.goalStatus !==
        "BLOCKED"
    )
  ) {
    throw new Error(
      "FAILED runs must contain a typed error and FAILED or BLOCKED goal state."
    );
  }
}

function isTerminalStatus(
  status: RunSnapshot["status"]
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

function terminalEventType(
  status:
    RunTerminalUpdate["status"]
): string {
  switch (status) {
    case "COMPLETED":
      return "RUN_COMPLETED";
    case "FAILED":
      return "RUN_FAILED";
    case "CANCELLED":
      return "RUN_CANCELLED";
  }
}

export class InMemoryRunRepository implements RunRepository {
  readonly #runs = new Map<string, RunSnapshot>();
  readonly #requests = new Map<string, CreateRunRequest>();
  readonly #steps = new Map<string, RunStepRecord[]>();
  readonly #events = new Map<string, RunEventRecord[]>();

  public async createRun(
    snapshot: RunSnapshot,
    request: CreateRunRequest
  ): Promise<void> {
    if (this.#runs.has(snapshot.id)) {
      throw new Error(`Run ${snapshot.id} already exists.`);
    }

    this.#runs.set(snapshot.id, clone(snapshot));
    this.#requests.set(snapshot.id, clone(request));
    this.#steps.set(snapshot.id, []);
    this.#events.set(snapshot.id, []);
  }

  public async getRun(
    runId: string
  ): Promise<RunSnapshot | undefined> {
    const snapshot = this.#runs.get(runId);
    return snapshot === undefined
      ? undefined
      : clone(snapshot);
  }

  public async getRequest(
    runId: string
  ): Promise<CreateRunRequest | undefined> {
    const request = this.#requests.get(runId);
    return request === undefined
      ? undefined
      : clone(request);
  }

  public async listActiveRuns():
    Promise<RunSnapshot[]> {
    return clone(
      [...this.#runs.values()]
        .filter(
          (run) =>
            run.status ===
              "PENDING" ||
            run.status ===
              "RUNNING"
        )
    );
  }

  public async updateRun(
    runId: string,
    update: RunUpdate
  ): Promise<RunSnapshot> {
    const current = this.#runs.get(runId);

    if (current === undefined) {
      throw new Error(`Run ${runId} does not exist.`);
    }

    const next: RunSnapshot = {
      ...current,
      ...clone(update),
      updatedAt: new Date().toISOString()
    };

    if (
      isTerminalStatus(
        next.status
      )
    ) {
      throw new Error(
        "Terminal runs must use finalizeRun()."
      );
    }

    validateTerminal(next);
    this.#runs.set(runId, next);
    return clone(next);
  }

  public async finalizeRun(
    runId: string,
    update: RunTerminalUpdate,
    eventPayload: unknown
  ): Promise<RunSnapshot> {
    const current =
      this.#runs.get(runId);
    const records =
      this.#events.get(runId);

    if (
      current === undefined ||
      records === undefined
    ) {
      throw new Error(
        `Run ${runId} does not exist.`
      );
    }

    if (
      isTerminalStatus(
        current.status
      )
    ) {
      throw new Error(
        `Run ${runId} is already terminal.`
      );
    }

    const now =
      new Date().toISOString();
    const next:
      RunSnapshot = {
        ...current,
        ...clone(update),
        updatedAt: now
      };

    validateTerminal(next);

    const record:
      RunEventRecord = {
        runId,
        sequenceNumber:
          records.length + 1,
        eventType:
          terminalEventType(
            update.status
          ),
        payload:
          clone(eventPayload),
        createdAt: now
      };

    this.#runs.set(
      runId,
      next
    );
    records.push(record);

    return clone(next);
  }

  public async appendStep(
    runId: string,
    kind: string,
    payload: unknown
  ): Promise<RunStepRecord> {
    const records = this.#steps.get(runId);

    if (records === undefined) {
      throw new Error(`Run ${runId} does not exist.`);
    }

    const record: RunStepRecord = {
      runId,
      sequenceNumber: records.length + 1,
      kind,
      payload: clone(payload),
      createdAt: new Date().toISOString()
    };

    records.push(record);
    return clone(record);
  }

  public async appendEvent(
    runId: string,
    eventType: string,
    payload: unknown
  ): Promise<RunEventRecord> {
    const records = this.#events.get(runId);

    if (records === undefined) {
      throw new Error(`Run ${runId} does not exist.`);
    }

    const record: RunEventRecord = {
      runId,
      sequenceNumber: records.length + 1,
      eventType,
      payload: clone(payload),
      createdAt: new Date().toISOString()
    };

    records.push(record);
    return clone(record);
  }

  public async listSteps(
    runId: string
  ): Promise<RunStepRecord[]> {
    return clone(this.#steps.get(runId) ?? []);
  }

  public async listEvents(
    runId: string
  ): Promise<RunEventRecord[]> {
    return clone(this.#events.get(runId) ?? []);
  }

  public async listEventsAfter(
    runId: string,
    afterSequence: number,
    limit = 100
  ): Promise<RunEventRecord[]> {
    if (
      !Number.isInteger(afterSequence) ||
      afterSequence < 0 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      throw new RangeError(
        "Event cursor and limit must be positive integers."
      );
    }

    const records = this.#events.get(runId) ?? [];

    return clone(
      records
        .filter(
          (record) =>
            record.sequenceNumber > afterSequence
        )
        .slice(0, limit)
    );
  }
}
