import {
  createHash
} from "node:crypto";
import {
  readFile
} from "node:fs/promises";
import {
  pathToFileURL
} from "node:url";

const DEFAULT_MANIFEST =
  "docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json";
const DEFAULT_UNIVERSE =
  "docs/project/data/gate13-us-transportation-universe-2026-09-17.json";

function fail(message) {
  throw new Error(
    "Gate 13 approval preflight failed: " +
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

function has(args, name) {
  return args.includes(name);
}

function sha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function isObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch {
    fail(
      label +
        " is not valid JSON"
    );
  }
}

function normalizeDomain(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function hostnameWithinDomain(
  hostname,
  domain
) {
  const normalized =
    normalizeDomain(hostname);

  return (
    normalized === domain ||
    normalized.endsWith(
      "." + domain
    )
  );
}

function requireIdentifier(
  value,
  label
) {
  const text =
    requireText(
      value,
      label
    );

  if (
    text.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(
      text
    )
  ) {
    fail(
      label +
        " must be a valid Astra identifier"
    );
  }

  return text;
}

function requireText(
  value,
  label
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    fail(
      label +
        " must be non-empty text"
    );
  }

  return value.trim();
}

function requireArray(
  value,
  label
) {
  if (!Array.isArray(value)) {
    fail(
      label +
        " must be an array"
    );
  }

  return value;
}

function exactSet(
  actual,
  expected,
  label
) {
  if (
    actual.length !==
      expected.length ||
    new Set(actual).size !==
      actual.length
  ) {
    fail(
      label +
        " count/uniqueness mismatch"
    );
  }

  const left =
    [...actual].sort();
  const right =
    [...expected].sort();

  if (
    left.some(
      (value, index) =>
        value !==
        right[index]
    )
  ) {
    fail(
      label +
        " does not exactly match the frozen universe"
    );
  }
}

export async function loadGate13ApprovalPreflight(
  {
    manifestPath =
      DEFAULT_MANIFEST,
    universePath =
      DEFAULT_UNIVERSE
  } = {}
) {
  const [
    manifestRaw,
    universeRaw
  ] =
    await Promise.all([
      readFile(
        manifestPath,
        "utf8"
      ),
      readFile(
        universePath,
        "utf8"
      )
    ]);
  const manifest =
    parseJson(
      manifestRaw,
      "candidate manifest"
    );
  const universe =
    parseJson(
      universeRaw,
      "selection universe"
    );

  if (
    !isObject(manifest) ||
    !isObject(universe)
  ) {
    fail(
      "manifest and universe must be JSON objects"
    );
  }

  if (
    manifest.purpose !==
      "APPROVAL_CANDIDATE_ENRICHMENT" ||
    manifest.status !==
      "NOT_APPROVED"
  ) {
    fail(
      "candidate manifest must remain NOT_APPROVED enrichment"
    );
  }

  const manifestId =
    requireText(
      manifest.id,
      "manifest.id"
    );
  const universeId =
    requireText(
      universe.id,
      "universe.id"
    );

  if (
    manifest.universeId !==
    universeId
  ) {
    fail(
      "candidate manifest references the wrong frozen universe"
    );
  }

  const targets =
    requireArray(
      manifest.targets,
      "manifest.targets"
    );
  const members =
    requireArray(
      universe.members,
      "universe.members"
    );
  const expectedIds =
    members.map(
      (member) =>
        requireText(
          member?.targetId,
          "universe member targetId"
        )
    );
  const expectedTickers =
    members.map(
      (member) =>
        requireText(
          member?.ticker,
          "universe member ticker"
        )
    );
  const candidateIds = [];
  const candidateTickers = [];

  for (
    const [
      index,
      candidate
    ] of targets.entries()
  ) {
    if (!isObject(candidate)) {
      fail(
        "candidate " +
          String(index) +
          " must be an object"
      );
    }

    const targetId =
      requireText(
        candidate.targetId,
        "candidate.targetId"
      );
    const ticker =
      requireText(
        candidate.ticker,
        "candidate.ticker"
      );
    const companyName =
      requireText(
        candidate.companyName,
        "candidate.companyName"
      );
    const domain =
      normalizeDomain(
        requireText(
          candidate.canonicalDomain,
          "candidate.canonicalDomain"
        )
      );
    const approvedDomains =
      requireArray(
        candidate
          .approvedDomainsCandidate,
        "candidate.approvedDomainsCandidate"
      ).map(
        (value) =>
          normalizeDomain(
            requireText(
              value,
              "approved domain"
            )
          )
      );
    const startUrl =
      requireText(
        candidate.startUrl,
        "candidate.startUrl"
      );
    const sourceUrl =
      requireText(
        candidate
          .verificationSourceUrl,
        "candidate.verificationSourceUrl"
      );

    if (
      candidate.verificationStatus !==
        "VERIFIED_OFFICIAL_PUBLIC" ||
      candidate.approvalStatus !==
        "PENDING_OPERATOR_APPROVAL"
    ) {
      fail(
        targetId +
          " is not a verified pending approval candidate"
      );
    }

    if (
      Object.hasOwn(
        candidate,
        "approvedBy"
      ) ||
      Object.hasOwn(
        candidate,
        "approvedAt"
      ) ||
      Object.hasOwn(
        candidate,
        "approval"
      ) ||
      Object.hasOwn(
        candidate,
        "approvalId"
      )
    ) {
      fail(
        targetId +
          " leaked approval state into enrichment metadata"
      );
    }

    if (
      approvedDomains.length !==
        1 ||
      approvedDomains[0] !==
        domain
    ) {
      fail(
        targetId +
          " approved-domain candidate must equal canonical domain"
      );
    }

    let parsed;

    try {
      parsed =
        new URL(startUrl);
    } catch {
      fail(
        targetId +
          " start URL is invalid"
      );
    }

    if (
      parsed.protocol !==
        "https:" ||
      !hostnameWithinDomain(
        parsed.hostname,
        domain
      )
    ) {
      fail(
        targetId +
          " start URL must be HTTPS within the canonical domain"
      );
    }

    if (sourceUrl !== startUrl) {
      fail(
        targetId +
          " verification source must equal proposed start URL"
      );
    }

    requireText(
      candidate.icpContext,
      "candidate.icpContext"
    );
    requireText(
      candidate
        .verificationSourceKind,
      "candidate.verificationSourceKind"
    );
    void companyName;

    candidateIds.push(
      targetId
    );
    candidateTickers.push(
      ticker
    );
  }

  exactSet(
    candidateIds,
    expectedIds,
    "candidate target IDs"
  );
  exactSet(
    candidateTickers,
    expectedTickers,
    "candidate tickers"
  );

  if (
    targets.length !==
      universe
        .sourceDeclaredEquityCount
  ) {
    fail(
      "candidate count differs from source-declared equity count"
    );
  }

  return {
    manifestRaw,
    manifest,
    universe,
    manifestId,
    universeId,
    manifestSha256:
      sha256(
        manifestRaw
      ),
    targets
  };
}

export function buildGate13ApprovalBatch(
  preflight,
  {
    batchId,
    approvedBy,
    approvedAt
  }
) {
  const id =
    requireIdentifier(
      batchId,
      "batch ID"
    );
  const actor =
    requireText(
      approvedBy,
      "approvedBy"
    );
  const time =
    requireText(
      approvedAt,
      "approvedAt"
    );

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      time
    ) ||
    Number.isNaN(
      Date.parse(time)
    )
  ) {
    fail(
      "approvedAt must be an offset-aware ISO timestamp"
    );
  }

  const targets =
    preflight.targets.map(
      (candidate) => ({
        id:
          candidate.targetId,
        domain:
          normalizeDomain(
            candidate
              .canonicalDomain
          ),
        startUrl:
          candidate.startUrl,
        approvedDomains: [
          ...candidate
            .approvedDomainsCandidate
        ].map(
          normalizeDomain
        ),
        companyNameHint:
          candidate.companyName,
        icpContext:
          candidate.icpContext,
        approval: {
          id:
            requireIdentifier(
              id +
                ":" +
                candidate.targetId,
              "generated approval ID"
            ),
          scope:
            "public_research_only",
          approvedBy:
            actor,
          approvedAt:
            time
        }
      })
    );

  return {
    id,
    sourceManifestId:
      preflight.manifestId,
    sourceManifestSha256:
      preflight.manifestSha256,
    approvedBy:
      actor,
    approvedAt:
      time,
    targets
  };
}

