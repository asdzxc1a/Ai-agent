import {
  execFile
} from "node:child_process";
import {
  promisify
} from "node:util";

import type {
  ComparatorAgentIdentity,
  ComparatorProtocol
} from "@astra/agent-comparator";
import {
  z
} from "zod";

const execFileAsync =
  promisify(
    execFile
  );

const BrowserSchema =
  z.object({
    instance_id:
      z.string().min(1),
    browser_name:
      z.string().min(1),
    browser_version:
      z.string().min(1),
    extension_version:
      z.string().min(1),
    label:
      z.string(),
    session_count:
      z.number()
        .int()
        .nonnegative(),
    version_skew:
      z.boolean()
  }).passthrough();

const BrowsersSchema =
  z.array(
    BrowserSchema
  );

const StatusSchema =
  z.object({
    daemon_version:
      z.string().min(1),
    protocol_version:
      z.string().min(1),
    ws_port:
      z.number()
        .int()
        .min(1)
        .max(65535),
    browsers:
      BrowsersSchema
  }).passthrough();

export interface ComparatorCommandExecutor {
  run(
    command: string,
    args:
      readonly string[]
  ): Promise<string>;
}

export class LocalComparatorCommandExecutor
  implements
    ComparatorCommandExecutor {
  public async run(
    command: string,
    args:
      readonly string[]
  ): Promise<string> {
    const result =
      await execFileAsync(
        command,
        [...args],
        {
          encoding: "utf8",
          timeout: 15_000,
          maxBuffer:
            2 * 1024 * 1024
        }
      );

    return result.stdout;
  }
}

export interface ComparatorReadiness {
  status:
    | "READY"
    | "BLOCKED_BROWSER_PROFILE";
  blockers:
    string[];
  identity:
    ComparatorAgentIdentity | null;
  browserInstanceId:
    string | null;
}

function versionSuffix(
  output: string
): string {
  const match =
    output.trim()
      .match(
        /([0-9]+(?:\.[0-9]+){1,3})/
      );

  if (
    match?.[1] ===
      undefined
  ) {
    throw new Error(
      "Unable to parse tool version: " +
        output.trim()
    );
  }

  return match[1];
}

function chromeMajor(
  version: string
): number {
  const major =
    Number.parseInt(
      version.split(
        "."
      )[0] ??
        "",
      10
    );

  if (
    !Number.isInteger(
      major
    )
  ) {
    throw new Error(
      "Unable to parse Chrome major version."
    );
  }

  return major;
}

export async function inspectComparatorReadiness(
  protocol:
    ComparatorProtocol,
  executor:
    ComparatorCommandExecutor =
      new LocalComparatorCommandExecutor()
): Promise<
  ComparatorReadiness
> {
  const [
    bskVersionOutput,
    codexVersionOutput,
    statusOutput
  ] =
    await Promise.all([
      executor.run(
        "bsk",
        [
          "--version"
        ]
      ),
      executor.run(
        "codex",
        [
          "--version"
        ]
      ),
      executor.run(
        "bsk",
        [
          "status",
          "--json"
        ]
      )
    ]);
  const bskVersion =
    versionSuffix(
      bskVersionOutput
    );
  const codexVersion =
    versionSuffix(
      codexVersionOutput
    );
  const status =
    StatusSchema.parse(
      JSON.parse(
        statusOutput
      )
    );
  const browsers =
    status.browsers;
  const required =
    browsers.filter(
      (browser) =>
        browser.label ===
          protocol.browser
            .requiredBrowserLabel
    );
  const blockers:
    string[] = [];

  if (
    bskVersion !==
      protocol.browser
        .cliVersion
  ) {
    blockers.push(
      "BrowserSkill CLI version mismatch: expected " +
        protocol.browser
          .cliVersion +
        ", got " +
        bskVersion
    );
  }

  if (
    codexVersion !==
      protocol.agent
        .harnessVersion
  ) {
    blockers.push(
      "Codex CLI version mismatch: expected " +
        protocol.agent
          .harnessVersion +
        ", got " +
        codexVersion
    );
  }

  if (
    status.daemon_version !==
      protocol.browser
        .daemonVersion
  ) {
    blockers.push(
      "BrowserSkill daemon version mismatch: expected " +
        protocol.browser
          .daemonVersion +
        ", got " +
        status.daemon_version
    );
  }

  if (
    status.protocol_version !==
      protocol.browser
        .daemonProtocolVersion
  ) {
    blockers.push(
      "BrowserSkill daemon protocol mismatch: expected " +
        protocol.browser
          .daemonProtocolVersion +
        ", got " +
        status.protocol_version
    );
  }

  if (
    status.ws_port !==
      protocol.browser
        .daemonWsPort
  ) {
    blockers.push(
      "BrowserSkill daemon WebSocket port mismatch: expected " +
        String(
          protocol.browser
            .daemonWsPort
        ) +
        ", got " +
        String(
          status.ws_port
        )
    );
  }

  if (
    required.length !==
      1
  ) {
    blockers.push(
      "Exactly one connected BrowserSkill browser must use label " +
        protocol.browser
          .requiredBrowserLabel +
        "; found " +
        String(
          required.length
        ) +
        "."
    );
  }

  const browser =
    required[0];

  if (
    browser !==
      undefined
  ) {
    if (
      browser.extension_version !==
        protocol.browser
          .extensionVersion
    ) {
      blockers.push(
        "BrowserSkill extension version mismatch: expected " +
          protocol.browser
            .extensionVersion +
          ", got " +
          browser.extension_version
      );
    }

    if (
      chromeMajor(
        browser.browser_version
      ) !==
        protocol.browser
          .chromeMajorVersion
    ) {
      blockers.push(
        "Chrome major version mismatch: expected " +
          String(
            protocol.browser
              .chromeMajorVersion
          ) +
          ", got " +
          browser.browser_version
      );
    }

    if (
      browser.version_skew
    ) {
      blockers.push(
        "BrowserSkill reports protocol/version skew for the dedicated comparator browser."
      );
    }
  }

  if (
    blockers.length >
      0
  ) {
    return {
      status:
        "BLOCKED_BROWSER_PROFILE",
      blockers,
      identity:
        null,
      browserInstanceId:
        browser?.instance_id ??
        null
    };
  }

  if (
    browser ===
      undefined
  ) {
    throw new Error(
      "Comparator browser disappeared during readiness inspection."
    );
  }

  return {
    status:
      "READY",
    blockers: [],
    browserInstanceId:
      browser.instance_id,
    identity: {
      harness:
        "codex-cli",
      harnessVersion:
        codexVersion,
      model:
        protocol.agent.model,
      browserSkillCliVersion:
        bskVersion,
      browserSkillExtensionVersion:
        browser.extension_version,
      browserVersion:
        browser.browser_version,
      browserLabel:
        browser.label
    }
  };
}
