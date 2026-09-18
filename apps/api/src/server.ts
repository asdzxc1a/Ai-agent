import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";

import type {
  ApiErrorCode,
  ApiErrorResponse,
  CreateRunAccepted
} from "@astra/contracts";

import {
  ApiInputError,
  compileOutputSchema,
  parseCreateRunRequest
} from "./schema.js";
import type { InMemoryRunService } from "./run-service.js";

const MAX_REQUEST_BYTES = 64 * 1024;

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

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  runService: InMemoryRunService
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
      parsed = parseCreateRunRequest(raw);
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

    const run = runService.createRun({
      url: parsed.url,
      goal: parsed.goal,
      ...(parsed.outputSchema === undefined
        ? {}
        : {
            outputSchema: compileOutputSchema(
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

  const runMatch = requestUrl.pathname.match(
    /^\/v1\/runs\/([^/]+)$/
  );

  if (request.method === "GET" && runMatch?.[1]) {
    const run = runService.getRun(
      decodeURIComponent(runMatch[1])
    );

    if (run === undefined) {
      throw new RequestError(
        404,
        "RUN_NOT_FOUND",
        "Run not found."
      );
    }

    sendJson(response, 200, run);
    return;
  }

  if (
    requestUrl.pathname === "/v1/runs" ||
    runMatch !== null
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
  runService: InMemoryRunService
): Server {
  return createServer((request, response) => {
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
          apiError(error.code, error.message)
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
  });
}
