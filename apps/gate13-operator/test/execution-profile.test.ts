import {
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  assertGate13ExecutionProfileMatches,
  buildGate13ExecutionProfile,
  exportGate13ExecutionProfile,
  parseGate13ExecutionProfile,
  type Gate13ExecutionProfileInput
} from "../src/execution-profile.js";

const stagehandPackageText =
  JSON.stringify({
    dependencies: {
      "@browserbasehq/stagehand":
        "3.7.0"
    }
  });
const steelImagePinText =
  "ghcr.io/steel-dev/steel-browser@sha256:" +
  "a".repeat(64);

function profile() {
  return buildGate13ExecutionProfile({
    modelName:
      "openai/gpt-5-mini",
    modelBaseUrl:
      "https://models.example.test/v1",
    steelBaseUrl:
      "http://127.0.0.1:3000",
    egressProxyBrowserHost:
      "host.docker.internal",
    stagehandPackageText,
    steelImagePinText
  });
}

const driftCases:
  Array<
    [
      string,
      Partial<
        Gate13ExecutionProfileInput
      >
    ]
  > = [
    [
      "modelName",
      {
        modelName:
          "different-model"
      }
    ],
    [
      "modelBaseUrl",
      {
        modelBaseUrl:
          "https://other.example.test/v1"
      }
    ],
    [
      "browserBaseUrl",
      {
        steelBaseUrl:
          "http://127.0.0.1:3001"
      }
    ],
    [
      "networkEgressProxyBrowserHost",
      {
        egressProxyBrowserHost:
          "steel-proxy.internal"
      }
    ],
    [
      "agentRuntimeVersion",
      {
        stagehandPackageText:
          JSON.stringify({
            dependencies: {
              "@browserbasehq/stagehand":
                "3.8.0"
            }
          })
      }
    ],
    [
      "browserExpectedImagePin",
      {
        steelImagePinText:
          "ghcr.io/steel-dev/steel-browser@sha256:" +
          "b".repeat(64)
      }
    ]
  ];

describe(
  "Gate 13 execution profile",
  () => {
    it(
      "freezes model/runtime versions, canonical endpoints, and the expected Steel image pin",
      () => {
        expect(
          profile()
        ).toEqual({
          version:
            "gate13-execution-profile-v2",
          agentRuntime:
            "STAGEHAND",
          agentRuntimeVersion:
            "3.7.0",
          modelName:
            "openai/gpt-5-mini",
          modelBaseUrl:
            "https://models.example.test/v1",
          browserRuntime:
            "STEEL",
          browserBaseUrl:
            "http://127.0.0.1:3000/",
          browserExpectedImagePin:
            steelImagePinText,
          browserIdentityEvidence:
            "EXPECTED_IMAGE_PIN_ONLY",
          networkEgressMode:
            "ASTRA_CONNECTION_BOUND_PROXY_V1",
          networkEgressProxyBrowserHost:
            "host.docker.internal"
        });
      }
    );

    it(
      "accepts equivalent URL spellings after canonicalization",
      () => {
        const expected =
          profile();
        const actual =
          buildGate13ExecutionProfile({
            modelName:
              "openai/gpt-5-mini",
            modelBaseUrl:
              "https://models.example.test/v1",
            steelBaseUrl:
              "http://127.0.0.1:3000/",
            egressProxyBrowserHost:
              "host.docker.internal",
            stagehandPackageText,
            steelImagePinText
          });

        expect(() =>
          assertGate13ExecutionProfileMatches(
            expected,
            actual
          )
        ).not.toThrow();
      }
    );

    it.each(
      driftCases
    )(
      "rejects %s drift before live execution",
      (
        field,
        overrides
      ) => {
        const expected =
          profile();
        const actual =
          buildGate13ExecutionProfile({
            modelName:
              "openai/gpt-5-mini",
            modelBaseUrl:
              "https://models.example.test/v1",
            steelBaseUrl:
              "http://127.0.0.1:3000",
            egressProxyBrowserHost:
              "host.docker.internal",
            stagehandPackageText,
            steelImagePinText,
            ...overrides
          });

        expect(() =>
          assertGate13ExecutionProfileMatches(
            expected,
            actual
          )
        ).toThrow(
          field
        );
      }
    );

    it(
      "exports parser-ready credential-free profile bytes and refuses overwrite",
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              "gate13-execution-profile-"
            )
          );
        const path =
          join(
            directory,
            "execution-profile.json"
          );

        try {
          await expect(
            exportGate13ExecutionProfile(
              path,
              profile()
            )
          ).resolves.toBe(
            path
          );

          const text =
            await readFile(
              path,
              "utf8"
            );

          expect(
            parseGate13ExecutionProfile(
              text
            )
          ).toEqual(
            profile()
          );
          expect(
            text
          ).not.toContain(
            "apiKey"
          );

          await expect(
            exportGate13ExecutionProfile(
              path,
              profile()
            )
          ).rejects.toMatchObject({
            code:
              "EEXIST"
          });
        } finally {
          await rm(
            directory,
            {
              recursive: true,
              force: true
            }
          );
        }
      }
    );

    it(
      "rejects execution-profile files that omit expected Steel identity semantics",
      () => {
        expect(() =>
          parseGate13ExecutionProfile(
            JSON.stringify({
              version:
                "gate13-execution-profile-v2",
              agentRuntime:
                "STAGEHAND",
              agentRuntimeVersion:
                "3.7.0",
              modelName:
                "openai/gpt-5-mini",
              modelBaseUrl:
                null,
              browserRuntime:
                "STEEL",
              browserBaseUrl:
                "http://127.0.0.1:3000/"
            })
          )
        ).toThrow();
      }
    );
  }
);
