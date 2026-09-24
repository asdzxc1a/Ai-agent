import {
  randomUUID
} from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  join
} from "node:path";
import {
  createInterface
} from "node:readline";

interface JsonRpcRequest {
  jsonrpc:
    "2.0";
  id?:
    string |
    number |
    null;
  method:
    string;
  params?:
    unknown;
}

interface BrokerResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function requiredEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(
      "Missing required comparator MCP environment: " +
        name
    );
  }

  return value;
}

function objectArgs(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  return value as
    Record<
      string,
      unknown
    >;
}

function stringArg(
  args:
    Record<
      string,
      unknown
    >,
  name: string
): string {
  const value =
    args[name];

  if (
    typeof value !==
      "string" ||
    value.length ===
      0
  ) {
    throw new Error(
      "Missing or invalid MCP argument: " +
        name
    );
  }

  return value;
}

function integerArg(
  args:
    Record<
      string,
      unknown
    >,
  name: string,
  min: number,
  max: number
): number {
  const value =
    args[name];

  if (
    typeof value !==
      "number" ||
    !Number.isInteger(
      value
    ) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      "Missing or invalid MCP integer argument: " +
        name
    );
  }

  return value;
}

function safeScreenshotName(
  value: string
): string {
  const normalized =
    value
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ""
      );

  if (
    normalized.length ===
      0
  ) {
    throw new Error(
      "Screenshot filename is empty after normalization."
    );
  }

  return normalized.endsWith(
    ".png"
  )
    ? normalized
    : normalized +
        ".png";
}

async function sleep(
  ms: number
): Promise<void> {
  await new Promise<void>(
    (resolveSleep) =>
      setTimeout(
        resolveSleep,
        ms
      )
  );
}

const brokerDir =
  requiredEnv(
    "ASTRA_COMPARATOR_BSK_BROKER_DIR"
  );
const browserLabel =
  requiredEnv(
    "ASTRA_COMPARATOR_BROWSER_LABEL"
  );
const runDir =
  requiredEnv(
    "ASTRA_COMPARATOR_RUN_DIR"
  );
const requestsDir =
  join(
    brokerDir,
    "requests"
  );
const responsesDir =
  join(
    brokerDir,
    "responses"
  );

await Promise.all([
  mkdir(
    requestsDir,
    {
      recursive: true,
      mode: 0o700
    }
  ),
  mkdir(
    responsesDir,
    {
      recursive: true,
      mode: 0o700
    }
  ),
  mkdir(
    join(
      runDir,
      "evidence"
    ),
    {
      recursive: true,
      mode: 0o700
    }
  )
]);

async function brokerCall(
  args:
    readonly string[]
): Promise<
  BrokerResponse
> {
  const id =
    randomUUID();
  const requestPath =
    join(
      requestsDir,
      id +
        ".json"
    );
  const responsePath =
    join(
      responsesDir,
      id +
        ".json"
    );

  await writeFile(
    requestPath,
    JSON.stringify({
      id,
      args
    }) +
      "\n",
    {
      encoding:
        "utf8",
      flag:
        "wx",
      mode:
        0o600
    }
  );

  const deadline =
    Date.now() +
    125_000;

  while (
    Date.now() <
      deadline
  ) {
    try {
      const response =
        JSON.parse(
          await readFile(
            responsePath,
            "utf8"
          )
        ) as BrokerResponse;

      return response;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code ===
          "ENOENT"
      ) {
        await sleep(
          20
        );
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "BrowserSkill broker response timed out."
  );
}

function textContent(
  response:
    BrokerResponse
) {
  const text =
    response.stdout.length >
      0
      ? response.stdout
      : response.stderr;

  return {
    content: [
      {
        type:
          "text",
        text:
          text.length >
            0
            ? text
            : JSON.stringify({
                exitCode:
                  response.exitCode
              })
      }
    ],
    isError:
      response.exitCode !==
        0
  };
}

const tools = [
  {
    name:
      "browser_session_start",
    description:
      "Start one BrowserSkill session in the frozen dedicated comparator browser profile.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      properties: {}
    }
  },
  {
    name:
      "browser_navigate",
    description:
      "Navigate the active comparator browser session to an allowlisted URL.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session",
        "url"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        },
        url: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_observe",
    description:
      "Read a semantic BrowserSkill observation from the current page.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_snapshot",
    description:
      "Read an aria snapshot from the current page.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_wheel",
    description:
      "Scroll vertically with a native mouse-wheel event.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session",
        "deltaY"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        },
        deltaY: {
          type:
            "integer",
          minimum:
            -5000,
          maximum:
            5000
        }
      }
    }
  },
  {
    name:
      "browser_screenshot",
    description:
      "Capture a screenshot into the run-local evidence directory.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session",
        "filename"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        },
        filename: {
          type:
            "string",
          minLength: 1,
          maxLength:
            120
        },
        fullPage: {
          type:
            "boolean"
        }
      }
    }
  },
  {
    name:
      "browser_wait_ms",
    description:
      "Wait briefly on the BrowserSkill daemon side.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "milliseconds"
      ],
      properties: {
        milliseconds: {
          type:
            "integer",
          minimum:
            1,
          maximum:
            10000
        }
      }
    }
  },
  {
    name:
      "browser_reload",
    description:
      "Reload the active comparator page.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_navigate_back",
    description:
      "Navigate back in the active comparator session.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_navigate_forward",
    description:
      "Navigate forward in the active comparator session.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  },
  {
    name:
      "browser_session_stop",
    description:
      "Stop the current BrowserSkill session before finishing the research result.",
    inputSchema: {
      type:
        "object",
      additionalProperties:
        false,
      required: [
        "session"
      ],
      properties: {
        session: {
          type:
            "string",
          minLength: 1
        }
      }
    }
  }
] as const;

