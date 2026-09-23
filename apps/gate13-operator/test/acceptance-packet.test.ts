import {
  readFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";

import {
  calculateProspectResearchDeliveryCost,
  ProspectResearchDeliveryCostPlanSchema,
  ProspectResearchExecutionProfileSchema
} from "@astra/prospect-research";
import {
  describe,
  expect,
  test
} from "vitest";
import { z } from "zod";

import {
  previewGate13ApprovalManifest
} from "../src/approval.js";
import {
  buildGate13ExecutionProfile
} from "../src/execution-profile.js";
import {
  gate13AcceptanceInputPreflight
} from "../src/preflight.js";
import {
  parseGate13Universe
} from "../src/experiment.js";

const PacketSchema =
  z.object({
    version:
      z.literal(
        "gate13-acceptance-packet-v1"
      ),
    status:
      z.literal(
        "PREPARED_NOT_AUTHORIZED"
      ),
    preparedAsOfDate:
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/
      ),
    manifestId:
      z.string().min(1),
    manifestSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    universeId:
      z.string().min(1),
    targetCount:
      z.literal(43),
    maxDeliveryCostUsdPerBrief:
      z.number()
        .positive(),
    executionProfileFile:
      z.string().min(1),
    costPlanFile:
      z.string().min(1),
    costRationaleFile:
      z.string().min(1),
    humanBaselineFile:
      z.string().min(1),
    modelSelection:
      z.object({
        modelName:
          z.literal(
            "openai/gpt-5.6-sol"
          ),
        reason:
          z.string().min(1)
      }).strict(),
    authorization:
      z.object({
        authorized:
          z.literal(false),
        note:
          z.string().min(1)
      }).strict()
  }).strict();

async function text(
  path: string
): Promise<string> {
  return readFile(
    resolve(
      process.cwd(),
      path
    ),
    "utf8"
  );
}

describe(
  "Gate 13 checked-in acceptance packet",
  () => {
    test(
      "reproduces PREPARED_NOT_AUTHORIZED against canonical repo inputs",
      async () => {
        const packet =
          PacketSchema.parse(
            JSON.parse(
              await text(
                "docs/project/data/gate13-acceptance-packet-2026-09-23.json"
              )
            )
          );
        const [
          manifestText,
          universeText,
          executionProfileText,
          costPlanText,
          costRationale,
          humanBaselineDescription,
          stagehandPackageText,
          steelImagePinText
        ] =
          await Promise.all([
            text(
              "docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json"
            ),
            text(
              "docs/project/data/gate13-us-transportation-universe-2026-09-17.json"
            ),
            text(
              packet
                .executionProfileFile
            ),
            text(
              packet.costPlanFile
            ),
            text(
              packet
                .costRationaleFile
            ),
            text(
              packet
                .humanBaselineFile
            ),
            text(
              "packages/agent-stagehand/package.json"
            ),
            text(
              "infra/steel-image.txt"
            )
          ]);
        const manifest =
          previewGate13ApprovalManifest(
            manifestText
          );
        const universe =
          parseGate13Universe(
            universeText
          );
        const expectedProfile =
          ProspectResearchExecutionProfileSchema
            .parse(
              JSON.parse(
                executionProfileText
              )
            );
        const actualProfile =
          buildGate13ExecutionProfile({
            modelName:
              "openai/gpt-5.6-sol",
            modelBaseUrl:
              "https://api.openai.com/v1/",
            steelBaseUrl:
              "http://127.0.0.1:3000/",
            egressProxyBrowserHost:
              "host.docker.internal",
            stagehandPackageText,
            steelImagePinText
          });
        const costPlan =
          ProspectResearchDeliveryCostPlanSchema
            .parse(
              JSON.parse(
                costPlanText
              )
            );

        expect(
          manifest.manifest.id
        ).toBe(
          packet.manifestId
        );
        expect(
          manifest.sha256
        ).toBe(
          packet.manifestSha256
        );
        expect(
          universe.id
        ).toBe(
          packet.universeId
        );
        expect(
          manifest.manifest
            .targets
        ).toHaveLength(
          packet.targetCount
        );
        expect(
          expectedProfile.modelName
        ).toBe(
          packet.modelSelection
            .modelName
        );

        const costEvidence =
          calculateProspectResearchDeliveryCost(
            costPlan,
            {
              modelUsage: {
                promptTokens:
                  500_000,
                completionTokens:
                  50_000,
                reasoningTokens:
                  10_000,
                cachedInputTokens:
                  100_000
              },
              runDurationMs:
                30 * 60 * 1000
            },
            "run.packet.reference"
          );

        expect(
          costEvidence.totalUsd
        ).toBeCloseTo(
          3.1664,
          8
        );
        expect(
          costEvidence
            .components.map(
              (component) =>
                component.rateId
            )
        ).toEqual([
          "gate13.openai.gpt-5.6-sol.input",
          "gate13.openai.gpt-5.6-sol.output",
          "gate13.self-hosted-steel.reference-compute"
        ]);

        expect(
          gate13AcceptanceInputPreflight({
            manifest: {
              id:
                manifest.manifest.id,
              sha256:
                manifest.sha256,
              status:
                manifest.manifest
                  .status,
              targetIds:
                manifest.manifest
                  .targets.map(
                    (target) =>
                      target.targetId
                  )
            },
            universe: {
              id:
                universe.id,
              targetIds:
                universe.members.map(
                  (member) =>
                    member.targetId
                )
            },
            expectedExecutionProfile:
              expectedProfile,
            actualExecutionProfile:
              actualProfile,
            deliveryCostPlan:
              costPlan,
            maxDeliveryCostUsdPerBrief:
              packet
                .maxDeliveryCostUsdPerBrief,
            costCeilingRationale:
              costRationale,
            humanBaselineDescription,
            preflightAt:
              "2026-09-23T12:00:00.000Z"
          })
        ).toMatchObject({
          status:
            "PREPARED_NOT_AUTHORIZED",
          manifestId:
            packet.manifestId,
          manifestSha256:
            packet.manifestSha256,
          universeId:
            packet.universeId,
          targetCount: 43,
          maxDeliveryCostUsdPerBrief:
            5,
          costRateCount: 3,
          costCategories: [
            "BROWSER_PROVIDER",
            "MODEL"
          ]
        });
      }
    );
  }
);
