import {
  execFile
} from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile
} from "node:fs/promises";
import {
  join
} from "node:path";
import {
  promisify
} from "node:util";

import {
  z
} from "zod";

import {
  validateComparatorBskArgs,
  type ComparatorBskGuardOptions
} from "./guard-policy.js";

const execFileAsync =
  promisify(
    execFile
  );

const RequestSchema =
  z.object({
    id:
      z.string().uuid(),
    args:
      z.array(
        z.string()
      )
  }).strict();

interface BrokerResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BskFileBrokerOptions {
  brokerDir: string;
  realBskPath: string;
  guard:
    ComparatorBskGuardOptions;
  tracePath: string;
  bskHome: string;
}

async function atomicJsonWrite(
  path: string,
  value: unknown
): Promise<void> {
  const temporary =
    path +
    ".tmp." +
    String(
      process.pid
    );
  await writeFile(
    temporary,
    JSON.stringify(
      value
    ) +
      "\n",
    {
      encoding:
        "utf8",
      mode:
        0o600
    }
  );
  await rename(
    temporary,
    path
  );
}

export class BskFileBroker {
  readonly #options:
    BskFileBrokerOptions;
  readonly #requestsDir:
    string;
  readonly #responsesDir:
    string;
  readonly #processed =
    new Set<string>();
  #stopped = false;
  #loop:
    Promise<void> | null =
    null;

  public constructor(
    options:
      BskFileBrokerOptions
  ) {
    this.#options =
      options;
    this.#requestsDir =
      join(
        options.brokerDir,
        "requests"
      );
    this.#responsesDir =
      join(
        options.brokerDir,
        "responses"
      );
  }

  public async start():
    Promise<void> {
    await Promise.all([
      mkdir(
        this.#requestsDir,
        {
          recursive: true,
          mode: 0o700
        }
      ),
      mkdir(
        this.#responsesDir,
        {
          recursive: true,
          mode: 0o700
        }
      )
    ]);

    if (
      this.#loop !==
        null
    ) {
      throw new Error(
        "BrowserSkill file broker is already started."
      );
    }

    this.#loop =
      this.#run();
  }

  async #trace(
    value: unknown
  ): Promise<void> {
    await writeFile(
      this.#options
        .tracePath,
      JSON.stringify(
        value
      ) +
        "\n",
      {
        encoding:
          "utf8",
        flag:
          "a",
        mode:
          0o600
      }
    );
  }

  async #respond(
    id: string,
    response:
      BrokerResponse
  ): Promise<void> {
    await atomicJsonWrite(
      join(
        this.#responsesDir,
        id +
          ".json"
      ),
      response
    );
  }

  async #handle(
    filename: string
  ): Promise<void> {
    const path =
      join(
        this.#requestsDir,
        filename
      );
    let request:
      z.infer<
        typeof RequestSchema
      >;

    try {
      request =
        RequestSchema.parse(
          JSON.parse(
            await readFile(
              path,
              "utf8"
            )
          )
        );
    } catch (error) {
      await this.#trace({
        at:
          new Date()
            .toISOString(),
        allowed: false,
        filename,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      });
      return;
    }

    try {
      validateComparatorBskArgs(
        request.args,
        this.#options.guard
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);
      await this.#trace({
        at:
          new Date()
            .toISOString(),
        allowed: false,
        args:
          request.args,
        error:
          message
      });
      await this.#respond(
        request.id,
        {
          exitCode: 126,
          stdout: "",
          stderr:
            message +
            "\n"
        }
      );
      return;
    }

    await this.#trace({
      at:
        new Date()
          .toISOString(),
      allowed: true,
      args:
        request.args
    });

    try {
      const result =
        await execFileAsync(
          this.#options
            .realBskPath,
          request.args,
          {
            encoding:
              "utf8",
            timeout:
              120_000,
            maxBuffer:
              8 *
              1024 *
              1024,
            env: {
              ...process.env,
              BSK_HOME:
                this.#options
                  .bskHome,
              BSK_AUTO_START:
                "0"
            }
          }
        );

      await this.#respond(
        request.id,
        {
          exitCode: 0,
          stdout:
            result.stdout,
          stderr:
            result.stderr
        }
      );
    } catch (error) {
      const candidate =
        error as {
          code?: unknown;
          stdout?: unknown;
          stderr?: unknown;
        };
      const exitCode =
        typeof candidate.code ===
            "number"
          ? candidate.code
          : 1;
      await this.#respond(
        request.id,
        {
          exitCode,
          stdout:
            typeof candidate.stdout ===
              "string"
              ? candidate.stdout
              : "",
          stderr:
            typeof candidate.stderr ===
              "string"
              ? candidate.stderr
              : (
                  error instanceof Error
                    ? error.message
                    : String(error)
                ) +
                "\n"
        }
      );
    }
  }

  async #run():
    Promise<void> {
    while (
      !this.#stopped
    ) {
      const filenames =
        await readdir(
          this.#requestsDir
        ).catch(
          () =>
            [] as string[]
        );

      for (
        const filename of
        filenames
          .filter(
            (value) =>
              value.endsWith(
                ".json"
              )
          )
          .sort()
      ) {
        if (
          this.#processed.has(
            filename
          )
        ) {
          continue;
        }

        this.#processed.add(
          filename
        );
        await this.#handle(
          filename
        );
      }

      await new Promise<void>(
        (resolveSleep) =>
          setTimeout(
            resolveSleep,
            20
          )
      );
    }
  }

  public async close():
    Promise<void> {
    this.#stopped =
      true;

    if (
      this.#loop !==
        null
    ) {
      await this.#loop;
      this.#loop =
        null;
    }
  }
}
