import {
  z
} from "zod";

export const AGENT_COMPARATOR_PROTOCOL_VERSION =
  "gate13-agent-comparator-v1" as const;

export const ComparatorTerminalStatusSchema =
  z.enum([
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "TIMED_OUT",
    "BLOCKED"
  ]);

export const ComparatorEvidenceSchema =
  z.object({
    fieldId:
      z.enum([
        "companyName",
        "companySummary",
        "transformationOpportunities",
        "buyingSignals"
      ]),
    statement:
      z.string().min(1),
    url:
      z.string().url(),
    pageTitle:
      z.string().min(1).nullable(),
    screenshotPath:
      z.string().min(1).nullable()
  }).strict();

export const ComparatorBriefFieldSchema =
  z.object({
    value:
      z.string().min(1).nullable(),
    unknown:
      z.boolean(),
    evidenceIndexes:
      z.array(
        z.number()
          .int()
          .nonnegative()
      )
  }).strict()
    .superRefine(
      (
        field,
        context
      ) => {
        if (
          field.unknown ===
            (field.value !== null)
        ) {
          context.addIssue({
            code:
              "custom",
            message:
              "Exactly one of value or unknown must be set."
          });
        }
      }
    );

export const ComparatorBriefSchema =
  z.object({
    companyName:
      ComparatorBriefFieldSchema,
    companySummary:
      ComparatorBriefFieldSchema,
    transformationOpportunities:
      ComparatorBriefFieldSchema,
    buyingSignals:
      ComparatorBriefFieldSchema
  }).strict();

export const ComparatorWorkerResultSchema =
  z.object({
    brief:
      ComparatorBriefSchema,
    evidence:
      z.array(
        ComparatorEvidenceSchema
      ),
    visitedUrls:
      z.array(
        z.string().url()
      ),
    terminalNote:
      z.string().min(1),
    modelUsage:
      z.object({
        source:
          z.literal(
            "CODEX_JSONL"
          ),
        inputTokens:
          z.number()
            .int()
            .nonnegative(),
        cachedInputTokens:
          z.number()
            .int()
            .nonnegative(),
        cacheWriteInputTokens:
          z.number()
            .int()
            .nonnegative(),
        outputTokens:
          z.number()
            .int()
            .nonnegative(),
        reasoningOutputTokens:
          z.number()
            .int()
            .nonnegative()
      }).strict().nullable()
  }).strict();

export const ComparatorProtocolSchema =
  z.object({
    version:
      z.literal(
        AGENT_COMPARATOR_PROTOCOL_VERSION
      ),
    status:
      z.literal(
        "PREPARED_NOT_AUTHORIZED"
      ),
    purpose:
      z.literal(
        "AGENT_COMPARISON"
      ),
    comparator:
      z.literal(
        "GENERAL_PURPOSE_BROWSER_AGENT"
      ),
    measurement:
      z.literal(
        "MEASURED_AGENT"
      ),
    humanBaseline:
      z.literal(
        "NOT_MEASURED"
      ),
    humanReview:
      z.literal(
        "NOT_PERFORMED"
      ),
    sourceManifest:
      z.object({
        id:
          z.string().min(1),
        sha256:
          z.string().regex(
            /^[a-f0-9]{64}$/
          ),
        targetCount:
          z.literal(43)
      }).strict(),
    requestedFields:
      z.tuple([
        z.literal(
          "companyName"
        ),
        z.literal(
          "companySummary"
        ),
        z.literal(
          "transformationOpportunities"
        ),
        z.literal(
          "buyingSignals"
        )
      ]),
    browser:
      z.object({
        interactionMode:
          z.literal(
            "BROWSER_UI_AND_RENDERED_TEXT"
          ),
        skill:
          z.literal(
            "BrowserSkill"
          ),
        cliVersion:
          z.string().min(1),
        daemonVersion:
          z.string().min(1),
        daemonProtocolVersion:
          z.string().min(1),
        daemonWsPort:
          z.number()
            .int()
            .min(1)
            .max(65535),
        extensionVersion:
          z.string().min(1),
        chromeMajorVersion:
          z.number()
            .int()
            .positive(),
        browserProduct:
          z.literal(
            "CHROME_FOR_TESTING"
          ),
        browserBuildVersion:
          z.string().regex(
            /^\d+\.\d+\.\d+\.\d+$/
          ),
        credentialStore:
          z.literal(
            "MOCK_KEYCHAIN"
          ),
        systemKeychainAccess:
          z.literal(
            "FORBIDDEN"
          ),
        requiredBrowserLabel:
          z.literal(
            "astra-agent-comparator"
          ),
        isolation:
          z.literal(
            "DEDICATED_UNSIGNED_IN_PROFILE"
          ),
        enforcement:
          z.literal(
            "CONNECTION_BOUND_PROXY_AND_GUARDED_BSK"
          ),
        allowedSearchDomains:
          z.array(
            z.string().min(1)
          ).min(1),
        evidencePolicy:
          z.literal(
            "OFFICIAL_APPROVED_DOMAIN_ONLY"
          )
      }).strict(),
    agent:
      z.object({
        harness:
          z.literal(
            "CODEX_CLI"
          ),
        harnessVersion:
          z.string().min(1),
        model:
          z.string().min(1),
        promptSha256:
          z.string().regex(
            /^[a-f0-9]{64}$/
          ),
        freshContextPerTarget:
          z.literal(true),
        serialExecution:
          z.literal(true)
      }).strict(),
    review:
      z.object({
        version:
          z.literal(
            "gate13-agent-comparator-model-review-v1"
          ),
        mode:
          z.literal(
            "BLINDED_MODEL_REVIEW"
          ),
        blindInput:
          z.literal(
            "BRIEF_AND_EVIDENCE_ONLY"
          ),
        harness:
          z.literal(
            "CODEX_CLI"
          ),
        harnessVersion:
          z.string().min(1),
        model:
          z.string().min(1),
        promptSha256:
          z.string().regex(
            /^[a-f0-9]{64}$/
          ),
        humanReviewMinutes:
          z.null()
      }).strict(),
    costAccounting:
      z.object({
        version:
          z.literal(
            "gate13-agent-comparator-reference-cost-v1"
          ),
        accounting:
          z.literal(
            "REFERENCE_API_EQUIVALENT_NOT_ACTUAL_BILL"
          ),
        file:
          z.string().min(1),
        sha256:
          z.string().regex(
            /^[a-f0-9]{64}$/
          )
      }).strict(),
    execution:
      z.object({
        maxElapsedMs:
          z.number()
            .int()
            .positive(),
        retainFirstAttempt:
          z.literal(true),
        retries:
          z.literal(0),
        humanHelp:
          z.literal(false),
        sideEffectPolicy:
          z.literal(
            "READ_ONLY_BROWSER_RESEARCH"
          )
      }).strict()
  }).strict();

