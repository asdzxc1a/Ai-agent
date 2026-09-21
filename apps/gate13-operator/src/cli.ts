import {
  readFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";
import {
  setTimeout as delay
} from "node:timers/promises";

import {
  LocalArtifactStore
} from "@astra/artifact-store";
import {
  LIVE_RESEARCH_FAILURE_CODES,
  evaluateProspectResearchSample
} from "@astra/prospect-research";
import { z } from "zod";

import {
  GATE13_APPROVAL_MANIFEST_PATH,
  assertGate13ApprovalConfirmation,
  buildGate13ApprovalBatchFromManifest,
  previewGate13ApprovalManifest
} from "./approval.js";
import {
  GATE13_UNIVERSE_PATH,
  assertGate13ExecutionProfile,
  buildGate13AcceptanceSample,
  buildGate13DeliveryCostEvidenceFromRunSummary,
  buildGate13HumanBaselineInput,
  buildGate13SampleOutcome,
  parseGate13DeliveryCostPlan,
  parseGate13ExecutionProfile,
  parseGate13OutcomeReview
} from "./experiment.js";
import {
  gate13ArtifactDir,
  withGate13Database,
  withGate13DatabaseReadOnly,
  withGate13FailureContext,
  withGate13ReviewContext,
  withGate13Workflow,
  type Gate13DatabaseContext
} from "./runtime.js";

interface ParsedOptions {
  values:
    Map<string, string>;
  flags:
    Set<string>;
}

const ArtifactMappingSchema =
  z.record(
    z.string().trim().min(1),
    z.array(
      z.string().trim().min(1)
    ).min(1)
  );

const FailureCodeSchema =
  z.enum(
    LIVE_RESEARCH_FAILURE_CODES
  );

const RunSummaryUsageSchema =
  z.object({
    runId:
      z.string().trim().min(1),
    modelUsage:
      z.object({
        promptTokens:
          z.number()
            .finite()
            .nonnegative(),
        completionTokens:
          z.number()
            .finite()
            .nonnegative(),
        reasoningTokens:
          z.number()
            .finite()
            .nonnegative(),
        cachedInputTokens:
          z.number()
            .finite()
            .nonnegative(),
        inferenceTimeMs:
          z.number()
            .finite()
            .nonnegative()
      }).strict()
        .optional(),
    timings:
      z.record(
        z.string(),
        z.number()
          .finite()
          .nonnegative()
      ).optional()
  }).passthrough();

function usage(): string {
  return [
    "Gate 13 operator",
    "",
    "Approval inspection/persistence:",
    "  pnpm gate13:operator -- preview",
    "  GATE13_DATABASE_URL=postgresql://... pnpm gate13:operator -- approve \\",
    "    --batch-id <id> --operator <identity> \\",
    "    --confirm-manifest-id <id> --confirm-sha <sha256> --authorize-all-43",
    "",
    "Acceptance sample:",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- sample-preview \\",
    "    --approval-batch-id <id> --sample-id <id> --operator <identity> \\",
    "    --max-cost-usd <positive> --execution-profile-file <path> --cost-plan-file <path> \",
    "    --cost-rationale-file <path> --human-baseline-file <path>",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- freeze-acceptance <same options> --confirm-complete-universe",
    "",
    "Measured human baseline:",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- record-baseline \\",
    "    --sample-id <id> --target-id <id> --prepared-by <identity> --minutes <positive> \\",
    "    --tooling-file <path> [--notes-file <path>]",
    "",
    "Serial read-only research:",
    "  GATE13_DATABASE_URL=... GATE13_ARTIFACT_DIR=... GATE13_STEEL_BASE_URL=... GATE13_MODEL_NAME=... \\",
    "    pnpm gate13:operator -- run-target --sample-id <id> --target-id <id>",
    "  pnpm gate13:operator -- artifacts --run-id <id>",
    "  GATE13_ARTIFACT_DIR=... pnpm gate13:operator -- run-usage --run-id <id>",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- run-status --run-id <id>",
    "",
    "Attempt review/persistence:",
    "  GATE13_DATABASE_URL=... GATE13_ARTIFACT_DIR=... pnpm gate13:operator -- review-completed \\",
    "    --target-id <id> --run-id <id> --mapping-file <path> --human-audit-complete",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- record-failure \\",
    "    --target-id <id> --run-id <id> [--code <failure-code>]",
    "",
    "Outcome/evaluation:",
    "  GATE13_DATABASE_URL=... GATE13_ARTIFACT_DIR=... pnpm gate13:operator -- record-outcome \\",
    "    --sample-id <id> --target-id <id> --attempt-id <id> --review-file <path>",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- sample-status --sample-id <id>",
    "  GATE13_DATABASE_URL=... pnpm gate13:operator -- evaluate --sample-id <id>",
    "",
    "Optional model settings for run-target:",
    "  GATE13_MODEL_API_KEY=<secret>",
    "  GATE13_MODEL_BASE_URL=<provider base URL>",
    "",
    "No command broadens the frozen target scope. run-target is read-only and the workflow never calls act()."
  ].join("\n");
}

function parseOptions(
  args: string[],
  valueNames:
    readonly string[],
  flagNames:
    readonly string[] = []
): ParsedOptions {
  const values =
    new Map<string, string>();
  const flags =
    new Set<string>();
  const valueSet =
    new Set(valueNames);
  const flagSet =
    new Set(flagNames);

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const name =
      args[index]!;

    if (flagSet.has(name)) {
      if (flags.has(name)) {
        throw new Error(
          "Duplicate option: " +
            name
        );
      }

      flags.add(name);
      continue;
    }

    if (!valueSet.has(name)) {
      throw new Error(
        "Unknown option: " +
          name
      );
    }

    if (values.has(name)) {
      throw new Error(
        "Duplicate option: " +
          name
      );
    }

    const value =
      args[index + 1];

    if (
      value === undefined ||
      value.startsWith("--")
    ) {
      throw new Error(
        "Missing value for option: " +
          name
      );
    }

    values.set(
      name,
      value
    );
    index += 1;
  }

  return {
    values,
    flags
  };
}

