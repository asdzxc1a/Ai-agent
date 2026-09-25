import {
  createHash
} from "node:crypto";
import {
  readFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";

import {
  ComparatorProtocolSchema,
  ComparatorReferenceCostPlanSchema,
  type ComparatorProtocol,
  type ComparatorReferenceCostPlan,
  type ComparatorTarget
} from "@astra/agent-comparator";
import {
  z
} from "zod";

const ManifestTargetSchema =
  z.object({
    targetId:
      z.string().min(1),
    companyName:
      z.string().min(1),
    canonicalDomain:
      z.string().min(1),
    startUrl:
      z.string().url(),
    approvedDomainsCandidate:
      z.array(
        z.string().min(1)
      ).min(1),
    approvalStatus:
      z.literal(
        "PENDING_OPERATOR_APPROVAL"
      )
  }).passthrough();

const ManifestSchema =
  z.object({
    id:
      z.string().min(1),
    universeId:
      z.string().min(1),
    status:
      z.literal(
        "NOT_APPROVED"
      ),
    targets:
      z.array(
        ManifestTargetSchema
      ).length(43)
  }).passthrough();

export const COMPARATOR_PROTOCOL_PATH =
  "docs/project/data/gate13-agent-comparator-v1.json";
export const COMPARATOR_PROMPT_PATH =
  "docs/project/data/gate13-agent-comparator-v1-prompt.md";
export const COMPARATOR_RESULT_SCHEMA_PATH =
  "docs/project/data/gate13-agent-comparator-v1-result.schema.json";
export const COMPARATOR_REVIEW_PROMPT_PATH =
  "docs/project/data/gate13-agent-comparator-model-review-v1-prompt.md";
export const COMPARATOR_REVIEW_SCHEMA_PATH =
  "docs/project/data/gate13-agent-comparator-model-review-v1.schema.json";
export const COMPARATOR_MANIFEST_PATH =
  "docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json";

function sha256(
  value: string
): string {
  return createHash(
    "sha256"
  )
    .update(
      value,
      "utf8"
    )
    .digest(
      "hex"
    );
}

export interface FrozenComparatorInputs {
  protocol:
    ComparatorProtocol;
  protocolText: string;
  protocolSha256: string;
  promptText: string;
  promptSha256: string;
  resultSchemaPath: string;
  reviewPromptText: string;
  reviewPromptSha256: string;
  reviewSchemaPath: string;
  costPlan:
    ComparatorReferenceCostPlan;
  costPlanText: string;
  costPlanSha256: string;
  manifestText: string;
  manifestSha256: string;
  targets:
    ComparatorTarget[];
}

export async function loadFrozenComparatorInputs(
  root = process.cwd()
): Promise<
  FrozenComparatorInputs
> {
  const [
    protocolText,
    promptText,
    reviewPromptText,
    manifestText
  ] =
    await Promise.all([
      readFile(
        resolve(
          root,
          COMPARATOR_PROTOCOL_PATH
        ),
        "utf8"
      ),
      readFile(
        resolve(
          root,
          COMPARATOR_PROMPT_PATH
        ),
        "utf8"
      ),
      readFile(
        resolve(
          root,
          COMPARATOR_REVIEW_PROMPT_PATH
        ),
        "utf8"
      ),
      readFile(
        resolve(
          root,
          COMPARATOR_MANIFEST_PATH
        ),
        "utf8"
      )
    ]);
  const protocol =
    ComparatorProtocolSchema
      .parse(
        JSON.parse(
          protocolText
        )
      );
  const promptSha256 =
    sha256(
      promptText
    );
  const reviewPromptSha256 =
    sha256(
      reviewPromptText
    );

  if (
    promptSha256 !==
      protocol.agent
        .promptSha256
  ) {
    throw new Error(
      "Comparator generator prompt hash does not match the frozen protocol."
    );
  }

  if (
    reviewPromptSha256 !==
      protocol.review
        .promptSha256
  ) {
    throw new Error(
      "Comparator review prompt hash does not match the frozen protocol."
    );
  }

  const costPlanText =
    await readFile(
      resolve(
        root,
        protocol.costAccounting
          .file
      ),
      "utf8"
    );
  const costPlanSha256 =
    sha256(
      costPlanText
    );

  if (
    costPlanSha256 !==
      protocol.costAccounting
        .sha256
  ) {
    throw new Error(
      "Comparator reference-cost plan hash does not match the frozen protocol."
    );
  }

  const costPlan =
    ComparatorReferenceCostPlanSchema
      .parse(
        JSON.parse(
          costPlanText
        )
      );

  if (
    costPlan.version !==
      protocol.costAccounting
        .version ||
    costPlan.accounting !==
      protocol.costAccounting
        .accounting
  ) {
    throw new Error(
      "Comparator reference-cost plan identity does not match the frozen protocol."
    );
  }

  const manifest =
    ManifestSchema.parse(
      JSON.parse(
        manifestText
      )
    );
  const manifestSha256 =
    sha256(
      manifestText
    );

  if (
    manifest.id !==
      protocol.sourceManifest.id ||
    manifestSha256 !==
      protocol.sourceManifest.sha256 ||
    manifest.targets.length !==
      protocol.sourceManifest.targetCount
  ) {
    throw new Error(
      "Comparator protocol does not match the exact frozen source manifest."
    );
  }

  return {
    protocol,
    protocolText,
    protocolSha256:
      sha256(
        protocolText
      ),
    promptText,
    promptSha256,
    resultSchemaPath:
      resolve(
        root,
        COMPARATOR_RESULT_SCHEMA_PATH
      ),
    reviewPromptText,
    reviewPromptSha256,
    reviewSchemaPath:
      resolve(
        root,
        COMPARATOR_REVIEW_SCHEMA_PATH
      ),
    costPlan,
    costPlanText,
    costPlanSha256,
    manifestText,
    manifestSha256,
    targets:
      manifest.targets.map(
        (
          target
        ) => ({
          id:
            target.targetId,
          companyName:
            target.companyName,
          startUrl:
            target.startUrl,
          approvedDomains:
            target
              .approvedDomainsCandidate
        })
      )
  };
}
