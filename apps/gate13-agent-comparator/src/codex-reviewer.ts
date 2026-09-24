import {
  spawn
} from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  delimiter,
  dirname,
  join
} from "node:path";

import {
  ComparatorModelReviewDraftSchema,
  type ComparatorAttempt,
  type ComparatorModelReviewDraft,
  type ComparatorReviewerIdentity,
  type ComparatorReviewerModelUsage
} from "@astra/agent-comparator";

import {
  createIsolatedCodexHome
} from "./isolated-codex-home.js";

interface ReviewerOptions {
  storeRoot: string;
  promptText: string;
  resultSchemaPath: string;
  harnessVersion: string;
  model: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function reviewPrompt(
  attempt:
    ComparatorAttempt,
  promptText: string
): string {
  if (
    attempt.status !==
      "COMPLETED" ||
    attempt.workerResult ===
      null
  ) {
    throw new Error(
      "Model review requires a completed comparator attempt."
    );
  }

  return [
    promptText,
    "",
    "## Blinded review input",
    "",
    JSON.stringify(
      {
        brief:
          attempt.workerResult
            .brief,
        evidence:
          attempt.workerResult
            .evidence
      },
      null,
      2
    )
  ].join(
    "\n"
  );
}

async function runCodex(
  codexPath: string,
  args:
    readonly string[],
  prompt: string,
  cwd: string,
  env:
    NodeJS.ProcessEnv
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
  child.stdin.end(
    prompt
  );

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
            signal
          ) => {
            if (
              signal !==
                null
            ) {
              reject(
                new Error(
                  "Comparator reviewer terminated by signal " +
                    signal
                )
              );
              return;
            }

            resolveExit(
              code ?? 1
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
}

function reviewerUsage(
  jsonl: string
): ComparatorReviewerModelUsage | null {
  let found = false;
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
        item?: {
          type?: string;
        };
      };

    if (
      record.item?.type ===
        "command_execution"
    ) {
      throw new Error(
        "Blinded comparator reviewer attempted to use a tool."
      );
    }

    if (
      record.type !==
        "turn.completed" ||
      record.usage ===
        undefined
    ) {
      continue;
    }

    found = true;
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
  }

  return found
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

async function resolveCodex():
  Promise<string> {
  const pathEntries =
    (
      process.env.PATH ??
      ""
    ).split(
      delimiter
    );

  for (
    const pathEntry of
    pathEntries
  ) {
    if (
      pathEntry.length ===
        0
    ) {
      continue;
    }

    const candidate =
      join(
        pathEntry,
        "codex"
      );

    try {
      await readFile(
        candidate
      );
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Codex CLI is not available on PATH."
  );
}

export interface ComparatorReviewResult {
  draft:
    ComparatorModelReviewDraft;
  reviewerIdentity:
    ComparatorReviewerIdentity;
  modelUsage:
    ComparatorReviewerModelUsage | null;
}

export class CodexComparatorReviewer {
  readonly #options:
    ReviewerOptions;

  public constructor(
    options:
      ReviewerOptions
  ) {
    this.#options =
      options;
  }

  public async review(
    attempt:
      ComparatorAttempt
  ): Promise<
    ComparatorReviewResult
  > {
    const runDir =
      join(
        this.#options
          .storeRoot,
        "review-runs",
        attempt.attemptId
      );
    const homeDir =
      join(
        runDir,
        "home"
      );
    const tmpDir =
      join(
        runDir,
        "tmp"
      );
    const eventsPath =
      join(
        runDir,
        "codex-review-events.jsonl"
      );
    const stderrPath =
      join(
        runDir,
        "codex-review-stderr.log"
      );
    const outputPath =
      join(
        runDir,
        "review.json"
      );

    await Promise.all([
      mkdir(
        homeDir,
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

    const codexPath =
      await resolveCodex();
    const isolatedCodexHome =
      await createIsolatedCodexHome();
    const env:
      NodeJS.ProcessEnv = {
        PATH: [
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
          homeDir,
        CODEX_HOME:
          isolatedCodexHome.path,
        TMPDIR:
          tmpDir
      };
    let result:
      ProcessResult;

    try {
      result =
        await runCodex(
          codexPath,
          [
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
            "--disable",
            "shell_tool",
            "--disable",
            "shell_snapshot",
            "--disable",
            "shell_snapshot_v2",
            "--disable",
            "unified_exec",
            "--disable",
            "unified_exec_tty",
            "--disable",
            "view_image",
            "--disable",
            "image_generation",
            "--disable",
            "multi_agent",
            "--disable",
            "sleep_tool",
            "--disable",
            "code_mode_host",
            "--disable",
            "tool_suggest",
            "--disable",
            "skill_search",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "-c",
            "shell_environment_policy.inherit=none",
            "--cd",
            runDir,
            "--model",
            this.#options.model,
            "--output-schema",
            this.#options
              .resultSchemaPath,
            "--output-last-message",
            outputPath,
            "--json",
            "-"
          ],
          reviewPrompt(
            attempt,
            this.#options
              .promptText
          ),
          runDir,
          env
        );
    } finally {
      await isolatedCodexHome
        .close();
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
      result.exitCode !==
        0
    ) {
      throw new Error(
        "Comparator model reviewer exited with code " +
          String(
            result.exitCode
          ) +
        "."
      );
    }

    const modelUsage =
      reviewerUsage(
        result.stdout
      );
    const draft =
      ComparatorModelReviewDraftSchema
        .parse(
          JSON.parse(
            await readFile(
              outputPath,
              "utf8"
            )
          )
        );

    return {
      draft,
      reviewerIdentity: {
        harness:
          "codex-cli",
        harnessVersion:
          this.#options
            .harnessVersion,
        model:
          this.#options.model
      },
      modelUsage
    };
  }
}
