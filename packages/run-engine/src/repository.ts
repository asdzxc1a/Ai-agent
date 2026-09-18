import type {
  CreateRunRequest,
  RunFailure,
  RunSnapshot,
  RunStatus
} from "@astra/contracts";

export interface RunUpdate {
  status?: RunStatus;
  result?: unknown;
  error?: RunFailure;
}

export interface RunStepRecord {
  runId: string;
  sequenceNumber: number;
  kind: string;
  payload: unknown;
  createdAt: string;
}

export interface RunEventRecord {
  runId: string;
  sequenceNumber: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

export interface RunRepository {
  createRun(
    snapshot: RunSnapshot,
    request: CreateRunRequest
  ): Promise<void>;

  getRun(runId: string): Promise<RunSnapshot | undefined>;

  getRequest(
    runId: string
  ): Promise<CreateRunRequest | undefined>;

  updateRun(
    runId: string,
    update: RunUpdate
  ): Promise<RunSnapshot>;

  appendStep(
    runId: string,
    kind: string,
    payload: unknown
  ): Promise<RunStepRecord>;

  appendEvent(
    runId: string,
    eventType: string,
    payload: unknown
  ): Promise<RunEventRecord>;

  listSteps(runId: string): Promise<RunStepRecord[]>;
  listEvents(runId: string): Promise<RunEventRecord[]>;

  listEventsAfter(
    runId: string,
    afterSequence: number,
    limit?: number
  ): Promise<RunEventRecord[]>;
}
