import {
  chmod,
  copyFile,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import {
  homedir,
  tmpdir
} from "node:os";
import {
  join
} from "node:path";

export interface IsolatedCodexMcpConfig {
  name: string;
  command: string;
  args:
    readonly string[];
  env:
    Readonly<
      Record<
        string,
        string
      >
    >;
}

export interface IsolatedCodexHome {
  path: string;
  close():
    Promise<void>;
}

function tomlString(
  value: string
): string {
  return JSON.stringify(
    value
  );
}

function mcpConfigText(
  config:
    IsolatedCodexMcpConfig
): string {
  const lines = [
    "[mcp_servers." +
      config.name +
      "]",
    "command = " +
      tomlString(
        config.command
      ),
    "args = [" +
      config.args
        .map(
          tomlString
        )
        .join(
          ", "
        ) +
      "]",
    "approval_mode = \"never\"",
    "",
    "[mcp_servers." +
      config.name +
      ".env]"
  ];

  for (
    const [
      key,
      value
    ] of Object.entries(
      config.env
    )
  ) {
    lines.push(
      key +
        " = " +
        tomlString(
          value
        )
    );
  }

  lines.push(
    ""
  );

  return lines.join(
    "\n"
  );
}

export async function createIsolatedCodexHome(
  mcp?:
    IsolatedCodexMcpConfig
): Promise<
  IsolatedCodexHome
> {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "astra-codex-home-"
      )
    );
  await chmod(
    root,
    0o700
  );

  const sourceCodexHome =
    process.env
      .CODEX_HOME ??
    join(
      homedir(),
      ".codex"
    );
  const sourceAuth =
    join(
      sourceCodexHome,
      "auth.json"
    );
  const targetAuth =
    join(
      root,
      "auth.json"
    );

  try {
    await copyFile(
      sourceAuth,
      targetAuth
    );
  } catch (error) {
    await rm(
      root,
      {
        recursive: true,
        force: true
      }
    );
    throw new Error(
      "Comparator requires an existing Codex login, but auth.json could not be copied into the isolated credential home.",
      {
        cause:
          error
      }
    );
  }

  await chmod(
    targetAuth,
    0o600
  );

  if (
    mcp !==
      undefined
  ) {
    await writeFile(
      join(
        root,
        "config.toml"
      ),
      mcpConfigText(
        mcp
      ),
      {
        encoding:
          "utf8",
        mode:
          0o600
      }
    );
  }

  return {
    path:
      root,
    async close() {
      await rm(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  };
}