function requiredOption(
  parsed:
    ParsedOptions,
  name: string
): string {
  const value =
    parsed.values.get(name);

  if (value === undefined) {
    throw new Error(
      "Missing required option: " +
        name
    );
  }

  return value;
}

function optionalOption(
  parsed:
    ParsedOptions,
  name: string
): string | undefined {
  return parsed.values.get(
    name
  );
}

function positiveNumber(
  value: string,
  label: string
): number {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    throw new Error(
      label +
        " must be a positive number."
    );
  }

  return parsed;
}

async function readText(
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

async function canonicalManifest():
  Promise<string> {
  return readText(
    GATE13_APPROVAL_MANIFEST_PATH
  );
}

async function canonicalUniverse():
  Promise<string> {
  return readText(
    GATE13_UNIVERSE_PATH
  );
}

function print(
  value: unknown
): void {
  console.log(
    JSON.stringify(
      value,
      null,
      2
    )
  );
}

async function previewApproval(
  args: string[]
): Promise<void> {
  if (args.length > 0) {
    throw new Error(
      "Approval preview accepts no options."
    );
  }

  const current =
    previewGate13ApprovalManifest(
      await canonicalManifest()
    );

  print({
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
  });
}

async function approve(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--batch-id",
        "--operator",
        "--confirm-manifest-id",
        "--confirm-sha"
      ],
      [
        "--authorize-all-43"
      ]
    );
  const text =
    await canonicalManifest();
  const current =
    previewGate13ApprovalManifest(
      text
    );

  assertGate13ApprovalConfirmation(
    current,
    {
      confirmManifestId:
        requiredOption(
          parsed,
          "--confirm-manifest-id"
        ),
      confirmSha256:
        requiredOption(
          parsed,
          "--confirm-sha"
        ),
      authorizeAll43:
        parsed.flags.has(
          "--authorize-all-43"
        )
    }
  );

  const approvedAt =
    new Date().toISOString();
  const batch =
    buildGate13ApprovalBatchFromManifest({
      manifestText:
        text,
      batchId:
        requiredOption(
          parsed,
          "--batch-id"
        ),
      approvedBy:
        requiredOption(
          parsed,
          "--operator"
        ),
      approvedAt
    });

  await withGate13Database(
    async (
      context
    ) => {
      await context.repository
        .saveTargetBatch(
          batch
        );
    }
  );

  print({
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
  });
}

