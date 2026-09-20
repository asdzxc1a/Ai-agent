import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import type {
  ApiErrorCode,
  ApiErrorResponse,
  CreateRunAccepted,
  RunSnapshot
} from "@astra/contracts";
import type {
  RunEventRecord,
  RunService
} from "@astra/run-engine";

import {
  ApiInputError,
  compileOutputSchema,
  parseCreateRunRequest
} from "./schema.js";

const MAX_REQUEST_BYTES = 64 * 1024;
const EVENT_POLL_INTERVAL_MS = 50;
const EVENT_BATCH_SIZE = 100;

class RequestError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;

  public constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function safeDownloadName(
  name: string
): string {
  const safe = name.replace(
    /[^A-Za-z0-9._-]/g,
    "_"
  );
  return safe.length === 0
    ? "artifact.bin"
    : safe;
}

async function readJsonBody(
  request: IncomingMessage
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    bytes += buffer.length;

    if (bytes > MAX_REQUEST_BYTES) {
      throw new RequestError(
        413,
        "REQUEST_TOO_LARGE",
        "Request body exceeds 64 KiB."
      );
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new RequestError(
      400,
      "INVALID_REQUEST",
      "Request body must contain JSON."
    );
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString("utf8")
    ) as unknown;
  } catch {
    throw new RequestError(
      400,
      "INVALID_REQUEST",
      "Request body must be valid JSON."
    );
  }
}

function apiError(
  code: ApiErrorCode,
  message: string
): ApiErrorResponse {
  return {
    error: {
      code,
      message
    }
  };
}

