#!/usr/bin/env node
import {
  homedir
} from "node:os";
import {
  join,
  resolve
} from "node:path";

import {
  ComparatorFileStore,
  runComparatorFirstAttempt,
  summarizeComparatorCohort,
  summarizeComparatorReferenceCosts
} from "@astra/agent-comparator";

import {
  startComparatorBrowserEnvironment
} from "./browser-environment.js";
import {
  CodexBrowserSkillWorker
} from "./codex-browser-worker.js";
import {
  CodexComparatorReviewer
} from "./codex-reviewer.js";
import {
  loadFrozenComparatorInputs
} from "./protocol.js";
import {
  inspectComparatorReadiness
} from "./readiness.js";

const DEFAULT_STORE_ROOT =
  join(
    homedir(),
    ".astra",
    "gate13-agent-comparator-v1"
  );

interface ParsedArgs {
  values:
    Map<
      string,
      string
    >;
  flags:
    Set<string>;
}

function parseArgs(
  args: readonly string[]
): ParsedArgs {
  const values =
    new Map<
      string,
      string
    >();
  const flags =
    new Set<string>();

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const key =
      args[index];

    if (
      key === undefined ||
      !key.startsWith(
        "--"
      )
    ) {
      throw new Error(
        "Unexpected comparator argument: " +
          String(key)
      );
    }

    const next =
      args[
        index + 1
      ];

    if (
      next ===
        undefined ||
      next.startsWith(
        "--"
      )
    ) {
      flags.add(
        key
      );
      continue;
    }

    values.set(
      key,
      next
    );
    index += 1;
  }

  return {
    values,
    flags
  };
}

function required(
  parsed:
    ParsedArgs,
  name: string
): string {
  const value =
    parsed.values.get(
      name
    );

  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(
      "Missing required option " +
        name
    );
  }

  return value;
}

function storeRoot(): string {
  const root =
    process.env
      .ASTRA_COMPARATOR_STORE ??
    DEFAULT_STORE_ROOT;
  const resolved =
    resolve(
      root
    );
  const baselineRoot =
    resolve(
      join(
        homedir(),
        "Astra",
        "gate13-baselines"
      )
    );

  if (
    resolved ===
      baselineRoot ||
    resolved.startsWith(
      baselineRoot +
        "/"
    )
  ) {
    throw new Error(
      "Comparator storage must never share the Gate 13 human-baseline directory."
    );
  }

  return resolved;
}

function print(
  value: unknown
): void {
  process.stdout.write(
    JSON.stringify(
      value,
      null,
      2
    ) +
      "\n"
  );
}

async function preflight():
  Promise<void> {
  const inputs =
    await loadFrozenComparatorInputs();
  const readiness =
    await inspectComparatorReadiness(
      inputs.protocol
    );
  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const authorization =
    await store.getAuthorization();

  print({
    action:
      "AGENT_COMPARATOR_PREFLIGHT",
    status:
      readiness.status ===
        "READY"
        ? authorization ===
            undefined
          ? "PREPARED_NOT_AUTHORIZED"
          : "AUTHORIZED"
        : readiness.status,
    protocolVersion:
      inputs.protocol.version,
    protocolSha256:
      inputs.protocolSha256,
    promptSha256:
      inputs.promptSha256,
    reviewPromptSha256:
      inputs.reviewPromptSha256,
    costPlanSha256:
      inputs.costPlanSha256,
    costAccounting:
      inputs.costPlan
        .accounting,
    reviewer: {
      version:
        inputs.protocol
          .review.version,
      model:
        inputs.protocol
          .review.model,
      blindInput:
        inputs.protocol
          .review.blindInput
    },
    manifestId:
      inputs.protocol
        .sourceManifest.id,
    manifestSha256:
      inputs.manifestSha256,
    targetCount:
      inputs.targets.length,
    originalHumanGate:
      "UNCHANGED",
    comparatorStorage:
      store.root,
    readiness,
    authorization:
      authorization ??
      null
  });
}