interface AcceptanceOptions {
  approvalBatchId: string;
  sampleId: string;
  operator: string;
  maxCostUsd: number;
  executionProfile:
    ReturnType<
      typeof parseGate13ExecutionProfile
    >;
  deliveryCostPlan:
    ReturnType<
      typeof parseGate13DeliveryCostPlan
    >;
  costRationale: string;
  humanBaselineDescription:
    string;
  confirmCompleteUniverse:
    boolean;
}

async function acceptanceOptions(
  args: string[],
  requireConfirmation:
    boolean
): Promise<AcceptanceOptions> {
  const parsed =
    parseOptions(
      args,
      [
        "--approval-batch-id",
        "--sample-id",
        "--operator",
        "--max-cost-usd",
        "--execution-profile-file",
        "--cost-plan-file",
        "--cost-rationale-file",
        "--human-baseline-file"
      ],
      [
        "--confirm-complete-universe"
      ]
    );
  const confirmed =
    parsed.flags.has(
      "--confirm-complete-universe"
    );

  if (
    requireConfirmation &&
    !confirmed
  ) {
    throw new Error(
      "Acceptance freeze requires the explicit --confirm-complete-universe flag."
    );
  }

  return {
    approvalBatchId:
      requiredOption(
        parsed,
        "--approval-batch-id"
      ),
    sampleId:
      requiredOption(
        parsed,
        "--sample-id"
      ),
    operator:
      requiredOption(
        parsed,
        "--operator"
      ),
    maxCostUsd:
      positiveNumber(
        requiredOption(
          parsed,
          "--max-cost-usd"
        ),
        "--max-cost-usd"
      ),
    executionProfile:
      parseGate13ExecutionProfile(
        await readText(
          requiredOption(
            parsed,
            "--execution-profile-file"
          )
        )
      ),
    deliveryCostPlan:
      parseGate13DeliveryCostPlan(
        await readText(
          requiredOption(
            parsed,
            "--cost-plan-file"
          )
        )
      ),
    costRationale:
      await readText(
        requiredOption(
          parsed,
          "--cost-rationale-file"
        )
      ),
    humanBaselineDescription:
      await readText(
        requiredOption(
          parsed,
          "--human-baseline-file"
        )
      ),
    confirmCompleteUniverse:
      confirmed
  };
}

async function buildAcceptanceFromStoredBatch(
  options:
    AcceptanceOptions,
  readOnly: boolean
) {
  const operation =
    async (
      context:
        Gate13DatabaseContext
    ) => {
      const batch =
        await context.repository
          .getApprovalBatch(
            options
              .approvalBatchId
          );

      if (batch === undefined) {
        throw new Error(
          "Gate 13 approval batch does not exist: " +
            options
              .approvalBatchId
        );
      }

      return buildGate13AcceptanceSample({
        manifestText:
          await canonicalManifest(),
        universeText:
          await canonicalUniverse(),
        approvalBatch:
          batch,
        sampleId:
          options.sampleId,
        frozenBy:
          options.operator,
        frozenAt:
          new Date()
            .toISOString(),
        maxDeliveryCostUsdPerBrief:
          options.maxCostUsd,
        executionProfile:
          options.executionProfile,
        deliveryCostPlan:
          options.deliveryCostPlan,
        costCeilingRationale:
          options
            .costRationale,
        humanBaselineDescription:
          options
            .humanBaselineDescription
      });
    };

  return readOnly
    ? withGate13DatabaseReadOnly(
        operation
      )
    : withGate13Database(
        operation
      );
}

async function samplePreview(
  args: string[]
): Promise<void> {
  const options =
    await acceptanceOptions(
      args,
      false
    );
  const sample =
    await buildAcceptanceFromStoredBatch(
      options,
      true
    );

  print({
    action:
      "SAMPLE_PREVIEW_ONLY",
    sample,
    note:
      "Preview does not freeze or persist the sample."
  });
}

