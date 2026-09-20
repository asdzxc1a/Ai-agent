import {
  describe,
  expect,
  it
} from "vitest";

import {
  InMemoryArtifactStore
} from "@astra/artifact-store";

import {
  InMemoryProspectResearchRepository,
  ProspectResearchService,
  ProspectResearchValidationError
} from "../src/index.js";

function service(
  repository:
    InMemoryProspectResearchRepository
) {
  return new ProspectResearchService(
    repository,
    new InMemoryArtifactStore(),
    {
      async getRun() {
        return undefined;
      }
    }
  );
}

function proposalInput() {
  return {
    id:
      "proposal.transport.example.1",
    targetId:
      "g13.us.transport.example",
    companyNameHint:
      "Example Transportation",
    proposedDomain:
      "example.com",
    proposedStartUrl:
      "https://www.example.com/about",
    proposedDomains: [
      "example.com"
    ],
    icpContext:
      "U.S. transportation operations acceptance candidate.",
    evidence: [
      {
        kind:
          "OFFICIAL_COMPANY" as const,
        sourceUrl:
          "https://www.example.com/about",
        supports: [
          "COMPANY_IDENTITY" as const,
          "CANONICAL_DOMAIN" as const,
          "START_PAGE" as const
        ],
        note:
          "Official company about page identifies the company and is the proposed read-only research page."
      }
    ],
    proposedBy:
      "target-enrichment-research"
  };
}

describe(
  "target enrichment proposals",
  () => {
    it(
      "persists discovery as proposal state without authorizing research",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository(
            () =>
              "2026-09-20T20:50:00.000Z"
          );
        const research =
          service(repository);

        const proposal =
          await research
            .proposeTargetEnrichment(
              proposalInput()
            );

        expect(
          proposal.proposedAt
        ).toBe(
          "2026-09-20T20:50:00.000Z"
        );
        await expect(
          repository.listTargets()
        ).resolves.toEqual([]);

        await expect(
          research.getApprovedTarget(
            proposal.targetId
          )
        ).rejects.toBeInstanceOf(
          ProspectResearchValidationError
        );

        await expect(
          research.listTargetEnrichmentProposals(
            proposal.targetId
          )
        ).resolves.toEqual([
          proposal
        ]);
      }
    );

    it(
      "creates an approved target only through explicit approval of the exact proposal",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository(
            () =>
              "2026-09-20T20:50:00.000Z"
          );
        const research =
          service(repository);
        const proposal =
          await research
            .proposeTargetEnrichment(
              proposalInput()
            );

        const target =
          await research
            .approveTargetEnrichmentProposal({
              proposalId:
                proposal.id,
              approval: {
                id:
                  "approval.transport.example",
                scope:
                  "public_research_only",
                approvedBy:
                  "operator",
                approvedAt:
                  "2026-09-20T20:55:00.000Z"
              }
            });

        expect(target)
          .toEqual({
            id:
              proposal.targetId,
            domain:
              proposal.proposedDomain,
            startUrl:
              proposal.proposedStartUrl,
            approvedDomains:
              proposal.proposedDomains,
            companyNameHint:
              proposal.companyNameHint,
            icpContext:
              proposal.icpContext,
            approval: {
              id:
                "approval.transport.example",
              scope:
                "public_research_only",
              approvedBy:
                "operator",
              approvedAt:
                "2026-09-20T20:55:00.000Z",
              enrichmentProposalId:
                proposal.id
            }
          });

        await expect(
          repository.getTarget(
            proposal.targetId
          )
        ).resolves.toEqual(
          target
        );
      }
    );

    it(
      "rejects unsupported or domain-widening enrichment proposals",
      async () => {
        const repository =
          new InMemoryProspectResearchRepository();
        const research =
          service(repository);

        await expect(
          research.proposeTargetEnrichment({
            ...proposalInput(),
            id:
              "proposal.missing-start-page",
            evidence: [
              {
                kind:
                  "OFFICIAL_COMPANY",
                sourceUrl:
                  "https://www.example.com/about",
                supports: [
                  "COMPANY_IDENTITY",
                  "CANONICAL_DOMAIN"
                ],
                note:
                  "Does not support the proposed start page."
              }
            ]
          })
        ).rejects.toThrow(
          "enrichment proposal evidence must support START_PAGE"
        );

        await expect(
          research.proposeTargetEnrichment({
            ...proposalInput(),
            id:
              "proposal.outside-domain",
            proposedStartUrl:
              "https://unrelated.test/about"
          })
        ).rejects.toThrow(
          "proposedStartUrl must be an HTTP(S) URL within proposedDomains"
        );

        await expect(
          research.proposeTargetEnrichment({
            ...proposalInput(),
            id:
              "proposal.fake-official",
            evidence: [
              {
                kind:
                  "OFFICIAL_COMPANY",
                sourceUrl:
                  "https://unrelated.test/about",
                supports: [
                  "COMPANY_IDENTITY",
                  "CANONICAL_DOMAIN",
                  "START_PAGE"
                ],
                note:
                  "Claims to be official but is outside the proposed company domain."
              }
            ]
          })
        ).rejects.toThrow(
          "official company/IR evidence must be within proposedDomains"
        );
      }
    );
  }
);