export const ComparatorAuthorizationSchema =
  z.object({
    protocolVersion:
      z.literal(
        AGENT_COMPARATOR_PROTOCOL_VERSION
      ),
    protocolSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    manifestSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    targetCount:
      z.literal(43),
    authorizedBy:
      z.string().min(1),
    authorizedAt:
      z.string().datetime({
        offset: true
      })
  }).strict();

export const ComparatorAgentIdentitySchema =
  z.object({
    harness:
      z.string().min(1),
    harnessVersion:
      z.string().min(1),
    model:
      z.string().min(1),
    browserSkillCliVersion:
      z.string().min(1),
    browserSkillExtensionVersion:
      z.string().min(1),
    browserVersion:
      z.string().min(1),
    browserLabel:
      z.string().min(1)
  }).strict();

export const ComparatorReservationSchema =
  z.object({
    protocolVersion:
      z.literal(
        AGENT_COMPARATOR_PROTOCOL_VERSION
      ),
    targetId:
      z.string().min(1),
    attemptId:
      z.string().min(1),
    reservedAt:
      z.string().datetime({
        offset: true
      }),
    protocolSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    promptSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    manifestSha256:
      z.string().regex(
        /^[a-f0-9]{64}$/
      ),
    agentIdentity:
      ComparatorAgentIdentitySchema
  }).strict();

export const ComparatorAttemptSchema =
  z.object({
    protocolVersion:
      z.literal(
        AGENT_COMPARATOR_PROTOCOL_VERSION
      ),
    attemptId:
      z.string().min(1),
    targetId:
      z.string().min(1),
    status:
      ComparatorTerminalStatusSchema,
    startedAt:
      z.string().datetime({
        offset: true
      }),
    finishedAt:
      z.string().datetime({
        offset: true
      }),
    elapsedMs:
      z.number()
        .int()
        .nonnegative(),
    failureReason:
      z.string().min(1).nullable(),
    workerResult:
      ComparatorWorkerResultSchema.nullable(),
    humanBaselineMinutes:
      z.null(),
    humanReviewMinutes:
      z.null(),
    reviewType:
      z.enum([
        "NOT_REVIEWED",
        "MODEL_REVIEWED"
      ]),
    operatorInterventions:
      z.number()
        .int()
        .nonnegative(),
    agentIdentity:
      ComparatorAgentIdentitySchema
  }).strict();

export type ComparatorProtocol =
  z.infer<
    typeof ComparatorProtocolSchema
  >;
export type ComparatorAuthorization =
  z.infer<
    typeof ComparatorAuthorizationSchema
  >;
export type ComparatorAgentIdentity =
  z.infer<
    typeof ComparatorAgentIdentitySchema
  >;
export type ComparatorReservation =
  z.infer<
    typeof ComparatorReservationSchema
  >;
export type ComparatorAttempt =
  z.infer<
    typeof ComparatorAttemptSchema
  >;
export type ComparatorWorkerResult =
  z.infer<
    typeof ComparatorWorkerResultSchema
  >;
