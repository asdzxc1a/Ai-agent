import {
  mkdtemp
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";

import {
  ComparatorFileStore,
  summarizeComparatorCohort
} from "@astra/agent-comparator";

import {
  CodexComparatorReviewer
} from "./codex-reviewer.js";
import {
  loadFrozenComparatorInputs
} from "./protocol.js";

const inputs =
  await loadFrozenComparatorInputs();
const root =
  await mkdtemp(
    join(
      tmpdir(),
      "astra-comparator-review-fixture-"
    )
  );
const store =
  new ComparatorFileStore(
    root
  );

await store.authorize({
  protocolVersion:
    inputs.protocol.version,
  protocolSha256:
    "a".repeat(64),
  manifestSha256:
    "c".repeat(64),
  targetCount: 43,
  authorizedBy:
    "review-fixture"
});

const identity = {
  harness:
    "codex-cli",
  harnessVersion:
    inputs.protocol
      .agent
      .harnessVersion,
  model:
    inputs.protocol
      .agent.model,
  browserSkillCliVersion:
    inputs.protocol
      .browser
      .cliVersion,
  browserSkillExtensionVersion:
    inputs.protocol
      .browser
      .extensionVersion,
  browserVersion:
    inputs.protocol
      .browser
      .browserBuildVersion,
  browserLabel:
    inputs.protocol
      .browser
      .requiredBrowserLabel
};
const reservation =
  await store.reserve({
    targetId:
      "fixture.review.smoke",
    protocolSha256:
      "a".repeat(64),
    promptSha256:
      "b".repeat(64),
    manifestSha256:
      "c".repeat(64),
    agentIdentity:
      identity
  });
const attempt =
  await store.finalize({
    protocolVersion:
      inputs.protocol.version,
    attemptId:
      reservation.attemptId,
    targetId:
      "fixture.review.smoke",
    status:
      "COMPLETED",
    startedAt:
      reservation.reservedAt,
    finishedAt:
      new Date(
        Date.now() +
          1_000
      ).toISOString(),
    elapsedMs:
      1_000,
    failureReason:
      null,
    workerResult: {
      brief: {
        companyName: {
          value:
            "Fixture Transit",
          unknown:
            false,
          evidenceIndexes: [
            0
          ]
        },
        companySummary: {
          value:
            "Fixture Transit is a regional freight transportation company serving industrial customers.",
          unknown:
            false,
          evidenceIndexes: [
            1
          ]
        },
        transformationOpportunities: {
          value:
            "The company could automate manual dispatch spreadsheet handoffs.",
          unknown:
            false,
          evidenceIndexes: [
            2
          ]
        },
        buyingSignals: {
          value:
            "Leadership has budgeted a predictive-maintenance pilot.",
          unknown:
            false,
          evidenceIndexes: [
            3
          ]
        }
      },
      evidence: [
        {
          fieldId:
            "companyName",
          statement:
            "The page heading identifies the company as Fixture Transit.",
          url:
            "https://fixture.test/about",
          pageTitle:
            "Fixture Transit — About",
          screenshotPath:
            null
        },
        {
          fieldId:
            "companySummary",
          statement:
            "Fixture Transit is a regional freight transportation company serving industrial customers.",
          url:
            "https://fixture.test/about",
          pageTitle:
            "Fixture Transit — About",
          screenshotPath:
            null
        },
        {
          fieldId:
            "transformationOpportunities",
          statement:
            "Dispatch scheduling includes manual spreadsheet handoffs between shifts.",
          url:
            "https://fixture.test/about",
          pageTitle:
            "Fixture Transit — About",
          screenshotPath:
            null
        },
        {
          fieldId:
            "buyingSignals",
          statement:
            "Leadership has budgeted a pilot for predictive maintenance and fleet utilization analytics.",
          url:
            "https://fixture.test/about",
          pageTitle:
            "Fixture Transit — About",
          screenshotPath:
            null
        }
      ],
      visitedUrls: [
        "https://fixture.test/about"
      ],
      terminalNote:
        "Local review fixture.",
      modelUsage: {
        source:
          "CODEX_JSONL",
        inputTokens:
          1_000,
        cachedInputTokens:
          500,
        cacheWriteInputTokens:
          0,
        outputTokens:
          100,
        reasoningOutputTokens:
          10
      }
    },
    humanBaselineMinutes:
      null,
    humanReviewMinutes:
      null,
    reviewType:
      "NOT_REVIEWED",
    operatorInterventions:
      0,
    agentIdentity:
      identity
  });

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
      "a".repeat(64),
    reviewPromptSha256:
      inputs.reviewPromptSha256,
    reviewerIdentity:
      result.reviewerIdentity,
    review:
      result.draft,
    modelUsage:
      result.modelUsage
  });
const summary =
  summarizeComparatorCohort({
    targetIds: [
      attempt.targetId
    ],
    attempts: [
      attempt
    ],
    reviews: [
      review
    ]
  });

if (
  review.reviewType !==
    "MODEL_REVIEWED" ||
  review.humanReviewMinutes !==
    null ||
  summary.verdict !==
    "DESCRIPTIVE_ONLY" ||
  summary.modelReviewedCount !==
    1
) {
  throw new Error(
    "Comparator review fixture invariant failed."
  );
}

process.stdout.write(
  JSON.stringify(
    {
      status:
        "PASS",
      reviewer:
        review.reviewerIdentity,
      usability:
        review.usability,
      correctionSeverity:
        review.correctionSeverity,
      findings:
        review.findings,
      reviewerModelUsage:
        review.modelUsage,
      humanReviewMinutes:
        review.humanReviewMinutes,
      summary
    },
    null,
    2
  ) +
    "\n"
);
