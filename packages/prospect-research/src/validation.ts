import type {
  Evidence
} from "@astra/sales-domain";
import type {
  SandboxNetworkPolicyOptions
} from "@astra/sandbox-runtime";

import type {
  ApprovedResearchTarget,
  ProspectResearchClaim,
  ProspectResearchReport
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
    report.prospect.domain !==
    target.domain
  ) {
    errors.push(
      "prospect domain does not match approved target domain"
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

  return errors;
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
          item.capturedAt
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
          claim.confidence
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
