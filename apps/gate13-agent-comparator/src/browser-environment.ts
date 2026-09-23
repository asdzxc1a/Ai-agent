import {
  execFile
} from "node:child_process";
import {
  homedir
} from "node:os";
import {
  join
} from "node:path";
import {
  spawn,
  type ChildProcess
} from "node:child_process";
import {
  promisify
} from "node:util";

import type {
  ComparatorProtocol,
  ComparatorTarget
} from "@astra/agent-comparator";
import {
  ConnectionBoundEgressProxy,
  DefaultSandboxNetworkPolicy
} from "@astra/sandbox-runtime";
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
    label:
      z.string(),
    session_count:
      z.number()
        .int()
        .nonnegative()
  }).passthrough();

const BrowsersSchema =
  z.array(
    BrowserSchema
  );

export interface ComparatorBrowserEnvironmentOptions {
  profileDir?: string;
  chromeBin?: string;
  extensionDir?: string;
  bskBin?: string;
  trustedHostnames?:
    readonly string[];
}

export interface StartedComparatorBrowserEnvironment {
  browserInstanceId:
    string;
  proxyUrl: string;
  proxyBypassList:
    string;
  close():
    Promise<void>;
}

export interface ComparatorChromeArgumentsInput {
  profileDir: string;
  extensionDir: string;
  proxyUrl: string;
  proxyBypassList:
    string;
}

export function comparatorChromeArguments(
  input:
    ComparatorChromeArgumentsInput
): string[] {
  return [
    "--user-data-dir=" +
      input.profileDir,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--use-mock-keychain",
    "--password-store=basic",
    "--disable-features=SigninPromo,PasswordManagerOnboarding,PasswordManagerRedesign,AutofillServerCommunication",
    "--disable-extensions-except=" +
      input.extensionDir,
    "--load-extension=" +
      input.extensionDir,
    "--proxy-server=" +
      input.proxyUrl,
    "--proxy-bypass-list=" +
      input.proxyBypassList,
    "about:blank"
  ];
}

