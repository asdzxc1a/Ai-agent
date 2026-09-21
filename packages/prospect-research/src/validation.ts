import type {
  Evidence
} from "@astra/sales-domain";
import type {
  SandboxNetworkPolicyOptions
} from "@astra/sandbox-runtime";

import {
  CompletedProspectResearchAttemptSchema,
  ProspectResearchAttemptSchema,
  ProspectResearchResultSchema,
  type ApprovedResearchTarget,
  type CompletedProspectResearchAttempt,
  type ProspectResearchAttempt,
  type ProspectResearchCaptureReceipt,
  type ProspectResearchClaim,
  type ProspectResearchModelUsage,
  type ProspectResearchReport,
  type ProspectResearchResult
} from "./schema.js";

function normalizedHostname(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

export function hostnameWithinApprovedDomain(
  hostname: string,
  approvedDomain: string
): boolean {
  const normalizedHost =
    normalizedHostname(hostname);
  const normalizedDomain =
    normalizedHostname(
      approvedDomain
    );

  return (
    normalizedHost ===
      normalizedDomain ||
    normalizedHost.endsWith(
      "." + normalizedDomain
    )
  );
}

export function sameApprovedResearchTarget(
  left: ApprovedResearchTarget,
  right: ApprovedResearchTarget
): boolean {
  const leftDomains = [
    ...left.approvedDomains
  ].sort();
  const rightDomains = [
    ...right.approvedDomains
  ].sort();

  return (
    left.id === right.id &&
    left.domain === right.domain &&
    left.startUrl === right.startUrl &&
    left.companyNameHint ===
      right.companyNameHint &&
    left.icpContext ===
      right.icpContext &&
    left.approval.id ===
      right.approval.id &&
    left.approval.scope ===
      right.approval.scope &&
    left.approval.approvedBy ===
      right.approval.approvedBy &&
    left.approval.approvedAt ===
      right.approval.approvedAt &&
    leftDomains.length ===
      rightDomains.length &&
    leftDomains.every(
      (domain, index) =>
        domain ===
        rightDomains[index]
    )
  );
}

export function isApprovedResearchUrl(
  target:
    ApprovedResearchTarget,
  value: string
): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const port =
    url.port.length === 0
      ? (
          url.protocol ===
            "https:"
            ? 443
            : 80
        )
      : Number(url.port);

  if (
    (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    (port !== 80 && port !== 443)
  ) {
    return false;
  }

  return target.approvedDomains.some(
    (domain) =>
      hostnameWithinApprovedDomain(
        url.hostname,
        domain
      )
  );
}

export function researchNetworkPolicyOptions(
  target:
    ApprovedResearchTarget
): SandboxNetworkPolicyOptions {
  return {
    allowedDomains: [
      ...target.approvedDomains
    ]
  };
}

function exactUniqueSet(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size ===
      left.length &&
    new Set(right).size ===
      right.length &&
    left.every(
      (item) =>
        right.includes(item)
    )
  );
}

function allClaims(
  report:
    ProspectResearchReport
): ProspectResearchClaim[] {
  return [
    ...report.companySummary,
    ...report
      .transformationOpportunities,
    ...report.buyingSignals
  ];
}

