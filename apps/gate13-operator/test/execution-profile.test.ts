import {
  describe,
  expect,
  it
} from "vitest";

import {
  assertGate13ExecutionProfileMatches,
  buildGate13ExecutionProfile,
  parseGate13ExecutionProfile
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
    stagehandPackageText,
    steelImagePinText
  });
}

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
            "gate13-execution-profile-v1",
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
            "EXPECTED_IMAGE_PIN_ONLY"
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

    it.each([
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
    ])(
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
          String(field)
        );
      }
    );

    it(
      "rejects execution-profile files that omit expected Steel identity semantics",
      () => {
        expect(() =>
          parseGate13ExecutionProfile(
            JSON.stringify({
              version:
                "gate13-execution-profile-v1",
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