export function comparatorProxyBypassList(
  daemonWsPort: number
): string {
  return (
    "<-loopback>;ws://127.0.0.1:" +
    String(
      daemonWsPort
    )
  );
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

async function chromeBuildVersion(
  chromeBin: string
): Promise<string> {
  const result =
    await execFileAsync(
      chromeBin,
      [
        "--version"
      ],
      {
        encoding:
          "utf8",
        timeout:
          5_000
      }
    );
  const match =
    result.stdout.trim()
      .match(
        /(\d+\.\d+\.\d+\.\d+)/
      );

  if (
    match?.[1] ===
      undefined
  ) {
    throw new Error(
      "Unable to parse Chrome for Testing build version."
    );
  }

  return match[1];
}

async function profileAlreadyRunning(
  profileDir: string
): Promise<boolean> {
  const output =
    await execFileAsync(
      "ps",
      [
        "-axo",
        "command="
      ],
      {
        encoding:
          "utf8"
      }
    );

  return output.stdout
    .split(
      "\n"
    )
    .some(
      (line) =>
        line.includes(
          "--user-data-dir=" +
            profileDir
        )
    );
}

async function waitForBrowser(
  bskBin: string,
  label: string,
  child: ChildProcess
): Promise<string> {
  for (
    let attempt = 0;
    attempt < 40;
    attempt += 1
  ) {
    if (
      child.exitCode !==
        null
    ) {
      throw new Error(
        "Dedicated comparator Chrome exited before BrowserSkill connected."
      );
    }

    try {
      const result =
        await execFileAsync(
          bskBin,
          [
            "browsers",
            "--json"
          ],
          {
            encoding:
              "utf8",
            timeout: 5_000
          }
        );
      const browsers =
        BrowsersSchema.parse(
          JSON.parse(
            result.stdout
          )
        );
      const matches =
        browsers.filter(
          (browser) =>
            browser.label ===
              label
        );

      if (
        matches.length ===
          1
      ) {
        const browser =
          matches[0];

        if (
          browser ===
            undefined
        ) {
          throw new Error(
            "Comparator browser disappeared."
          );
        }

        if (
          browser.session_count !==
            0
        ) {
          throw new Error(
            "Dedicated comparator browser has an active BrowserSkill session before the run."
          );
        }

        return browser
          .instance_id;
      }

      if (
        matches.length >
          1
      ) {
        throw new Error(
          "More than one BrowserSkill browser uses the dedicated comparator label."
        );
      }
    } catch {
      // Browser/extension may still be starting.
    }

    await sleep(
      250
    );
  }

  throw new Error(
    "Dedicated comparator BrowserSkill profile did not connect. Install/enable BrowserSkill in the isolated profile and set its label to the frozen comparator label."
  );
}

export async function startComparatorBrowserEnvironment(
  target:
    ComparatorTarget,
  protocol:
    ComparatorProtocol,
  options:
    ComparatorBrowserEnvironmentOptions = {}
): Promise<
  StartedComparatorBrowserEnvironment
> {
  const profileDir =
    options.profileDir ??
    join(
      homedir(),
      "Astra",
      "browser-skill-comparator-profile-cft"
    );
  const chromeBin =
    options.chromeBin ??
    join(
      homedir(),
      "Astra",
      "chrome-for-testing-153",
      "chrome-mac-arm64",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing"
    );
  const extensionDir =
    options.extensionDir ??
    join(
      homedir(),
      ".astra",
      "browser-skill-extension-0.3.1"
    );
  const bskBin =
    options.bskBin ??
    join(
      homedir(),
      ".local",
      "bin",
      "bsk"
    );
  const actualBrowserBuild =
    await chromeBuildVersion(
      chromeBin
    );

  if (
    actualBrowserBuild !==
      protocol.browser
        .browserBuildVersion
  ) {
    throw new Error(
      "Chrome for Testing build mismatch: expected " +
        protocol.browser
          .browserBuildVersion +
        ", got " +
        actualBrowserBuild
    );
  }

  if (
    await profileAlreadyRunning(
      profileDir
    )
  ) {
    throw new Error(
      "Dedicated comparator browser profile is already running. Close it before a measured run so the runner can launch it behind the frozen egress proxy."
    );
  }

  const policy =
    new DefaultSandboxNetworkPolicy({
      allowedDomains: [
        ...target
          .approvedDomains,
        ...protocol
          .browser
          .allowedSearchDomains
      ],
      trustedHostnames:
        options.trustedHostnames ??
        [],
      allowedPorts: [
        80,
        443
      ]
    });
  const proxy =
    await ConnectionBoundEgressProxy
      .start(
        policy,
        {
          listenHostname:
            "127.0.0.1",
          browserHostname:
            "127.0.0.1"
        }
      );
  const proxyBypassList =
    comparatorProxyBypassList(
      protocol.browser
        .daemonWsPort
    );
  const child =
    spawn(
      chromeBin,
      comparatorChromeArguments({
        profileDir,
        extensionDir,
        proxyUrl:
          proxy.proxyUrl,
        proxyBypassList
      }),
      {
        stdio:
          "ignore",
        detached:
          false
      }
    );

  try {
    const browserInstanceId =
      await waitForBrowser(
        bskBin,
        protocol.browser
          .requiredBrowserLabel,
        child
      );

    return {
      browserInstanceId,
      proxyUrl:
        proxy.proxyUrl,
      proxyBypassList,
      async close() {
        if (
          child.exitCode ===
            null
        ) {
          child.kill(
            "SIGTERM"
          );
        }

        await Promise.allSettled([
          new Promise<void>(
            (resolveExit) => {
              if (
                child.exitCode !==
                  null
              ) {
                resolveExit();
                return;
              }

              const timer =
                setTimeout(
                  () => {
                    child.kill(
                      "SIGKILL"
                    );
                    resolveExit();
                  },
                  5_000
                );

              child.once(
                "exit",
                () => {
                  clearTimeout(
                    timer
                  );
                  resolveExit();
                }
              );
            }
          ),
          proxy.close()
        ]);
      }
    };
  } catch (error) {
    child.kill(
      "SIGTERM"
    );
    await proxy.close();
    throw error;
  }
}