export function validateProspectResearch(
  target:
    ApprovedResearchTarget,
  report:
    ProspectResearchReport
): string[] {
  const errors: string[] = [];

  if (
    report.targetId !==
    target.id
  ) {
    errors.push(
      "report targetId does not match approved target"
    );
  }

  if (
    report.id !==
    report.runId
  ) {
    errors.push(
      "report id must be server-derived from runId"
    );
  }

  if (
    report.prospect.id !==
    target.id
  ) {
    errors.push(
      "prospect id must be server-derived from targetId"
    );
  }

  if (
    report.prospect.domain !==
    target.domain
  ) {
    errors.push(
      "prospect domain does not match approved target domain"
    );
  }

  if (
    report.prospect.fit !==
    "unknown"
  ) {
    errors.push(
      "Gate 13 prospect fit must remain unknown"
    );
  }

  if (
    report.prospect
      .disqualifiers.length !== 0
  ) {
    errors.push(
      "Gate 13 prospect disqualifiers must remain empty"
    );
  }

  if (
    !isApprovedResearchUrl(
      target,
      target.startUrl
    )
  ) {
    errors.push(
      "target startUrl is outside approved domains"
    );
  }

  const evidenceById =
    new Map(
      report.evidence.map(
        (evidence) =>
          [evidence.id, evidence] as const
      )
    );

  if (
    evidenceById.size !==
    report.evidence.length
  ) {
    errors.push(
      "duplicate research evidence id"
    );
  }

  for (
    const evidence of
    report.evidence
  ) {
    if (
      !isApprovedResearchUrl(
        target,
        evidence.sourceUrl
      )
    ) {
      errors.push(
        "research evidence source is outside approved domains: " +
          evidence.id
      );
    }

    const receiptArtifactIds =
      evidence.captureReceipts
        .map(
          (receipt) =>
            receipt.artifactId
        );

    if (
      new Set(
        receiptArtifactIds
      ).size !==
        receiptArtifactIds
          .length
    ) {
      errors.push(
        "research evidence capture receipt artifact IDs must be unique: " +
          evidence.id
      );
    }

    if (
      !receiptArtifactIds.every(
        (artifactId) =>
          evidence.artifactIds
            .includes(
              artifactId
            )
      )
    ) {
      errors.push(
        "research evidence capture receipts must reference mapped artifacts: " +
          evidence.id
      );
    }

    let sourceHref:
      string | undefined;

    try {
      sourceHref =
        new URL(
          evidence.sourceUrl
        ).href;
    } catch {
      sourceHref = undefined;
    }

    for (
      const receipt of
      evidence.captureReceipts
    ) {
      if (
        !isApprovedResearchUrl(
          target,
          receipt.pageUrl
        )
      ) {
        errors.push(
          "research evidence capture receipt is outside approved domains: " +
            evidence.id
        );
      }

      let receiptHref:
        string | undefined;

      try {
        receiptHref =
          new URL(
            receipt.pageUrl
          ).href;
      } catch {
        receiptHref =
          undefined;
      }

      if (
        sourceHref ===
          undefined ||
        receiptHref !==
          sourceHref
      ) {
        errors.push(
          "research evidence capture receipt page URL must match source URL: " +
            evidence.id
        );
      }
    }

    if (
      !evidence.captureReceipts
        .some(
          (receipt) =>
            receipt.capturedAt ===
            evidence.capturedAt
        )
    ) {
      errors.push(
        "research evidence capturedAt must match a server-owned capture receipt: " +
          evidence.id
      );
    }
  }

  if (
    report.prospect
      .companyName !== null &&
    !report.evidence.some(
      (evidence) =>
        evidence.observation ===
        report.prospect
          .companyName
    )
  ) {
    errors.push(
      "prospect companyName must exactly match observed evidence"
    );
  }

  const claims = allClaims(report);
  const claimById =
    new Map(
      claims.map(
        (claim) =>
          [claim.id, claim] as const
      )
    );

  if (
    claimById.size !==
    claims.length
  ) {
    errors.push(
      "duplicate research claim id"
    );
  }

  for (const claim of claims) {
    const resolved =
      claim.evidenceIds
        .map(
          (id) =>
            evidenceById.get(id)
        );

    for (
      let index = 0;
      index <
        claim.evidenceIds.length;
      index += 1
    ) {
      if (
        resolved[index] ===
        undefined
      ) {
        errors.push(
          "claim references unknown evidence: " +
            claim.evidenceIds[
              index
            ]
        );
      }
    }

    if (
      claim.kind ===
        "observed_fact" &&
      !resolved.some(
        (item) =>
          item?.observation ===
          claim.statement
      )
    ) {
      errors.push(
        "observed fact must exactly match referenced observed evidence: " +
          claim.id
      );
    }
  }

  for (
    const evidenceId of
    report.prospect.evidenceIds
  ) {
    if (
      !evidenceById.has(
        evidenceId
      )
    ) {
      errors.push(
        "prospect references unknown observed evidence: " +
          evidenceId
      );
    }
  }

  if (
    !exactUniqueSet(
      report.prospect
        .evidenceIds,
      report.evidence.map(
        (evidence) =>
          evidence.id
      )
    )
  ) {
    errors.push(
      "prospect evidenceIds must exactly match durable observed evidence"
    );
  }

  const hypothesisIds =
    new Set(
      claims
        .filter(
          (claim) =>
            claim.kind ===
            "inferred_hypothesis"
        )
        .map(
          (claim) => claim.id
        )
    );

  for (
    const hypothesisId of
    report.prospect.hypothesisIds
  ) {
    if (
      !hypothesisIds.has(
        hypothesisId
      )
    ) {
      errors.push(
        "prospect references unknown hypothesis: " +
          hypothesisId
      );
    }
  }

  if (
    !exactUniqueSet(
      report.prospect
        .hypothesisIds,
      [...hypothesisIds]
    )
  ) {
    errors.push(
      "prospect hypothesisIds must exactly match durable inferred hypotheses"
    );
  }

  const unknownIds =
    new Set(
      report.unknowns.map(
        (unknown) =>
          unknown.id
      )
    );
  if (
    unknownIds.size !==
    report.unknowns.length
  ) {
    errors.push(
      "duplicate research unknown id"
    );
  }

  const unknownFields =
    new Set(
      report.unknowns.map(
        (unknown) =>
          unknown.field
      )
    );
  if (
    unknownFields.size !==
    report.unknowns.length
  ) {
    errors.push(
      "duplicate research unknown field"
    );
  }

  const graphIds = [
    ...report.evidence.map(
      (evidence) =>
        evidence.id
    ),
    ...claims.map(
      (claim) => claim.id
    ),
    ...report.unknowns.map(
      (unknown) =>
        unknown.id
    )
  ];

  if (
    new Set(graphIds).size !==
    graphIds.length
  ) {
    errors.push(
      "research evidence, claim, and unknown ids must be globally unique"
    );
  }

  return errors;
}

