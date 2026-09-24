import {
  spawn
} from "node:child_process";
import {
  access,
  constants,
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  homedir
} from "node:os";
import {
  delimiter,
  dirname,
  join
} from "node:path";

import {
  ComparatorWorkerResultSchema,
  type ComparatorWorker,
  type ComparatorWorkerInput,
  type ComparatorWorkerResult
} from "@astra/agent-comparator";

import {
  BskFileBroker
} from "./bsk-file-broker.js";
import {
  createIsolatedCodexHome
} from "./isolated-codex-home.js";

interface WorkerOptions {
  storeRoot: string;
  frozenPrompt: string;
  resultSchemaPath: string;
  mcpServerPath: string;
  realBskPath: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function taskPrompt(
  input:
    ComparatorWorkerInput,
  frozenPrompt: string
): string {
  return [
    frozenPrompt,
    "",
    "## Frozen target",
    "",
    "Attempt ID: " +
      input.attemptId,
    "Target ID: " +
      input.target.id,
    "Company: " +
      input.target.companyName,
    "Approved start URL: " +
      input.target.startUrl,
    "Approved evidence domains: " +
      input.target.approvedDomains.join(
        ", "
      ),
    "Permitted search-discovery domains: " +
      input.protocol.browser
        .allowedSearchDomains
        .join(
          ", "
        ),
    "Required BrowserSkill label: " +
      input.protocol.browser
        .requiredBrowserLabel,
    "",
    "The runner already qualified BrowserSkill and the dedicated browser profile.",
    "Shell/code execution is disabled. Use only the astra_browser MCP tools exposed for this run.",
    "Start with browser_session_start, then use browser_navigate plus browser_observe/browser_snapshot; browser_wheel, browser_wait_ms, reload/back/forward, and run-local browser_screenshot are optional read-only helpers.",
    "Always call browser_session_stop before returning the final JSON if a session was started.",
    "If an MCP browser tool is rejected or fails, do not inspect implementation files and do not invent another execution path.",
    "Preserve explicit unknowns and report the blocker.",
    "Final evidence must remain on approved official domains. Search pages are discovery only.",
    ""
  ].join(
    "\n"
  );
}

async function resolveExecutable(
  name: string,
  pathValue:
    string | undefined
): Promise<string> {
  for (
    const directory of
    (
      pathValue ??
      ""
    ).split(
      delimiter
    )
  ) {
    if (
      directory.length ===
        0
    ) {
      continue;
    }

    const candidate =
      join(
        directory,
        name
      );

    try {
      await access(
        candidate,
        constants.X_OK
      );
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Required executable is not available on the parent PATH: " +
      name
  );
}

async function spawnCodex(
  codexPath: string,
  args: readonly string[],
  prompt: string,
  cwd: string,
  env:
    NodeJS.ProcessEnv,
  signal:
    AbortSignal
): Promise<
  ProcessResult
> {
  const child =
    spawn(
      codexPath,
      [...args],
      {
        cwd,
        env,
        stdio: [
          "pipe",
          "pipe",
          "pipe"
        ]
      }
    );
  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding(
    "utf8"
  );
  child.stderr.setEncoding(
    "utf8"
  );
  child.stdout.on(
    "data",
    (chunk) => {
      stdout +=
        String(chunk);
    }
  );
  child.stderr.on(
    "data",
    (chunk) => {
      stderr +=
        String(chunk);
    }
  );

  const onAbort = () => {
    child.kill(
      "SIGTERM"
    );
  };

  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener(
      "abort",
      onAbort,
      {
        once: true
      }
    );
  }

  child.stdin.end(
    prompt
  );

  try {
    const exitCode =
      await new Promise<number>(
        (
          resolveExit,
          reject
        ) => {
          child.once(
            "error",
            reject
          );
          child.once(
            "exit",
            (
              code,
              childSignal
            ) => {
              if (
                childSignal !==
                  null &&
                !signal.aborted
              ) {
                reject(
                  new Error(
                    "Codex worker terminated by signal " +
                      childSignal
                  )
                );
                return;
              }

              resolveExit(
                code ??
                1
              );
            }
          );
        }
      );

    return {
      stdout,
      stderr,
      exitCode
    };
  } finally {
    signal.removeEventListener(
      "abort",
      onAbort
    );
  }
}

export function auditNoShellCommandEvents(
  jsonl: string
): void {
  const commands:
    string[] = [];

  for (
    const line of
    jsonl.split(
      "\n"
    )
  ) {
    if (
      line.trim().length ===
        0
    ) {
      continue;
    }

    try {
      const record =
        JSON.parse(
          line
        ) as {
          item?: {
            type?: string;
            command?: string;
          };
        };

      if (
        record.item?.type ===
          "command_execution"
      ) {
        commands.push(
          record.item.command ??
          "<unknown>"
        );
      }
    } catch {
      continue;
    }
  }

  if (
    commands.length >
      0
  ) {
    throw new Error(
      "Comparator agent emitted forbidden shell command events while shell_tool was disabled: " +
        commands
          .slice(
            0,
            3
          )
          .join(
            " | "
          )
    );
  }
}

function auditBrokerTrace(
  jsonl: string
): void {
  const denied:
    unknown[] = [];

  for (
    const line of
    jsonl.split(
      "\n"
    )
  ) {
    if (
      line.trim().length ===
        0
    ) {
      continue;
    }

    const record =
      JSON.parse(
        line
      ) as {
        allowed?: boolean;
      };

    if (
      record.allowed ===
        false
    ) {
      denied.push(
        record
      );
    }
  }

  if (
    denied.length >
      0
  ) {
    throw new Error(
      "Comparator BrowserSkill broker denied one or more attempted commands."
    );
  }
}

function modelUsageFromCodexEvents(
  jsonl: string
): ComparatorWorkerResult[
  "modelUsage"
] {
  let seen = false;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let cacheWriteInputTokens = 0;
  let outputTokens = 0;
  let reasoningOutputTokens = 0;

  for (
    const line of
    jsonl.split(
      "\n"
    )
  ) {
    if (
      line.trim().length ===
        0
    ) {
      continue;
    }

    try {
      const record =
        JSON.parse(
          line
        ) as {
          type?: string;
          usage?: {
            input_tokens?: number;
            cached_input_tokens?: number;
            cache_write_input_tokens?: number;
            output_tokens?: number;
            reasoning_output_tokens?: number;
          };
        };

      if (
        record.type !==
          "turn.completed" ||
        record.usage ===
          undefined
      ) {
        continue;
      }

      seen = true;
      inputTokens +=
        record.usage
          .input_tokens ??
        0;
      cachedInputTokens +=
        record.usage
          .cached_input_tokens ??
        0;
      cacheWriteInputTokens +=
        record.usage
          .cache_write_input_tokens ??
        0;
      outputTokens +=
        record.usage
          .output_tokens ??
        0;
      reasoningOutputTokens +=
        record.usage
          .reasoning_output_tokens ??
        0;
    } catch {
      continue;
    }
  }

  return seen
    ? {
        source:
          "CODEX_JSONL",
        inputTokens,
        cachedInputTokens,
        cacheWriteInputTokens,
        outputTokens,
        reasoningOutputTokens
      }
    : null;
}

export class CodexBrowserSkillWorker
  implements ComparatorWorker {
  readonly #options:
    WorkerOptions;

  public constructor(
    options:
      WorkerOptions
  ) {
    this.#options =
      options;
  }

  public async research(
    input:
      ComparatorWorkerInput
  ): Promise<
    ComparatorWorkerResult
  > {
    const runDir =
      join(
        this.#options
          .storeRoot,
        "runs",
        input.attemptId
      );
    const agentHome =
      join(
        runDir,
        "home"
      );
    const brokerDir =
      join(
        runDir,
        "bsk-broker"
      );
    const tmpDir =
      join(
        runDir,
        "tmp"
      );
    const tracePath =
      join(
        runDir,
        "bsk-tool-trace.jsonl"
      );
    const eventsPath =
      join(
        runDir,
        "codex-events.jsonl"
      );
    const stderrPath =
      join(
        runDir,
        "codex-stderr.log"
      );
    const outputPath =
      join(
        runDir,
        "result.json"
      );
    const taskPath =
      join(
        runDir,
        "target.json"
      );

    await Promise.all([
      mkdir(
        agentHome,
        {
          recursive: true,
          mode: 0o700
        }
      ),
      mkdir(
        tmpDir,
        {
          recursive: true,
          mode: 0o700
        }
      )
    ]);
    await writeFile(
      taskPath,
      JSON.stringify(
        {
          attemptId:
            input.attemptId,
          target:
            input.target,
          requestedFields:
            input.protocol
              .requestedFields
        },
        null,
        2
      ) +
        "\n",
      {
        mode: 0o600
      }
    );
    await writeFile(
      tracePath,
      "",
      {
        mode: 0o600
      }
    );

    const broker =
      new BskFileBroker({
        brokerDir,
        realBskPath:
          this.#options
            .realBskPath,
        guard: {
          browserLabel:
            input.protocol
              .browser
              .requiredBrowserLabel,
          allowedDomains: [
            ...input.target
              .approvedDomains,
            ...input.protocol
              .browser
              .allowedSearchDomains
          ],
          runDir
        },
        tracePath,
        bskHome:
          process.env
            .BSK_HOME ??
          join(
            homedir(),
            ".bsk"
          )
      });
    await broker.start();

    const codexPath =
      await resolveExecutable(
        "codex",
        process.env.PATH
      );
    const isolatedCodexHome =
      await createIsolatedCodexHome({
        name:
          "astra_browser",
        command:
          process.execPath,
        args: [
          this.#options
            .mcpServerPath
        ],
        env: {
          ASTRA_COMPARATOR_BSK_BROKER_DIR:
            brokerDir,
          ASTRA_COMPARATOR_BROWSER_LABEL:
            input.protocol
              .browser
              .requiredBrowserLabel,
          ASTRA_COMPARATOR_RUN_DIR:
            runDir
        }
      });
    const env:
      NodeJS.ProcessEnv = {
        PATH:
          [
            dirname(
              process.execPath
            ),
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
          ].join(
            delimiter
          ),
        HOME:
          agentHome,
        CODEX_HOME:
          isolatedCodexHome.path,
        TMPDIR:
          tmpDir
      };
    const args = [
      "exec",
      "--ephemeral",
      "--ignore-rules",
      "--enable",
      "skip_host_skill_discovery",
      "--disable",
      "shell_tool",
      "--disable",
      "apps",
      "--disable",
      "plugins",
      "--disable",
      "browser_use",
      "--disable",
      "browser_use_external",
      "--disable",
      "computer_use",
      "--disable",
      "in_app_browser",
      "--disable",
      "multi_agent",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--cd",
      runDir,
      "--model",
      input.protocol
        .agent.model,
      "--output-schema",
      this.#options
        .resultSchemaPath,
      "--output-last-message",
      outputPath,
      "--json",
      "-"
    ] as const;
    let result:
      ProcessResult;

    try {
      result =
        await spawnCodex(
          codexPath,
          args,
          taskPrompt(
            input,
            this.#options
              .frozenPrompt
          ),
          runDir,
          env,
          input.signal
        );
    } finally {
      await Promise.allSettled([
        broker.close(),
        isolatedCodexHome.close()
      ]);
    }

    await Promise.all([
      writeFile(
        eventsPath,
        result.stdout,
        {
          mode: 0o600
        }
      ),
      writeFile(
        stderrPath,
        result.stderr,
        {
          mode: 0o600
        }
      )
    ]);

    if (
      input.signal.aborted
    ) {
      throw (
        input.signal.reason ??
        new DOMException(
          "Comparator worker timed out.",
          "TimeoutError"
        )
      );
    }

    if (
      result.exitCode !==
        0
    ) {
      throw new Error(
        "Codex comparator worker exited with code " +
          String(
            result.exitCode
          ) +
        "."
      );
    }

    auditNoShellCommandEvents(
      result.stdout
    );
    auditBrokerTrace(
      await readFile(
        tracePath,
        "utf8"
      )
    );

    const workerResult =
      ComparatorWorkerResultSchema
        .parse(
          JSON.parse(
            await readFile(
              outputPath,
              "utf8"
            )
          )
        );

    if (
      workerResult.modelUsage !==
        null
    ) {
      throw new Error(
        "Comparator worker may not invent model usage."
      );
    }

    return ComparatorWorkerResultSchema
      .parse({
        ...workerResult,
        modelUsage:
          modelUsageFromCodexEvents(
            result.stdout
          )
      });
  }
}