const toolsWithReadOnlyAnnotations =
  tools.map(
    (tool) => ({
      ...tool,
      annotations: {
        readOnlyHint:
          true,
        destructiveHint:
          false,
        idempotentHint:
          true,
        openWorldHint:
          true
      }
    })
  );

async function callTool(
  name: string,
  rawArguments: unknown
) {
  const args =
    objectArgs(
      rawArguments
    );

  switch (name) {
    case "browser_session_start":
      return textContent(
        await brokerCall([
          "session",
          "start",
          "--browser",
          browserLabel,
          "--json"
        ])
      );

    case "browser_navigate":
      return textContent(
        await brokerCall([
          "navigate",
          stringArg(
            args,
            "url"
          ),
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_observe":
      return textContent(
        await brokerCall([
          "observe",
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_snapshot":
      return textContent(
        await brokerCall([
          "snapshot",
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_wheel":
      return textContent(
        await brokerCall([
          "wheel",
          "--session",
          stringArg(
            args,
            "session"
          ),
          "--delta-y",
          String(
            integerArg(
              args,
              "deltaY",
              -5000,
              5000
            )
          )
        ])
      );

    case "browser_screenshot": {
      const outputPath =
        join(
          runDir,
          "evidence",
          safeScreenshotName(
            stringArg(
              args,
              "filename"
            )
          )
        );
      const command = [
        "screenshot",
        "--session",
        stringArg(
          args,
          "session"
        ),
        "--out",
        outputPath
      ];

      if (
        args.fullPage ===
          true
      ) {
        command.push(
          "--full-page"
        );
      }

      return textContent(
        await brokerCall(
          command
        )
      );
    }

    case "browser_wait_ms":
      return textContent(
        await brokerCall([
          "wait-ms",
          String(
            integerArg(
              args,
              "milliseconds",
              1,
              10000
            )
          )
        ])
      );

    case "browser_reload":
      return textContent(
        await brokerCall([
          "reload",
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_navigate_back":
      return textContent(
        await brokerCall([
          "navigate-back",
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_navigate_forward":
      return textContent(
        await brokerCall([
          "navigate-forward",
          "--session",
          stringArg(
            args,
            "session"
          )
        ])
      );

    case "browser_session_stop":
      return textContent(
        await brokerCall([
          "session",
          "stop",
          stringArg(
            args,
            "session"
          )
        ])
      );

    default:
      throw new Error(
        "Unknown comparator browser MCP tool: " +
          name
      );
  }
}

function send(
  value: unknown
): void {
  process.stdout.write(
    JSON.stringify(
      value
    ) +
      "\n"
  );
}

async function handle(
  message:
    JsonRpcRequest
): Promise<void> {
  const id =
    message.id;

  if (
    message.method ===
      "initialize"
  ) {
    const params =
      objectArgs(
        message.params
      );
    const requestedVersion =
      typeof params
          .protocolVersion ===
          "string"
        ? params
            .protocolVersion
        : "2025-06-18";

    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result: {
          protocolVersion:
            requestedVersion,
          capabilities: {
            tools: {
              listChanged:
                false
            }
          },
          serverInfo: {
            name:
              "astra-gate13-comparator-browser",
            version:
              "1.0.0"
          }
        }
      });
    }

    return;
  }

  if (
    message.method ===
      "notifications/initialized" ||
    message.method ===
      "notifications/cancelled"
  ) {
    return;
  }

  if (
    message.method ===
      "ping"
  ) {
    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result: {}
      });
    }

    return;
  }

  if (
    message.method ===
      "tools/list"
  ) {
    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result: {
          tools:
            toolsWithReadOnlyAnnotations
        }
      });
    }

    return;
  }

  if (
    message.method ===
      "tools/call"
  ) {
    const params =
      objectArgs(
        message.params
      );
    const name =
      stringArg(
        params,
        "name"
      );
    const result =
      await callTool(
        name,
        params.arguments
      );

    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result
      });
    }

    return;
  }

  if (
    message.method ===
      "resources/list"
  ) {
    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result: {
          resources: []
        }
      });
    }

    return;
  }

  if (
    message.method ===
      "prompts/list"
  ) {
    if (
      id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id,
        result: {
          prompts: []
        }
      });
    }

    return;
  }

  if (
    id !==
      undefined
  ) {
    send({
      jsonrpc:
        "2.0",
      id,
      error: {
        code:
          -32601,
        message:
          "Method not found"
      }
    });
  }
}

const reader =
  createInterface({
    input:
      process.stdin,
    crlfDelay:
      Infinity
  });

for await (
  const line of
  reader
) {
  if (
    line.trim().length ===
      0
  ) {
    continue;
  }

  let message:
    JsonRpcRequest |
    undefined;

  try {
    message =
      JSON.parse(
        line
      ) as JsonRpcRequest;
    await handle(
      message
    );
  } catch (error) {
    const messageText =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      message?.id !==
        undefined
    ) {
      send({
        jsonrpc:
          "2.0",
        id:
          message.id,
        error: {
          code:
            -32603,
          message:
            messageText
        }
      });
    } else {
      process.stderr.write(
        messageText +
          "\n"
      );
    }
  }
}