export function validateProspectResearchAttemptForPersistence(
  input: unknown
): ProspectResearchAttempt {
  const attempt =
    ProspectResearchAttemptSchema
      .parse(input);

  if (
    attempt.runDurationMs !==
      undefined
  ) {
    const expectedDuration =
      Date.parse(
        attempt.createdAt
      ) -
      Date.parse(
        attempt.startedAt
      );

    if (
      !Number.isFinite(
        expectedDuration
      ) ||
      expectedDuration < 0 ||
      attempt.runDurationMs !==
        expectedDuration
    ) {
      throw new Error(
        "Research attempt runDurationMs must equal the server-owned run timestamp delta."
      );
    }
  }

  if (
    attempt.status ===
    "COMPLETED"
  ) {
    const errors =
      validateProspectResearch(
        attempt.target,
        attempt.report
      );

    if (
      attempt.id !==
      attempt.report.runId
    ) {
      errors.push(
        "completed attempt id must equal durable runId"
      );
    }

    if (
      attempt.createdAt !==
      attempt.report.researchedAt
    ) {
      errors.push(
        "completed attempt time must equal durable researchedAt"
      );
    }

    if (errors.length > 0) {
      throw new Error(
        "Durable prospect research attempt failed validation: " +
          errors.join("; ")
      );
    }
  } else if (
    attempt.runId !== null &&
    attempt.id !==
      attempt.runId
  ) {
    throw new Error(
      "Failed research attempt id must equal durable runId."
    );
  }

  return attempt;
}

