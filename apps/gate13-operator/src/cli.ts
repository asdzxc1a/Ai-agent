import {
  readFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";

import {
  createProspectPostgresPool,
  PostgresProspectResearchRepository,
  runProspectPostgresMigrations
} from "@astra/prospect-postgres";

import {
  GATE13_APPROVAL_MANIFEST_PATH,
  assertGate13ApprovalConfirmation,
  buildGate13ApprovalBatchFromManifest,
  previewGate13ApprovalManifest
} from "./approval.js";

interface ApproveArgs {
  batchId: string;
  operator: string;
  confirmManifestId: string;
  confirmSha256: string;
  authorizeAll43: boolean;
}

function usage(): string {
  return [
    "Gate 13 approval operator",
    "",
    "Preview only:",
    "  pnpm gate13:approval -- preview",
    "",
    "Persist the exact 43-target manifest as one atomic approval batch:",
    "  GATE13_DATABASE_URL=postgresql://... pnpm gate13:approval -- approve \\",
    "    --batch-id <id> \\",
    "    --operator <identity> \\",
    "    --confirm-manifest-id <manifest-id> \\",
    "    --confirm-sha <sha256> \\",
    "    --authorize-all-43",
    "",
    "The approve command derives every target from the exact checked-in manifest bytes.",
    "It does not browse, contact, authenticate, write CRM data, schedule, or send messages."
  ].join("\n");
}

function requiredOption(
  args: string[],
  name: string
): string {
  const index =
    args.indexOf(name);

  if (
    index < 0 ||
    args[index + 1] ===
      undefined
  ) {
    throw new Error(
      "Missing required option: " +
        name
    );
  }

  return args[index + 1]!;
}

function parseApproveArgs(
  args: string[]
): ApproveArgs {
  const allowed =
    new Set([
      "--batch-id",
      "--operator",
      "--confirm-manifest-id",
      "--confirm-sha",
      "--authorize-all-43"
    ]);

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const value =
      args[index]!;

    if (!allowed.has(value)) {
      throw new Error(
        "Unknown approve option: " +
          value
      );
    }

    if (
      value !==
        "--authorize-all-43"
    ) {
      index += 1;

      if (
        args[index] ===
          undefined
      ) {
        throw new Error(
          "Missing value for option: " +
            value
        );
      }
    }
  }

  return {
    batchId:
      requiredOption(
        args,
        "--batch-id"
      ),
    operator:
      requiredOption(
        args,
        "--operator"
      ),
    confirmManifestId:
      requiredOption(
        args,
        "--confirm-manifest-id"
      ),
    confirmSha256:
      requiredOption(
        args,
        "--confirm-sha"
      ),
    authorizeAll43:
      args.includes(
        "--authorize-all-43"
      )
  };
}

async function manifestText():
  Promise<string> {
  return readFile(
    resolve(
      process.cwd(),
      GATE13_APPROVAL_MANIFEST_PATH
    ),
    "utf8"
  );
}

async function preview():
  Promise<void> {
  const text =
    await manifestText();
  const current =
    previewGate13ApprovalManifest(
      text
    );

  console.log(
    JSON.stringify(
      {
        action:
          "PREVIEW_ONLY",
        manifest: {
          id:
            current.manifest.id,
          universeId:
            current.manifest
              .universeId,
          status:
            current.manifest.status,
          sha256:
            current.sha256,
          targetCount:
            current.manifest
              .targets.length
        },
        targets:
          current.manifest
            .targets.map(
              (target) => ({
                ticker:
                  target.ticker,
                targetId:
                  target.targetId,
                companyName:
                  target.companyName,
                canonicalDomain:
                  target
                    .canonicalDomain,
                startUrl:
                  target.startUrl,
                approvedDomainsCandidate:
                  target
                    .approvedDomainsCandidate,
                verificationSourceUrl:
                  target
                    .verificationSourceUrl,
                verificationSourceKind:
                  target
                    .verificationSourceKind,
                approvalStatus:
                  target
                    .approvalStatus
              })
            ),
        note:
          "Preview does not authorize or persist any target."
      },
      null,
      2
    )
  );
}

async function approve(
  args: string[]
): Promise<void> {
  const options =
    parseApproveArgs(args);
  const text =
    await manifestText();
  const current =
    previewGate13ApprovalManifest(
      text
    );

  assertGate13ApprovalConfirmation(
    current,
    {
      confirmManifestId:
        options
          .confirmManifestId,
      confirmSha256:
        options.confirmSha256,
      authorizeAll43:
        options.authorizeAll43
    }
  );

  const connectionString =
    process.env[
      "GATE13_DATABASE_URL"
    ];

  if (
    connectionString ===
      undefined ||
    connectionString.trim()
      .length === 0
  ) {
    throw new Error(
      "GATE13_DATABASE_URL is required for Gate 13 approval persistence."
    );
  }

  const approvedAt =
    new Date().toISOString();
  const batch =
    buildGate13ApprovalBatchFromManifest({
      manifestText:
        text,
      batchId:
        options.batchId,
      approvedBy:
        options.operator,
      approvedAt
    });
  const pool =
    createProspectPostgresPool({
      connectionString
    });

  try {
    await runProspectPostgresMigrations(
      pool
    );

    const repository =
      new PostgresProspectResearchRepository(
        pool
      );

    await repository
      .saveTargetBatch(
        batch
      );
  } finally {
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        action:
          "APPROVAL_BATCH_PERSISTED",
        batchId:
          batch.id,
        sourceManifestId:
          batch.sourceManifestId,
        sourceManifestSha256:
          batch
            .sourceManifestSha256,
        approvedBy:
          batch.approvedBy,
        approvedAt:
          batch.approvedAt,
        targetCount:
          batch.targets.length
      },
      null,
      2
    )
  );
}

async function main():
  Promise<void> {
  const [
    command,
    ...args
  ] =
    process.argv.slice(2);

  if (
    command ===
      undefined ||
    command ===
      "--help" ||
    command ===
      "-h"
  ) {
    console.log(
      usage()
    );
    return;
  }

  if (
    command ===
      "preview"
  ) {
    if (
      args.length >
        0
    ) {
      throw new Error(
        "Preview accepts no options."
      );
    }

    await preview();
    return;
  }

  if (
    command ===
      "approve"
  ) {
    await approve(args);
    return;
  }

  throw new Error(
    "Unknown Gate 13 approval command: " +
      command +
      "\n\n" +
      usage()
  );
}

void main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "Gate 13 approval command failed: " +
        message
    );
    process.exitCode = 1;
  }
);
