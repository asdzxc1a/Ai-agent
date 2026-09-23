import {
  describe,
  expect,
  test
} from "vitest";

import {
  ComparatorProtocolSchema
} from "@astra/agent-comparator";

import {
  inspectComparatorReadiness,
  type ComparatorCommandExecutor
} from "../src/readiness.js";

const protocol =
  ComparatorProtocolSchema
    .parse({
      version:
        "gate13-agent-comparator-v1",
      status:
        "PREPARED_NOT_AUTHORIZED",
      purpose:
        "AGENT_COMPARISON",
      comparator:
        "GENERAL_PURPOSE_BROWSER_AGENT",
      measurement:
        "MEASURED_AGENT",
      humanBaseline:
        "NOT_MEASURED",
      humanReview:
        "NOT_PERFORMED",
      sourceManifest: {
        id:
          "fixture",
        sha256:
          "a".repeat(64),
        targetCount: 43
      },
      requestedFields: [
        "companyName",
        "companySummary",
        "transformationOpportunities",
        "buyingSignals"
      ],
      browser: {
        interactionMode:
          "BROWSER_UI_AND_RENDERED_TEXT",
        skill:
          "BrowserSkill",
        cliVersion:
          "0.3.1",
        daemonVersion:
          "0.3.1",
        daemonProtocolVersion:
          "1.3",
        daemonWsPort:
          52800,
        extensionVersion:
          "0.3.1",
        chromeMajorVersion:
          153,
        browserProduct:
          "CHROME_FOR_TESTING",
        browserBuildVersion:
          "153.0.8010.52",
        credentialStore:
          "MOCK_KEYCHAIN",
        systemKeychainAccess:
          "FORBIDDEN",
        requiredBrowserLabel:
          "astra-agent-comparator",
        isolation:
          "DEDICATED_UNSIGNED_IN_PROFILE",
        enforcement:
          "CONNECTION_BOUND_PROXY_AND_GUARDED_BSK",
        allowedSearchDomains: [
          "duckduckgo.com"
        ],
        evidencePolicy:
          "OFFICIAL_APPROVED_DOMAIN_ONLY"
      },
      agent: {
        harness:
          "CODEX_CLI",
        harnessVersion:
          "0.154.0",
        model:
          "gpt-5.6-sol",
        freshContextPerTarget:
          true,
        serialExecution:
          true
      },
      execution: {
        maxElapsedMs:
          1_200_000,
        retainFirstAttempt:
          true,
        retries: 0,
        humanHelp:
          false,
        sideEffectPolicy:
          "READ_ONLY_BROWSER_RESEARCH"
      }
    });

class FixtureExecutor
  implements
    ComparatorCommandExecutor {
  readonly #withBrowser:
    boolean;

  public constructor(
    withBrowser:
      boolean
  ) {
    this.#withBrowser =
      withBrowser;
  }

  public async run(
    command: string,
    args:
      readonly string[]
  ): Promise<string> {
    if (
      command === "bsk" &&
      args[0] === "--version"
    ) {
      return "bsk 0.3.1\n";
    }

    if (
      command === "codex"
    ) {
      return "codex-cli 0.154.0\n";
    }

    if (
      command === "bsk" &&
      args[0] === "status"
    ) {
      return JSON.stringify({
        daemon_version:
          "0.3.1",
        protocol_version:
          "1.3",
        ws_port:
          52800,
        browsers:
          this.#withBrowser
            ? [
                {
                  instance_id:
                    "fixture-browser",
                  browser_name:
                    "chrome",
                  browser_version:
                    "153.0.8010.53",
                  extension_version:
                    "0.3.1",
                  label:
                    "astra-agent-comparator",
                  session_count: 0,
                  version_skew:
                    false
                }
              ]
            : []
      });
    }

    throw new Error(
      "Unexpected fixture command."
    );
  }
}

describe(
  "comparator readiness",
  () => {
    test(
      "requires the exact dedicated BrowserSkill profile and pinned tool versions",
      async () => {
        await expect(
          inspectComparatorReadiness(
            protocol,
            new FixtureExecutor(
              true
            )
          )
        ).resolves.toMatchObject({
          status:
            "READY",
          browserInstanceId:
            "fixture-browser",
          identity: {
            model:
              "gpt-5.6-sol",
            browserLabel:
              "astra-agent-comparator"
          }
        });
      }
    );

    test(
      "fails closed when the isolated BrowserSkill profile is not connected",
      async () => {
        const result =
          await inspectComparatorReadiness(
            protocol,
            new FixtureExecutor(
              false
            )
          );

        expect(
          result.status
        ).toBe(
          "BLOCKED_BROWSER_PROFILE"
        );
        expect(
          result.blockers.join(
            " "
          )
        ).toContain(
          "astra-agent-comparator"
        );
      }
    );
  }
);