async function main() {
  const args =
    process.argv.slice(2);
  const manifestPath =
    option(
      args,
      "--manifest"
    ) ??
    DEFAULT_MANIFEST;
  const universePath =
    option(
      args,
      "--universe"
    ) ??
    DEFAULT_UNIVERSE;
  const preflight =
    await loadGate13ApprovalPreflight({
      manifestPath,
      universePath
    });

  if (
    has(
      args,
      "--build-batch"
    )
  ) {
    const batch =
      buildGate13ApprovalBatch(
        preflight,
        {
          batchId:
            option(
              args,
              "--batch-id"
            ),
          approvedBy:
            option(
              args,
              "--approved-by"
            ),
          approvedAt:
            option(
              args,
              "--approved-at"
            )
        }
      );

    process.stdout.write(
      JSON.stringify(
        batch,
        null,
        2
      ) + "\n"
    );
    return;
  }

  process.stdout.write(
    JSON.stringify(
      {
        manifestId:
          preflight.manifestId,
        manifestSha256:
          preflight
            .manifestSha256,
        universeId:
          preflight.universeId,
        targetCount:
          preflight.targets.length,
        manifestStatus:
          preflight
            .manifest.status,
        approvalStatus:
          "PENDING_OPERATOR_APPROVAL"
      },
      null,
      2
    ) + "\n"
  );
}

if (
  process.argv[1] !==
    undefined &&
  pathToFileURL(
    process.argv[1]
  ).href ===
    import.meta.url
) {
  await main();
}