function inferredHypothesisIds(
  result: ProspectResearchResult
): string[] {
  return [
    ...result.companySummary,
    ...result
      .transformationOpportunities,
    ...result.buyingSignals
  ]
    .filter(
      (claim) =>
        claim.kind ===
        "inferred_hypothesis"
    )
    .map(
      (claim) => claim.id
    );
}

export function validateProspectResearchResult(
  target: ApprovedResearchTarget,
  input: unknown
): ProspectResearchResult {
  const result =
    ProspectResearchResultSchema
      .parse(input);
  const researchedAt =
    "2000-01-01T00:00:00.000Z";
  const report:
    ProspectResearchReport = {
      id: "validation.run",
      runId:
        "validation.run",
      targetId: target.id,
      researchedAt,
      prospect: {
        id: target.id,
        domain: target.domain,
        companyName:
          result.companyName
            ?.value ?? null,
        fit: "unknown",
        disqualifiers: [],
        evidenceIds:
          result.evidence.map(
            (evidence) =>
              evidence.id
          ),
        hypothesisIds:
          inferredHypothesisIds(
            result
          )
      },
      companySummary:
        result.companySummary,
      transformationOpportunities:
        result
          .transformationOpportunities,
      buyingSignals:
        result.buyingSignals,
      unknowns:
        result.unknowns,
      evidence:
        result.evidence.map(
          (evidence) => ({
            ...evidence,
            capturedAt:
              researchedAt,
            artifactIds: [
              "validation." +
                evidence.id
            ],
            captureReceipts: [
              {
                artifactId:
                  "validation." +
                  evidence.id,
                captureVersion:
                  "page-evidence-v1",
                semanticSettled:
                  true,
                pageUrl:
                  evidence.sourceUrl,
                capturedAt:
                  researchedAt,
                pageContentSha256:
                  "0".repeat(64),
                screenshotSha256:
                  "1".repeat(64)
              }
            ]
          })
        )
    };
  const errors =
    validateProspectResearch(
      target,
      report
    );

  if (
    result.companyName !== null
  ) {
    const evidenceById =
      new Map(
        result.evidence.map(
          (evidence) =>
            [
              evidence.id,
              evidence
            ] as const
        )
      );

    for (
      const evidenceId of
      result.companyName
        .evidenceIds
    ) {
      if (
        !evidenceById.has(
          evidenceId
        )
      ) {
        errors.push(
          "company name references unknown observed evidence: " +
            evidenceId
        );
      }
    }

    if (
      !result.companyName
        .evidenceIds.some(
          (evidenceId) =>
            evidenceById.get(
              evidenceId
            )?.observation ===
            result.companyName
              ?.value
        )
    ) {
      errors.push(
        "company name must exactly match referenced observed evidence"
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      "Prospect research result failed semantic validation: " +
        errors.join("; ")
    );
  }

  return result;
}

export interface BuildCompletedProspectResearchAttemptInput {
  target: ApprovedResearchTarget;
  runId: string;
  startedAt: string;
  researchedAt: string;
  runDurationMs: number;
  unauthorizedActions: number;
  modelUsage?:
    ProspectResearchModelUsage;
  capturedAtByEvidenceId:
    ReadonlyMap<string, string>;
  artifactIdsByEvidenceId:
    ReadonlyMap<
      string,
      readonly string[]
    >;
  captureReceiptsByEvidenceId:
    ReadonlyMap<
      string,
      readonly ProspectResearchCaptureReceipt[]
    >;
  result: unknown;
}

export function buildCompletedProspectResearchAttempt({
  target,
  runId,
  startedAt,
  researchedAt,
  runDurationMs,
  unauthorizedActions,
  modelUsage,
  capturedAtByEvidenceId,
  artifactIdsByEvidenceId,
  captureReceiptsByEvidenceId,
  result: input
}: BuildCompletedProspectResearchAttemptInput):
  CompletedProspectResearchAttempt {
  const result =
    validateProspectResearchResult(
      target,
      input
    );
  for (
    const evidence of
    result.evidence
  ) {
    if (
      !capturedAtByEvidenceId.has(
        evidence.id
      )
    ) {
      throw new Error(
        "Missing server-owned capture time for research evidence: " +
          evidence.id
      );
    }

    if (
      !artifactIdsByEvidenceId.has(
        evidence.id
      )
    ) {
      throw new Error(
        "Missing server-owned artifact IDs for research evidence: " +
          evidence.id
      );
    }

    if (
      !captureReceiptsByEvidenceId
        .has(
          evidence.id
        )
    ) {
      throw new Error(
        "Missing server-owned capture receipts for research evidence: " +
          evidence.id
      );
    }
  }

  const attempt =
    CompletedProspectResearchAttemptSchema
      .parse({
        id: runId,
        target,
        startedAt,
        createdAt:
          researchedAt,
        runDurationMs,
        unauthorizedActions,
        ...(modelUsage ===
          undefined
          ? {}
          : {
              modelUsage
            }),
        status: "COMPLETED",
        report: {
          id: runId,
          runId,
          targetId:
            target.id,
          researchedAt,
          prospect: {
            id: target.id,
            domain:
              target.domain,
            companyName:
              result.companyName
                ?.value ?? null,
            fit: "unknown",
            disqualifiers: [],
            evidenceIds:
              result.evidence
                .map(
                  (evidence) =>
                    evidence.id
                ),
            hypothesisIds:
              inferredHypothesisIds(
                result
              )
          },
          companySummary:
            result
              .companySummary,
          transformationOpportunities:
            result
              .transformationOpportunities,
          buyingSignals:
            result.buyingSignals,
          unknowns:
            result.unknowns,
          evidence:
            result.evidence.map(
              (evidence) => ({
                ...evidence,
                capturedAt:
                  capturedAtByEvidenceId
                    .get(
                      evidence.id
                    )!,
                artifactIds: [
                  ...artifactIdsByEvidenceId
                    .get(
                      evidence.id
                    )!
                ],
                captureReceipts: [
                  ...captureReceiptsByEvidenceId
                    .get(
                      evidence.id
                    )!
                ]
              })
            )
        }
      });
  const errors =
    validateProspectResearch(
      target,
      attempt.report
    );

  if (errors.length > 0) {
    throw new Error(
      "Prospect research attempt failed canonical validation: " +
        errors.join("; ")
    );
  }

  return attempt;
}

export function toSalesEvidence(
  report:
    ProspectResearchReport
): Evidence[] {
  const observed: Evidence[] =
    report.evidence.map(
      (item) => ({
        id: item.id,
        kind:
          "observed_fact",
        statement:
          item.observation,
        sourceUrl:
          item.sourceUrl,
        capturedAt:
          item.capturedAt,
        uncertainty:
          item.uncertainty,
        uncertaintyNote:
          item.uncertaintyNote,
        artifactIds: [
          ...item.artifactIds
        ],
        captureReceipts:
          item.captureReceipts
            .map(
              (receipt) => ({
                ...receipt
              })
            )
      })
    );

  const hypotheses =
    new Map<string, Evidence>();

  for (
    const claim of
    allClaims(report)
  ) {
    if (
      claim.kind !==
      "inferred_hypothesis"
    ) {
      continue;
    }

    hypotheses.set(
      claim.id,
      {
        id: claim.id,
        kind:
          "inferred_hypothesis",
        statement:
          claim.statement,
        supportingEvidenceIds: [
          ...claim.evidenceIds
        ],
        confidence:
          claim.confidence,
        uncertainty:
          claim.uncertainty
      }
    );
  }

  const unknown: Evidence[] =
    report.unknowns.map(
      (item) => ({
        id: item.id,
        kind: "unknown",
        statement:
          item.reason,
        question:
          item.field
      })
    );

  return [
    ...observed,
    ...hypotheses.values(),
    ...unknown
  ];
}