async function authorize(
  args: string[]
): Promise<void> {
  const parsed =
    parseArgs(
      args
    );
  const inputs =
    await loadFrozenComparatorInputs();
  const readiness =
    await inspectComparatorReadiness(
      inputs.protocol
    );

  if (
    readiness.status !==
      "READY"
  ) {
    throw new Error(
      "Comparator authorization requires a fully qualified dedicated BrowserSkill profile first: " +
        readiness.blockers.join(
          " | "
        )
    );
  }

  if (
    !parsed.flags.has(
      "--authorize-all-43"
    )
  ) {
    throw new Error(
      "Comparator authorization requires --authorize-all-43."
    );
  }

  if (
    required(
      parsed,
      "--confirm-protocol-sha"
    ) !==
      inputs.protocolSha256
  ) {
    throw new Error(
      "Comparator protocol SHA confirmation mismatch."
    );
  }

  if (
    required(
      parsed,
      "--confirm-manifest-sha"
    ) !==
      inputs.manifestSha256
  ) {
    throw new Error(
      "Comparator manifest SHA confirmation mismatch."
    );
  }

  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const persisted =
    await store.authorize({
      protocolVersion:
        inputs.protocol.version,
      protocolSha256:
        inputs.protocolSha256,
      manifestSha256:
        inputs.manifestSha256,
      targetCount:
        43,
      authorizedBy:
        required(
          parsed,
          "--operator"
        )
    });

  print({
    action:
      "AGENT_COMPARATOR_AUTHORIZED",
    authorization:
      persisted,
    note:
      "This authorizes only the separate agent comparator. It does not record a human baseline, reserve an Astra run, or advance the original Gate 13 worklist."
  });
}

async function status():
  Promise<void> {
  const inputs =
    await loadFrozenComparatorInputs();
  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const authorization =
    await store.getAuthorization();
  const items =
    await Promise.all(
      inputs.targets.map(
        async (
          target
        ) => {
          const [
            reservation,
            attempt,
            review
          ] =
            await Promise.all([
              store.getReservation(
                target.id
              ),
              store.getAttempt(
                target.id
              ),
              store.getModelReview(
                target.id
              )
            ]);

          return {
            targetId:
              target.id,
            companyName:
              target
                .companyName,
            reservation:
              reservation ??
              null,
            attempt:
              attempt ??
              null,
            review:
              review ??
              null,
            nextTransition:
              authorization ===
                undefined
                ? "AUTHORIZE_COMPARATOR"
                : attempt ===
                    undefined
                  ? reservation !==
                      undefined
                    ? "RECOVER_INTERRUPTED_FIRST_ATTEMPT"
                    : "RUN_FIRST_COMPARATOR_ATTEMPT"
                  : attempt.status ===
                      "COMPLETED" &&
                    review ===
                      undefined
                    ? "MODEL_REVIEW_COMPLETED_ATTEMPT"
                    : "COMPLETE"
          };
        }
      )
    );

  print({
    action:
      "AGENT_COMPARATOR_STATUS",
    protocolVersion:
      inputs.protocol.version,
    authorization:
      authorization ??
      null,
    summary: {
      targetCount:
        items.length,
      reservedCount:
        items.filter(
          (item) =>
            item.reservation !==
              null
        ).length,
      terminalAttemptCount:
        items.filter(
          (item) =>
            item.attempt !==
              null
        ).length,
      completedAttemptCount:
        items.filter(
          (item) =>
            item.attempt?.status ===
              "COMPLETED"
        ).length,
      modelReviewedCount:
        items.filter(
          (item) =>
            item.review !==
              null
        ).length,
      reviewPendingCount:
        items.filter(
          (item) =>
            item.nextTransition ===
              "MODEL_REVIEW_COMPLETED_ATTEMPT"
        ).length
    },
    items
  });
}

async function recoverInterrupted(
  args: string[]
): Promise<void> {
  const parsed =
    parseArgs(
      args
    );
  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const attempt =
    await store
      .finalizeInterrupted(
        required(
          parsed,
          "--target-id"
        ),
        required(
          parsed,
          "--reason"
        )
      );

  print({
    action:
      "AGENT_COMPARATOR_INTERRUPTED_ATTEMPT_FINALIZED",
    attempt
  });
}