async function freezeAcceptance(
  args: string[]
): Promise<void> {
  const options =
    await acceptanceOptions(
      args,
      true
    );
  const sample =
    await buildAcceptanceFromStoredBatch(
      options,
      false
    );

  await withGate13Database(
    async (
      context
    ) => {
      await context.repository
        .saveSample(
          sample
        );
    }
  );

  print({
    action:
      "ACCEPTANCE_SAMPLE_FROZEN",
    sample
  });
}

async function recordBaseline(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--sample-id",
        "--target-id",
        "--prepared-by",
        "--minutes",
        "--tooling-file",
        "--notes-file"
      ]
    );
  const notesFile =
    optionalOption(
      parsed,
      "--notes-file"
    );
  const input =
    buildGate13HumanBaselineInput({
      sampleId:
        requiredOption(
          parsed,
          "--sample-id"
        ),
      targetId:
        requiredOption(
          parsed,
          "--target-id"
        ),
      preparedBy:
        requiredOption(
          parsed,
          "--prepared-by"
        ),
      humanPreparationMinutes:
        positiveNumber(
          requiredOption(
            parsed,
            "--minutes"
          ),
          "--minutes"
        ),
      toolingDescription:
        await readText(
          requiredOption(
            parsed,
            "--tooling-file"
          )
        ),
      notes:
        notesFile ===
          undefined
          ? null
          : await readText(
              notesFile
            )
    });
  const baseline =
    await withGate13Database(
      async (
        context
      ) =>
        context.repository
          .saveHumanBaseline(
            input
          )
    );

  print({
    action:
      "HUMAN_BASELINE_RECORDED",
    baseline
  });
}

function terminalStatus(
  status: string
): boolean {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

async function runTarget(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--sample-id",
        "--target-id"
      ]
    );
  const sampleId =
    requiredOption(
      parsed,
      "--sample-id"
    );
  const targetId =
    requiredOption(
      parsed,
      "--target-id"
    );

  await withGate13Workflow(
    async (
      context
    ) => {
      const sample =
        await context.repository
          .getSample(
            sampleId
          );

      if (sample === undefined) {
        throw new Error(
          "Measured research sample does not exist: " +
            sampleId
        );
      }

      assertGate13ExecutionProfile(
        sample,
        context.executionProfile
      );

      const started =
        await context.workflow
          .start({
            sampleId,
            targetId
          });

      try {
        await context.runRepository
          .appendStep(
            started.id,
            "GATE13_EXECUTION_PROFILE",
            context.executionProfile
          );
      } catch (error) {
        await context.workflow
          .cancelRun(
            started.id
          )
          .catch(() => undefined);
        throw error;
      }
      let interruptRequested =
        false;
      const onInterrupt =
        () => {
          if (
            interruptRequested
          ) {
            return;
          }

          interruptRequested =
            true;
          void context.workflow
            .cancelRun(
              started.id
            )
            .catch(
              (
                error:
                  unknown
              ) => {
                const message =
                  error instanceof
                    Error
                    ? error.message
                    : String(
                        error
                      );

                console.error(
                  "Gate 13 cancellation failed: " +
                    message
                );
              }
            );
        };

      process.once(
        "SIGINT",
        onInterrupt
      );

      print({
        action:
          "RESEARCH_RUN_STARTED",
        sampleId,
        targetId,
        runId:
          started.id,
        status:
          started.status
      });

      try {
        let current =
          await context.workflow
            .getRun(
              started.id
            );

        while (
          current !==
            undefined &&
          !terminalStatus(
            current.status
          )
        ) {
          await delay(500);
          current =
            await context.workflow
              .getRun(
                started.id
              );
        }

        if (
          current ===
          undefined
        ) {
          throw new Error(
            "Gate 13 research run disappeared from durable state: " +
              started.id
          );
        }

        const artifacts =
          await context.workflow
            .listArtifacts(
              started.id
            );

        print({
          action:
            "RESEARCH_RUN_TERMINAL",
          run:
            current,
          artifacts,
          next:
            current.status ===
              "COMPLETED"
              ? "Inspect run-usage and artifacts, human-audit every material observed claim, map each evidence ID to the settled screenshot artifact(s), then use review-completed."
              : "Inspect run-usage, then persist the failure with record-failure; generic FAILED runs require an explicit live-research failure code."
        });

        if (
          interruptRequested
        ) {
          process.exitCode =
            130;
        }
      } finally {
        process.removeListener(
          "SIGINT",
          onInterrupt
        );
      }
    }
  );
}