function parseLastEventId(
  request: IncomingMessage
): number {
  const raw =
    request.headers["last-event-id"];

  if (raw === undefined) {
    return 0;
  }

  if (Array.isArray(raw)) {
    throw new RequestError(
      400,
      "INVALID_REQUEST",
      "Last-Event-ID must contain one non-negative integer."
    );
  }

  const value = raw.trim();

  if (!/^\d+$/.test(value)) {
    throw new RequestError(
      400,
      "INVALID_REQUEST",
      "Last-Event-ID must be a non-negative integer."
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new RequestError(
      400,
      "INVALID_REQUEST",
      "Last-Event-ID is outside the supported integer range."
    );
  }

  return parsed;
}

function isTerminalRun(
  run: RunSnapshot
): boolean {
  return (
    run.status === "COMPLETED" ||
    run.status === "FAILED" ||
    run.status === "CANCELLED"
  );
}

function isTerminalEvent(
  event: RunEventRecord
): boolean {
  return (
    event.eventType === "RUN_COMPLETED" ||
    event.eventType === "RUN_FAILED" ||
    event.eventType === "RUN_CANCELLED"
  );
}

function formatSseEvent(
  event: RunEventRecord
): string {
  return [
    `id: ${event.sequenceNumber}`,
    `event: ${event.eventType}`,
    `data: ${JSON.stringify(event)}`,
    "",
    ""
  ].join("\n");
}

async function streamRunEvents(
  response: ServerResponse,
  runService: RunService,
  runId: string,
  afterSequence: number
): Promise<void> {
  const initialRun =
    await runService.getRun(runId);

  if (initialRun === undefined) {
    throw new RequestError(
      404,
      "RUN_NOT_FOUND",
      "Run not found."
    );
  }

  const controller =
    new AbortController();

  response.once("close", () => {
    controller.abort();
  });

  response.writeHead(200, {
    "content-type":
      "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "x-accel-buffering": "no"
  });
  response.flushHeaders();

  let cursor = afterSequence;

  try {
    while (!controller.signal.aborted) {
      const events =
        await runService.listEventsAfter(
          runId,
          cursor,
          EVENT_BATCH_SIZE
        );

      let terminalDelivered = false;

      for (const event of events) {
        if (controller.signal.aborted) {
          return;
        }

        cursor = event.sequenceNumber;
        response.write(
          formatSseEvent(event)
        );

        if (isTerminalEvent(event)) {
          terminalDelivered = true;
          break;
        }
      }

      if (terminalDelivered) {
        response.end();
        return;
      }

      if (
        events.length ===
        EVENT_BATCH_SIZE
      ) {
        continue;
      }

      const run =
        await runService.getRun(runId);

      if (
        run === undefined ||
        isTerminalRun(run)
      ) {
        response.end();
        return;
      }

      try {
        await delay(
          EVENT_POLL_INTERVAL_MS,
          undefined,
          {
            signal: controller.signal
          }
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        throw error;
      }
    }
  } finally {
    if (
      !response.writableEnded &&
      !response.destroyed
    ) {
      response.end();
    }
  }
}

async function requireRun(
  runService: RunService,
  runId: string
): Promise<RunSnapshot> {
  const run = await runService.getRun(runId);

  if (run === undefined) {
    throw new RequestError(
      404,
      "RUN_NOT_FOUND",
      "Run not found."
    );
  }

  return run;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  runService: RunService
): Promise<void> {
  const requestUrl = new URL(
    request.url ?? "/",
    "http://api.local"
  );

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/v1/runs"
  ) {
    const raw = await readJsonBody(request);

    let parsed;
    try {
      parsed =
        parseCreateRunRequest(raw);
    } catch (error) {
      if (error instanceof ApiInputError) {
        throw new RequestError(
          400,
          error.code,
          error.message
        );
      }

      throw error;
    }

    const run =
      await runService.createRun({
        request: parsed,
        ...(parsed.outputSchema === undefined
          ? {}
          : {
              outputSchema:
                compileOutputSchema(
                  parsed.outputSchema
                )
            })
      });

    const accepted: CreateRunAccepted = {
      runId: run.id,
      status: run.status
    };

    sendJson(response, 202, accepted);
    return;
  }

  const artifactDownloadMatch =
    requestUrl.pathname.match(
      /^\/v1\/runs\/([^/]+)\/artifacts\/([^/]+)$/
    );

  if (
    request.method === "GET" &&
    artifactDownloadMatch?.[1] &&
    artifactDownloadMatch[2]
  ) {
    const runId = decodeURIComponent(
      artifactDownloadMatch[1]
    );
    const artifactId = decodeURIComponent(
      artifactDownloadMatch[2]
    );

    await requireRun(runService, runId);

    const artifact =
      await runService.readArtifact(
        runId,
        artifactId
      );

    if (artifact === undefined) {
      throw new RequestError(
        404,
        "ARTIFACT_NOT_FOUND",
        "Artifact not found."
      );
    }

    const body = Buffer.from(
      artifact.data
    );

    response.writeHead(200, {
      "content-type":
        artifact.record.mediaType,
      "content-length":
        String(body.byteLength),
      "cache-control": "no-store",
      "content-disposition":
        `attachment; filename="${safeDownloadName(artifact.record.name)}"`
    });
    response.end(body);
    return;
  }

  const artifactListMatch =
    requestUrl.pathname.match(
      /^\/v1\/runs\/([^/]+)\/artifacts$/
    );

  if (
    request.method === "GET" &&
    artifactListMatch?.[1]
  ) {
    const runId = decodeURIComponent(
      artifactListMatch[1]
    );

    await requireRun(runService, runId);

    const artifacts =
      await runService.listArtifacts(runId);

    sendJson(response, 200, {
      artifacts
    });
    return;
  }

  const eventMatch =
    requestUrl.pathname.match(
      /^\/v1\/runs\/([^/]+)\/events$/
    );

  if (
    request.method === "GET" &&
    eventMatch?.[1]
  ) {
    const runId =
      decodeURIComponent(eventMatch[1]);
    const lastEventId =
      parseLastEventId(request);

    await streamRunEvents(
      response,
      runService,
      runId,
      lastEventId
    );
    return;
  }

  const cancelMatch =
    requestUrl.pathname.match(
      /^\/v1\/runs\/([^/]+)\/cancel$/
    );

  if (
    request.method === "POST" &&
    cancelMatch?.[1]
  ) {
    const runId =
      decodeURIComponent(
        cancelMatch[1]
      );
    const run =
      await runService.cancelRun(
        runId
      );

    if (run === undefined) {
      throw new RequestError(
        404,
        "RUN_NOT_FOUND",
        "Run not found."
      );
    }

    sendJson(
      response,
      202,
      run
    );
    return;
  }

  const runMatch =
    requestUrl.pathname.match(
      /^\/v1\/runs\/([^/]+)$/
    );

  if (
    request.method === "GET" &&
    runMatch?.[1]
  ) {
    const run =
      await requireRun(
        runService,
        decodeURIComponent(runMatch[1])
      );

    sendJson(response, 200, run);
    return;
  }

  if (
    requestUrl.pathname === "/v1/runs" ||
    runMatch !== null ||
    cancelMatch !== null ||
    eventMatch !== null ||
    artifactListMatch !== null ||
    artifactDownloadMatch !== null
  ) {
    throw new RequestError(
      405,
      "METHOD_NOT_ALLOWED",
      "Method not allowed."
    );
  }

  throw new RequestError(
    404,
    "RUN_NOT_FOUND",
    "Route not found."
  );
}

export function createApiServer(
  runService: RunService
): Server {
  return createServer(
    (request, response) => {
      void handleRequest(
        request,
        response,
        runService
      ).catch((error: unknown) => {
        if (response.headersSent) {
          response.end();
          return;
        }

        if (error instanceof RequestError) {
          sendJson(
            response,
            error.statusCode,
            apiError(
              error.code,
              error.message
            )
          );
          return;
        }

        sendJson(
          response,
          500,
          apiError(
            "INTERNAL_ERROR",
            "Internal server error."
          )
        );
      });
    }
  );
}
