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
  type ComparatorProtocol,
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
    promptSha256:
      sha256(
        promptText
      ),
    resultSchemaPath:
      resolve(
        root,
        COMPARATOR_RESULT_SCHEMA_PATH
      ),
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