async function runTarget(
  args: string[]
): Promise<void> {
  const parsed =
    parseArgs(
      args
    );
  const targetId =
    required(
      parsed,
      "--target-id"
    );
  const inputs =
    await loadFrozenComparatorInputs();
  const target =
    inputs.targets.find(
      (candidate) =>
        candidate.id ===
          targetId
    );

  if (
    target ===
      undefined
  ) {
    throw new Error(
      "Target is not a member of the frozen comparator manifest: " +
        targetId
    );
  }

  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const authorization =
    await store.getAuthorization();

  if (
    authorization ===
      undefined
  ) {
    throw new Error(
      "Comparator protocol is not separately authorized."
    );
  }

  if (
    authorization.protocolSha256 !==
      inputs.protocolSha256 ||
    authorization.manifestSha256 !==
      inputs.manifestSha256
  ) {
    throw new Error(
      "Comparator authorization no longer matches the frozen inputs."
    );
  }

  if (
    await store.getReservation(
      targetId
    ) !==
      undefined
  ) {
    throw new Error(
      "Comparator target already has a first-attempt reservation. Retrying/replacing it is prohibited."
    );
  }

  const browser =
    await startComparatorBrowserEnvironment(
      target,
      inputs.protocol
    );

  try {
    const readiness =
      await inspectComparatorReadiness(
        inputs.protocol
      );

    if (
      readiness.status !==
        "READY" ||
      readiness.identity ===
        null ||
      readiness.browserInstanceId !==
        browser.browserInstanceId
    ) {
      throw new Error(
        "Dedicated comparator browser failed frozen readiness after proxy-bound launch."
      );
    }

    const worker =
      new CodexBrowserSkillWorker({
        storeRoot:
          store.root,
        frozenPrompt:
          inputs.promptText,
        resultSchemaPath:
          inputs.resultSchemaPath,
        mcpServerPath:
          resolve(
            process.cwd(),
            "apps/gate13-agent-comparator/dist/mcp-browser-server.js"
          ),
        realBskPath:
          join(
            homedir(),
            ".local",
            "bin",
            "bsk"
          )
      });
    const attempt =
      await runComparatorFirstAttempt({
        store,
        worker,
        protocol:
          inputs.protocol,
        protocolSha256:
          inputs.protocolSha256,
        promptSha256:
          inputs.promptSha256,
        manifestSha256:
          inputs.manifestSha256,
        target,
        agentIdentity:
          readiness.identity
      });

    print({
      action:
        "AGENT_COMPARATOR_FIRST_ATTEMPT_TERMINAL",
      attempt,
      note:
        "Human baseline/review measurements remain null. This result belongs only to gate13-agent-comparator-v1."
    });
  } finally {
    await browser.close();
  }
}

async function reviewTarget(
  args: string[]
): Promise<void> {
  const parsed =
    parseArgs(
      args
    );
  const targetId =
    required(
      parsed,
      "--target-id"
    );
  const inputs =
    await loadFrozenComparatorInputs();
  const target =
    inputs.targets.find(
      (candidate) =>
        candidate.id ===
          targetId
    );

  if (
    target ===
      undefined
  ) {
    throw new Error(
      "Target is not a member of the frozen comparator manifest: " +
        targetId
    );
  }

  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const attempt =
    await store.getAttempt(
      targetId
    );

  if (
    attempt ===
      undefined
  ) {
    throw new Error(
      "Comparator model review requires the target's terminal first attempt."
    );
  }

  if (
    attempt.status !==
      "COMPLETED" ||
    attempt.workerResult ===
      null
  ) {
    throw new Error(
      "Only completed comparator attempts receive blinded model review."
    );
  }

  if (
    await store.getModelReview(
      targetId
    ) !==
      undefined
  ) {
    throw new Error(
      "Comparator target already has an immutable model review."
    );
  }

  const reviewer =
    new CodexComparatorReviewer({
      storeRoot:
        store.root,
      promptText:
        inputs.reviewPromptText,
      resultSchemaPath:
        inputs.reviewSchemaPath,
      harnessVersion:
        inputs.protocol
          .review
          .harnessVersion,
      model:
        inputs.protocol
          .review.model
    });
  const result =
    await reviewer.review(
      attempt
    );
  const review =
    await store.saveModelReview({
      attemptId:
        attempt.attemptId,
      targetId:
        attempt.targetId,
      protocolSha256:
        inputs.protocolSha256,
      reviewPromptSha256:
        inputs.reviewPromptSha256,
      reviewerIdentity:
        result.reviewerIdentity,
      review:
        result.draft,
      modelUsage:
        result.modelUsage
    });

  print({
    action:
      "AGENT_COMPARATOR_MODEL_REVIEW_RECORDED",
    target: {
      id:
        target.id,
      companyName:
        target.companyName
    },
    review,
    note:
      "This is MODEL_REVIEWED evidence support, not human review and not independent source-page verification."
  });
}

