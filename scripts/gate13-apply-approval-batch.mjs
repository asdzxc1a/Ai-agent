import {
  readFile
} from "node:fs/promises";

function fail(message) {
  throw new Error(
    "Gate 13 approval apply failed: " +
      message
  );
}

function option(args, name) {
  const index =
    args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value =
    args[index + 1];

  if (
    value === undefined ||
    value.startsWith("--")
  ) {
    fail(
      name +
        " requires a value"
    );
  }

  return value;
}

async function main() {
  const args =
    process.argv.slice(2);

  if (
    !args.includes(
      "--execute"
    )
  ) {
    fail(
      "--execute is required for the database write"
    );
  }

  const batchFile =
    option(
      args,
      "--batch-file"
    );
  const confirmedSha =
    option(
      args,
      "--confirm-manifest-sha"
    );
  const confirmedBatchId =
    option(
      args,
      "--confirm-batch-id"
    );
  const confirmedCount =
    option(
      args,
      "--confirm-target-count"
    );
  const connectionString =
    process.env
      .ASTRA_PROSPECT_DATABASE_URL;

  if (batchFile === undefined) {
    fail(
      "--batch-file is required"
    );
  }

  if (
    confirmedSha ===
      undefined ||
    confirmedBatchId ===
      undefined ||
    confirmedCount ===
      undefined
  ) {
    fail(
      "manifest SHA, batch ID, and target count confirmations are required"
    );
  }

  if (
    connectionString ===
    undefined
  ) {
    fail(
      "ASTRA_PROSPECT_DATABASE_URL is required"
    );
  }

  const raw =
    await readFile(
      batchFile,
      "utf8"
    );
  const parsed =
    JSON.parse(raw);
  const {
    ResearchApprovalBatchSchema
  } =
    await import(
      "../packages/prospect-research/dist/index.js"
    );
  const {
    createProspectPostgresPool,
    PostgresProspectResearchRepository,
    runProspectPostgresMigrations
  } =
    await import(
      "../packages/prospect-postgres/dist/index.js"
    );
  const batch =
    ResearchApprovalBatchSchema
      .parse(parsed);

  if (
    batch
      .sourceManifestSha256 !==
    confirmedSha
  ) {
    fail(
      "confirmed manifest SHA does not match approval batch"
    );
  }

  if (
    batch.id !==
    confirmedBatchId
  ) {
    fail(
      "confirmed batch ID does not match approval batch"
    );
  }

  if (
    String(
      batch.targets.length
    ) !==
    confirmedCount
  ) {
    fail(
      "confirmed target count does not match approval batch"
    );
  }

  const pool =
    createProspectPostgresPool({
      connectionString,
      max: 2
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

    const persisted =
      await repository
        .getApprovalBatch(
          batch.id
        );

    if (
      JSON.stringify(
        persisted
      ) !==
      JSON.stringify(
        batch
      )
    ) {
      fail(
        "persisted approval batch did not round-trip exactly"
      );
    }

    process.stdout.write(
      JSON.stringify(
        {
          applied: true,
          batchId:
            batch.id,
          sourceManifestId:
            batch
              .sourceManifestId,
          sourceManifestSha256:
            batch
              .sourceManifestSha256,
          targetCount:
            batch.targets.length
        },
        null,
        2
      ) + "\n"
    );
  } finally {
    await pool.end();
  }
}

await main();
