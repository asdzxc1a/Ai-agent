import {
  readFile
} from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  ResearchDomainSchema,
  hostnameWithinApprovedDomain
} from "../src/index.js";

interface UniverseMember {
  ticker: string;
  targetId: string;
}

interface UniverseFile {
  id: string;
  members:
    UniverseMember[];
}

interface ApprovalCandidate {
  ticker: string;
  targetId: string;
  companyName: string;
  canonicalDomain: string;
  startUrl: string;
  approvedDomainsCandidate:
    string[];
  verificationStatus:
    "VERIFIED_OFFICIAL_PUBLIC";
  verificationSourceUrl:
    string;
  approvalStatus:
    "PENDING_OPERATOR_APPROVAL";
}

interface CandidateFile {
  universeId: string;
  status: "NOT_APPROVED";
  targets:
    ApprovalCandidate[];
}

async function readJson<T>(
  relativePath: string
): Promise<T> {
  const url =
    new URL(
      relativePath,
      import.meta.url
    );
  const raw =
    await readFile(
      url,
      "utf8"
    );

  return JSON.parse(raw) as T;
}

describe(
  "Gate 13 transportation approval candidates",
  () => {
    it(
      "covers the frozen universe exactly once without creating approval state",
      async () => {
        const universe =
          await readJson<
            UniverseFile
          >(
            "../../../docs/project/data/gate13-us-transportation-universe-2026-09-17.json"
          );
        const candidates =
          await readJson<
            CandidateFile
          >(
            "../../../docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json"
          );

        expect(
          candidates.universeId
        ).toBe(
          universe.id
        );
        expect(
          candidates.status
        ).toBe(
          "NOT_APPROVED"
        );
        expect(
          candidates.targets
        ).toHaveLength(43);

        const universeIds =
          universe.members
            .map(
              (member) =>
                member.targetId
            )
            .sort();
        const candidateIds =
          candidates.targets
            .map(
              (target) =>
                target.targetId
            )
            .sort();

        expect(candidateIds)
          .toEqual(
            universeIds
          );
        expect(
          new Set(
            candidateIds
          ).size
        ).toBe(43);

        const universeTickers =
          universe.members
            .map(
              (member) =>
                member.ticker
            )
            .sort();
        const candidateTickers =
          candidates.targets
            .map(
              (target) =>
                target.ticker
            )
            .sort();

        expect(
          candidateTickers
        ).toEqual(
          universeTickers
        );

        for (
          const candidate of
          candidates.targets
        ) {
          const domain =
            ResearchDomainSchema
              .parse(
                candidate
                  .canonicalDomain
              );

          expect(
            candidate
              .approvedDomainsCandidate
          ).toEqual([
            domain
          ]);
          expect(
            candidate
              .verificationStatus
          ).toBe(
            "VERIFIED_OFFICIAL_PUBLIC"
          );
          expect(
            candidate
              .approvalStatus
          ).toBe(
            "PENDING_OPERATOR_APPROVAL"
          );
          expect(
            candidate
              .verificationSourceUrl
          ).toBe(
            candidate.startUrl
          );

          const start =
            new URL(
              candidate.startUrl
            );

          expect(
            start.protocol
          ).toBe(
            "https:"
          );
          expect(
            hostnameWithinApprovedDomain(
              start.hostname,
              domain
            )
          ).toBe(true);
        }

        const raw =
          JSON.stringify(
            candidates
          );

        expect(raw)
          .not.toContain(
            "\"approvedBy\""
          );
        expect(raw)
          .not.toContain(
            "\"approvedAt\""
          );
        expect(raw)
          .not.toContain(
            "\"approvalId\""
          );
      }
    );
  }
);