async function report():
  Promise<void> {
  const inputs =
    await loadFrozenComparatorInputs();
  const store =
    new ComparatorFileStore(
      storeRoot()
    );
  const rows =
    await Promise.all(
      inputs.targets.map(
        async (
          target
        ) => ({
          target,
          attempt:
            await store.getAttempt(
              target.id
            ),
          review:
            await store.getModelReview(
              target.id
            )
        })
      )
    );
  const attempts =
    rows.flatMap(
      (row) =>
        row.attempt ===
          undefined
          ? []
          : [
              row.attempt
            ]
    );
  const reviews =
    rows.flatMap(
      (row) =>
        row.review ===
          undefined
          ? []
          : [
              row.review
            ]
    );

  print({
    action:
      "AGENT_COMPARATOR_REPORT",
    protocolSha256:
      inputs.protocolSha256,
    promptSha256:
      inputs.promptSha256,
    reviewPromptSha256:
      inputs.reviewPromptSha256,
    costPlanSha256:
      inputs.costPlanSha256,
    manifestSha256:
      inputs.manifestSha256,
    summary:
      summarizeComparatorCohort({
        targetIds:
          inputs.targets.map(
            (target) =>
              target.id
          ),
        attempts,
        reviews
      }),
    referenceCost:
      summarizeComparatorReferenceCosts({
        plan:
          inputs.costPlan,
        attempts,
        reviews
      }),
    note:
      "Descriptive comparator report only. It is not a Gate 13 human-baseline verdict and MODEL_REVIEWED is not HUMAN_REVIEWED."
  });
}

function usage(): string {
  return [
    "Gate 13 independent agent comparator",
    "",
    "Commands:",
    "  preflight",
    "  status",
    "  authorize --operator <id> --confirm-protocol-sha <sha> --confirm-manifest-sha <sha> --authorize-all-43",
    "  run-target --target-id <id>",
    "  review-target --target-id <id>",
    "  report",
    "  recover-interrupted --target-id <id> --reason <text>",
    "",
    "This app has separate file storage and no dependency on the Gate 13 acceptance PostgreSQL repository."
  ].join(
    "\n"
  );
}

async function main():
  Promise<void> {
  const rawArgs =
    process.argv.slice(
      2
    );
  const normalizedArgs =
    rawArgs[0] ===
      "--"
      ? rawArgs.slice(
          1
        )
      : rawArgs;
  const [
    command,
    ...args
  ] =
    normalizedArgs;

  switch (command) {
    case "preflight":
      await preflight();
      return;
    case "status":
      await status();
      return;
    case "authorize":
      await authorize(
        args
      );
      return;
    case "run-target":
      await runTarget(
        args
      );
      return;
    case "review-target":
      await reviewTarget(
        args
      );
      return;
    case "report":
      await report();
      return;
    case "recover-interrupted":
      await recoverInterrupted(
        args
      );
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(
        usage() +
          "\n"
      );
      return;
    default:
      throw new Error(
        "Unknown comparator command: " +
          command
      );
  }
}

main().catch(
  (error) => {
    process.stderr.write(
      "Gate 13 comparator command failed: " +
        (
          error instanceof Error
            ? error.message
            : String(error)
        ) +
        "\n"
    );
    process.exitCode = 1;
  }
);