async function artifacts(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--run-id"
      ]
    );
  const runId =
    requiredOption(
      parsed,
      "--run-id"
    );
  const store =
    new LocalArtifactStore(
      gate13ArtifactDir()
    );
  const records =
    await store.listArtifacts(
      runId
    );

  print({
    action:
      "ARTIFACT_REVIEW",
    runId,
    artifacts:
      records,
    note:
      "Capture receipts prove captured bytes/provenance, not semantic truth. Human source/screenshot audit remains required."
  });
}

async function runUsage(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--run-id"
      ]
    );
  const runId =
    requiredOption(
      parsed,
      "--run-id"
    );
  const store =
    new LocalArtifactStore(
      gate13ArtifactDir()
    );
  const records =
    await store.listArtifacts(
      runId
    );
  const summaryRecord =
    records.find(
      (record) =>
        record.name ===
          "run-summary.json" &&
        record.kind ===
          "RUN_SUMMARY"
    );

  if (
    summaryRecord ===
      undefined
  ) {
    throw new Error(
      "Gate 13 run summary artifact does not exist: " +
        runId
    );
  }

  const artifact =
    await store.readArtifact(
      runId,
      summaryRecord.id
    );

  if (
    artifact ===
      undefined
  ) {
    throw new Error(
      "Gate 13 run summary artifact content is unavailable: " +
        runId
    );
  }

  let raw: unknown;

  try {
    raw =
      JSON.parse(
        new TextDecoder()
          .decode(
            artifact.data
          )
      ) as unknown;
  } catch {
    throw new Error(
      "Gate 13 run summary artifact is not valid JSON: " +
        runId
    );
  }

  const summary =
    RunSummaryUsageSchema
      .parse(raw);

  print({
    action:
      "RUN_MODEL_USAGE",
    runId:
      summary.runId,
    modelUsage:
      summary.modelUsage ??
      null,
    timings:
      summary.timings ??
      null,
    note:
      summary.modelUsage ===
        undefined
        ? "This run has no captured model-usage evidence."
        : "Token metrics are measured usage evidence. Dollar cost must be derived separately from the exact model/provider pricing source used for the run."
  });
}

async function runStatus(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--run-id"
      ]
    );
  const runId =
    requiredOption(
      parsed,
      "--run-id"
    );
  const run =
    await withGate13DatabaseReadOnly(
      async (
        context
      ) =>
        context.runRepository
          .getRun(
            runId
          )
    );

  if (run === undefined) {
    throw new Error(
      "Gate 13 run does not exist: " +
        runId
    );
  }

  print({
    action:
      "RUN_STATUS",
    run
  });
}

async function reviewCompleted(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--target-id",
        "--run-id",
        "--mapping-file"
      ],
      [
        "--human-audit-complete"
      ]
    );

  if (
    !parsed.flags.has(
      "--human-audit-complete"
    )
  ) {
    throw new Error(
      "Completed research persistence requires --human-audit-complete after manual source/screenshot review."
    );
  }

  const mapping =
    ArtifactMappingSchema
      .parse(
        JSON.parse(
          await readText(
            requiredOption(
              parsed,
              "--mapping-file"
            )
          )
        ) as unknown
      );
  const attempt =
    await withGate13ReviewContext(
      async (
        context
      ) =>
        context.service
          .recordCompleted({
            targetId:
              requiredOption(
                parsed,
                "--target-id"
              ),
            runId:
              requiredOption(
                parsed,
                "--run-id"
              ),
            artifactIdsByEvidenceId:
              mapping
          })
    );

  print({
    action:
      "COMPLETED_ATTEMPT_PERSISTED",
    attempt
  });
}

