import {
  readFile,
  writeFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";

import {
  ProspectResearchExecutionProfileSchema,
  type ProspectResearchExecutionProfile
} from "@astra/prospect-research";
import { z } from "zod";

export const GATE13_STAGEHAND_PACKAGE_PATH =
  "packages/agent-stagehand/package.json";
export const GATE13_STEEL_IMAGE_PIN_PATH =
  "infra/steel-image.txt";

const StagehandPackageSchema =
  z.object({
    dependencies:
      z.object({
        "@browserbasehq/stagehand":
          z.string()
            .trim()
            .min(1)
      }).passthrough()
  }).passthrough();

export interface Gate13ExecutionProfileInput {
  modelName: string;
  modelBaseUrl?:
    string | undefined;
  steelBaseUrl: string;
  stagehandPackageText: string;
  steelImagePinText: string;
}

function parseJson(
  text: string,
  label: string
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      label +
        " must be valid JSON."
    );
  }
}

function normalizedUrl(
  value: string
): string {
  return new URL(
    value
  ).href;
}

function requiredEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value.trim().length === 0
  ) {
    throw new Error(
      name +
        " is required to resolve the Gate 13 execution profile."
    );
  }

  return value.trim();
}

function optionalEnv(
  name: string
): string | undefined {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value.trim().length === 0
  ) {
    return undefined;
  }

  return value.trim();
}

export function buildGate13ExecutionProfile(
  input:
    Gate13ExecutionProfileInput
): ProspectResearchExecutionProfile {
  const stagehandPackage =
    StagehandPackageSchema
      .parse(
        parseJson(
          input
            .stagehandPackageText,
          "Stagehand package metadata"
        )
      );
  const modelBaseUrl =
    input.modelBaseUrl ===
      undefined
      ? null
      : normalizedUrl(
          input.modelBaseUrl
        );

  return ProspectResearchExecutionProfileSchema
    .parse({
      version:
        "gate13-execution-profile-v1",
      agentRuntime:
        "STAGEHAND",
      agentRuntimeVersion:
        stagehandPackage
          .dependencies[
            "@browserbasehq/stagehand"
          ],
      modelName:
        input.modelName.trim(),
      modelBaseUrl,
      browserRuntime:
        "STEEL",
      browserBaseUrl:
        normalizedUrl(
          input.steelBaseUrl
        ),
      browserExpectedImagePin:
        input
          .steelImagePinText
          .trim(),
      browserIdentityEvidence:
        "EXPECTED_IMAGE_PIN_ONLY"
    });
}

export function parseGate13ExecutionProfile(
  text: string
): ProspectResearchExecutionProfile {
  return ProspectResearchExecutionProfileSchema
    .parse(
      parseJson(
        text,
        "Gate 13 execution profile"
      )
    );
}

export async function currentGate13ExecutionProfile():
  Promise<
    ProspectResearchExecutionProfile
  > {
  const [
    stagehandPackageText,
    steelImagePinText
  ] =
    await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          GATE13_STAGEHAND_PACKAGE_PATH
        ),
        "utf8"
      ),
      readFile(
        resolve(
          process.cwd(),
          GATE13_STEEL_IMAGE_PIN_PATH
        ),
        "utf8"
      )
    ]);

  return buildGate13ExecutionProfile({
    modelName:
      requiredEnv(
        "GATE13_MODEL_NAME"
      ),
    modelBaseUrl:
      optionalEnv(
        "GATE13_MODEL_BASE_URL"
      ),
    steelBaseUrl:
      requiredEnv(
        "GATE13_STEEL_BASE_URL"
      ),
    stagehandPackageText,
    steelImagePinText
  });
}

export function serializeGate13ExecutionProfile(
  input:
    ProspectResearchExecutionProfile
): string {
  const profile =
    ProspectResearchExecutionProfileSchema
      .parse(input);

  return (
    JSON.stringify(
      profile,
      null,
      2
    ) +
    "\n"
  );
}

export async function exportGate13ExecutionProfile(
  outputPath: string,
  input:
    ProspectResearchExecutionProfile
): Promise<string> {
  const resolved =
    resolve(
      process.cwd(),
      outputPath
    );

  await writeFile(
    resolved,
    serializeGate13ExecutionProfile(
      input
    ),
    {
      encoding: "utf8",
      flag: "wx"
    }
  );

  return resolved;
}

function comparable(
  profile:
    ProspectResearchExecutionProfile
) {
  return {
    ...profile,
    modelBaseUrl:
      profile.modelBaseUrl ===
        null
        ? null
        : normalizedUrl(
            profile.modelBaseUrl
          ),
    browserBaseUrl:
      normalizedUrl(
        profile.browserBaseUrl
      )
  };
}

export function assertGate13ExecutionProfileMatches(
  expectedInput:
    ProspectResearchExecutionProfile,
  actualInput:
    ProspectResearchExecutionProfile
): void {
  const expected =
    comparable(
      ProspectResearchExecutionProfileSchema
        .parse(
          expectedInput
        )
    );
  const actual =
    comparable(
      ProspectResearchExecutionProfileSchema
        .parse(
          actualInput
        )
    );
  const mismatches:
    string[] = [];

  for (
    const key of [
      "version",
      "agentRuntime",
      "agentRuntimeVersion",
      "modelName",
      "modelBaseUrl",
      "browserRuntime",
      "browserBaseUrl",
      "browserExpectedImagePin",
      "browserIdentityEvidence"
    ] as const
  ) {
    if (
      expected[key] !==
        actual[key]
    ) {
      mismatches.push(
        key
      );
    }
  }

  if (
    mismatches.length >
      0
  ) {
    throw new Error(
      "Gate 13 live execution profile differs from the frozen sample: " +
        mismatches.join(
          ", "
        )
    );
  }
}
