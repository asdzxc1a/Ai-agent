import {
  spawn
} from "node:child_process";
import {
  access,
  chmod,
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
  BSK_FILE_CLIENT_SOURCE
} from "./bsk-client-source.js";
import {
  BskFileBroker
} from "./bsk-file-broker.js";

interface WorkerOptions {
  storeRoot: string;
  frozenPrompt: string;
  resultSchemaPath: string;
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
    "Do not run bsk help/version/status/browsers/doctor, installation commands, sed/cat/grep, or inspect runner/guard files.",
    "Use only these BrowserSkill shapes:",
    "  bsk session start --browser " +
      input.protocol.browser
        .requiredBrowserLabel +
      " --json",
    "  bsk navigate <url> --session <session-id>",
    "  bsk observe --session <session-id>",
    "  bsk snapshot --session <session-id> (optional)",
    "  bsk screenshot --session <session-id> --out <run-local-path> (optional)",
    "  bsk session stop <session-id>",
    "If BrowserSkill is rejected or fails, do not inspect implementation files and do not invent alternate syntax.",
    "Stop the owned session if one exists, preserve explicit unknowns, and report the blocker.",
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

function collectCommandStrings(
  value: unknown,
  result:
    string[]
): void {
  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of
      value
    ) {
      collectCommandStrings(
        item,
        result
      );
    }

    return;
  }

  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return;
  }

  for (
    const [
      key,
      child
    ] of Object.entries(
      value
    )
  ) {
    if (
      key ===
        "command" &&
      typeof child ===
        "string"
    ) {
      result.push(
        child
      );
    }

    collectCommandStrings(
      child,
      result
    );
  }
}

export function isComparatorBskCommandEventSafe(
  command: string,
  guardBin: string
): boolean {
  const trimmed =
    command.trim();
  const shellMatch =
    trimmed.match(
      /^\/(?:bin\/)?(?:zsh|bash|sh)\s+-lc\s+'([^']*)'$/
    );
  const candidate =
    shellMatch?.[1] ??
    trimmed;
  const startsWithOwnedBsk =
    candidate ===
      "bsk" ||
    candidate.startsWith(
      "bsk "
    ) ||
    candidate ===
      guardBin ||
    candidate.startsWith(
      guardBin +
        " "
    );

  if (
    !startsWithOwnedBsk
  ) {
    return false;
  }

  return !/[;&|<>\x60$()\n\r]/
    .test(
      candidate
    );
}

function auditCodexEvents(
  jsonl: string,
  guardBin: string
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
      collectCommandStrings(
        JSON.parse(
          line
        ),
        commands
      );
    } catch {
      continue;
    }
  }

  const violations =
    commands.filter(
      (command) =>
        !isComparatorBskCommandEventSafe(
          command,
          guardBin
        )
    );

  if (
    violations.length >
      0
  ) {
    throw new Error(
      "Comparator agent used shell commands outside the BrowserSkill broker: " +
        violations
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
    const binDir =
      join(
        runDir,
        "bin"
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
    const clientPath =
      join(
        binDir,
        "bsk-client.mjs"
      );
    const guardBin =
      join(
        binDir,
        "bsk"
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
        binDir,
        {
          recursive: true,
          mode: 0o700
        }
      ),
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
    await writeFile(
      clientPath,
      BSK_FILE_CLIENT_SOURCE,
      {
        mode: 0o600
      }
    );
    await writeFile(
      guardBin,
      [
        "#!/bin/sh",
        "exec " +
          JSON.stringify(
            process.execPath
          ) +
          " " +
          JSON.stringify(
            clientPath
          ) +
          " \"$@\"" ,
        ""
      ].join(
        "\n"
      ),
      {
        mode: 0o700
      }
    );
    await chmod(
      guardBin,
      0o700
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

    const env:
      NodeJS.ProcessEnv = {
        PATH:
          [
            binDir,
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
          process.env
            .CODEX_HOME ??
          join(
            homedir(),
            ".codex"
          ),
        TMPDIR:
          tmpDir,
        ASTRA_COMPARATOR_BSK_BROKER_DIR:
          brokerDir
      };
    const args = [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--enable",
      "skip_host_skill_discovery",
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
      "--skip-git-repo-check",
      "--sandbox",
      "workspace-write",
      "-c",
      "shell_environment_policy.ignore_default_excludes=false",
      "-c",
      "shell_environment_policy.exclude=[\"CODEX_HOME\"]",
      "-c",
      "shell_environment_policy.include_only=[\"PATH\",\"HOME\",\"TMPDIR\",\"ASTRA_COMPARATOR_BSK_BROKER_DIR\"]",
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
    const codexPath =
      await resolveExecutable(
        "codex",
        process.env.PATH
      );
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
      await broker.close();
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

    auditCodexEvents(
      result.stdout,
      guardBin
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