async function recordFailure(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--target-id",
        "--run-id",
        "--code"
      ]
    );
  const rawCode =
    optionalOption(
      parsed,
      "--code"
    );
  const code =
    rawCode ===
      undefined
      ? undefined
      : FailureCodeSchema.parse(
          rawCode
        );
  const attempt =
    await withGate13FailureContext(
      async (
        context
      ) =>
        context.service
          .recordFailure({
            targetId:
              requiredOption(
                parsed,
                "--target-id"
              ),
            runId:
              requiredOption(
                parsed,
                "--run-id"
              ),
            ...(code ===
              undefined
              ? {}
              : {
                  code
                })
          })
    );

  print({
    action:
      "FAILED_ATTEMPT_PERSISTED",
    attempt
  });
}

async function recordOutcome(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--sample-id",
        "--target-id",
        "--attempt-id",
        "--review-file"
      ]
    );
  const sampleId =
    requiredOption(
      parsed,
      "--sample-id"
    );
  const targetId =
    requiredOption(
      parsed,
      "--target-id"
    );
  const attemptId =
    requiredOption(
      parsed,
      "--attempt-id"
    );
  const review =
    parseGate13OutcomeReview(
      await readText(
        requiredOption(
          parsed,
          "--review-file"
        )
      )
    );

  const outcome =
    await withGate13ReviewContext(
      async (
        context
      ) => {
        const [
          sample,
          attempt,
          baseline
        ] =
          await Promise.all([
            context.repository
              .getSample(
                sampleId
              ),
            context.repository
              .getAttempt(
                attemptId
              ),
            context.repository
              .getHumanBaselineForTarget(
                sampleId,
                targetId
              )
          ]);

        if (
          sample ===
            undefined
        ) {
          throw new Error(
            "Measured research sample does not exist: " +
              sampleId
          );
        }

        if (
          attempt ===
            undefined
        ) {
          throw new Error(
            "Research attempt does not exist: " +
              attemptId
          );
        }

        if (
          baseline ===
            undefined
        ) {
          throw new Error(
            "Durable human baseline does not exist for sample/target: " +
              sampleId +
              " / " +
              targetId
          );
        }

        if (
          attempt.target.id !==
            targetId
        ) {
          throw new Error(
            "Research attempt target does not match --target-id."
          );
        }

        const runId =
          attempt.status ===
            "COMPLETED"
            ? attempt.report
                .runId
            : attempt.runId;

        if (runId === null) {
          throw new Error(
            "Measured research attempt has no durable run ID for delivery cost accounting."
          );
        }

        const artifacts =
          await context.artifactStore
            .listArtifacts(
              runId
            );
        const summaryRecord =
          artifacts.find(
            (artifact) =>
              artifact.kind ===
                "RUN_SUMMARY" &&
              artifact.name ===
                "run-summary.json"
          );

        if (
          summaryRecord ===
            undefined
        ) {
          throw new Error(
            "Run summary artifact is required for source-attributed delivery cost accounting: " +
              runId
          );
        }

        const summaryArtifact =
          await context.artifactStore
            .readArtifact(
              runId,
              summaryRecord.id
            );

        if (
          summaryArtifact ===
            undefined
        ) {
          throw new Error(
            "Run summary artifact content is unavailable for delivery cost accounting: " +
              runId
          );
        }

        const deliveryCostEvidence =
          buildGate13DeliveryCostEvidenceFromRunSummary(
            sample,
            attempt,
            new TextDecoder()
              .decode(
                summaryArtifact.data
              )
          );
        const built =
          buildGate13SampleOutcome({
            sample,
            attempt,
            baseline,
            review,
            deliveryCostEvidence,
            reviewedAt:
              new Date()
                .toISOString()
          });

        await context.repository
          .saveSampleOutcome(
            built
          );

        return built;
      }
    );

  print({
    action:
      "SAMPLE_OUTCOME_RECORDED",
    outcome
  });
}

async function sampleStatus(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--sample-id"
      ]
    );
  const sampleId =
    requiredOption(
      parsed,
      "--sample-id"
    );
  const status =
    await withGate13DatabaseReadOnly(
      async (
        context
      ) => {
        const sample =
          await context.repository
            .getSample(
              sampleId
            );

        if (
          sample ===
            undefined
        ) {
          throw new Error(
            "Measured research sample does not exist: " +
              sampleId
          );
        }

        const outcomes =
          await context.repository
            .listSampleOutcomes(
              sampleId
            );
        const outcomeByTarget =
          new Map(
            outcomes.map(
              (outcome) =>
                [
                  outcome.targetId,
                  outcome
                ] as const
            )
          );
        const targets =
          await Promise.all(
            sample.targets.map(
              async (
                target
              ) => {
                const [
                  baseline,
                  attempts
                ] =
                  await Promise.all([
                    context.repository
                      .getHumanBaselineForTarget(
                        sampleId,
                        target.id
                      ),
                    context.repository
                      .listAttemptsForTarget(
                        target.id
                      )
                  ]);
                const latest =
                  attempts.at(-1);

                return {
                  targetId:
                    target.id,
                  companyName:
                    target
                      .companyNameHint,
                  baseline:
                    baseline ===
                      undefined
                      ? null
                      : {
                          id:
                            baseline.id,
                          source:
                            baseline.source,
                          recordedAt:
                            baseline
                              .recordedAt,
                          humanPreparationMinutes:
                            baseline
                              .humanPreparationMinutes
                        },
                  attemptCount:
                    attempts.length,
                  latestAttempt:
                    latest ===
                      undefined
                      ? null
                      : {
                          id:
                            latest.id,
                          status:
                            latest.status,
                          startedAt:
                            latest.startedAt
                        },
                  outcome:
                    outcomeByTarget
                      .get(
                        target.id
                      ) ??
                    null
                };
              }
            )
          );

        return {
          sample: {
            id:
              sample.id,
            purpose:
              sample.purpose,
            frozenAt:
              sample.frozenAt,
            targetCount:
              sample.targets.length,
            costCeilingUsd:
              sample.criteria
                .maxDeliveryCostUsdPerBrief
          },
          outcomeCount:
            outcomes.length,
          targets
        };
      }
    );

  print({
    action:
      "SAMPLE_STATUS",
    ...status
  });
}

async function evaluate(
  args: string[]
): Promise<void> {
  const parsed =
    parseOptions(
      args,
      [
        "--sample-id"
      ]
    );
  const sampleId =
    requiredOption(
      parsed,
      "--sample-id"
    );
  const result =
    await withGate13DatabaseReadOnly(
      async (
        context
      ) => {
        const sample =
          await context.repository
            .getSample(
              sampleId
            );

        if (
          sample ===
            undefined
        ) {
          throw new Error(
            "Measured research sample does not exist: " +
              sampleId
          );
        }

        const outcomes =
          await context.repository
            .listSampleOutcomes(
              sampleId
            );

        return {
          sample,
          evaluation:
            evaluateProspectResearchSample(
              sample,
              outcomes
            )
        };
      }
    );

  print({
    action:
      "SAMPLE_EVALUATION",
    ...result
  });
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

  switch (command) {
    case "preview":
      await previewApproval(
        args
      );
      return;
    case "approve":
      await approve(args);
      return;
    case "sample-preview":
      await samplePreview(
        args
      );
      return;
    case "freeze-acceptance":
      await freezeAcceptance(
        args
      );
      return;
    case "record-baseline":
      await recordBaseline(
        args
      );
      return;
    case "run-target":
      await runTarget(
        args
      );
      return;
    case "artifacts":
      await artifacts(
        args
      );
      return;
    case "run-usage":
      await runUsage(
        args
      );
      return;
    case "run-status":
      await runStatus(
        args
      );
      return;
    case "review-completed":
      await reviewCompleted(
        args
      );
      return;
    case "record-failure":
      await recordFailure(
        args
      );
      return;
    case "record-outcome":
      await recordOutcome(
        args
      );
      return;
    case "sample-status":
      await sampleStatus(
        args
      );
      return;
    case "evaluate":
      await evaluate(
        args
      );
      return;
    default:
      throw new Error(
        "Unknown Gate 13 operator command: " +
          command +
          "\n\n" +
          usage()
      );
  }
}

void main().catch(
  (
    error:
      unknown
  ) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "Gate 13 operator command failed: " +
        message
    );
    process.exitCode = 1;
  }
);
