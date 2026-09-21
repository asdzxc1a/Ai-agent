import {
  createHash
} from "node:crypto";

import { z } from "zod";

import {
  ResearchApprovalBatchSchema,
  type ResearchApprovalBatch
} from "@astra/prospect-research";

export const GATE13_APPROVAL_MANIFEST_PATH =
  "docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json";
export const GATE13_APPROVAL_MANIFEST_ID =
  "g13-us-transportation-approval-candidates-2026-09-20";
export const GATE13_APPROVAL_UNIVERSE_ID =
  "g13-us-transportation-iyt-2026-09-17";
export const GATE13_APPROVAL_TARGET_COUNT =
  43;

const CandidateTargetSchema =
  z.object({
    ticker:
      z.string().trim().min(1).max(32),
    targetId:
      z.string().trim().min(1).max(128),
    companyName:
      z.string().trim().min(1).max(240),
    canonicalDomain:
      z.string().trim().min(1),
    startUrl:
      z.string().url(),
    approvedDomainsCandidate:
      z.array(
        z.string().trim().min(1)
      ).min(1).max(16),
    icpContext:
      z.string().trim().min(1).max(4000),
    verificationStatus:
      z.literal(
        "VERIFIED_OFFICIAL_PUBLIC"
      ),
    verificationSourceUrl:
      z.string().url(),
    verificationSourceKind:
      z.string().trim().min(1),
    approvalStatus:
      z.literal(
        "PENDING_OPERATOR_APPROVAL"
      )
  }).strict();

export const Gate13ApprovalCandidateManifestSchema =
  z.object({
    id:
      z.literal(
        GATE13_APPROVAL_MANIFEST_ID
      ),
    universeId:
      z.literal(
        GATE13_APPROVAL_UNIVERSE_ID
      ),
    purpose:
      z.literal(
        "APPROVAL_CANDIDATE_ENRICHMENT"
      ),
    status:
      z.literal("NOT_APPROVED"),
    generatedFrom:
      z.string().trim().min(1),
    verificationDate:
      z.iso.date(),
    approvalRule:
      z.string().trim().min(1),
    targets:
      z.array(
        CandidateTargetSchema
      ).length(
        GATE13_APPROVAL_TARGET_COUNT
      )
  }).strict()
    .superRefine(
      (manifest, context) => {
        const targetIds =
          manifest.targets.map(
            (target) =>
              target.targetId
          );

        if (
          new Set(
            targetIds
          ).size !==
            targetIds.length
        ) {
          context.addIssue({
            code: "custom",
            path: ["targets"],
            message:
              "Gate 13 approval candidate target IDs must be unique"
          });
        }
      }
    );

export type Gate13ApprovalCandidateManifest =
  z.infer<
    typeof Gate13ApprovalCandidateManifestSchema
  >;

export interface Gate13ApprovalManifestPreview {
  manifest:
    Gate13ApprovalCandidateManifest;
  sha256: string;
}

export interface BuildGate13ApprovalBatchInput {
  manifestText: string;
  batchId: string;
  approvedBy: string;
  approvedAt: string;
}

export interface Gate13ApprovalConfirmation {
  confirmManifestId: string;
  confirmSha256: string;
  authorizeAll43: boolean;
}

function parseManifestText(
  manifestText: string
): Gate13ApprovalCandidateManifest {
  let raw: unknown;

  try {
    raw =
      JSON.parse(
        manifestText
      ) as unknown;
  } catch {
    throw new Error(
      "Gate 13 approval manifest must be valid JSON."
    );
  }

  return Gate13ApprovalCandidateManifestSchema
    .parse(raw);
}

function sha256(
  text: string
): string {
  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex");
}

function approvalId(
  batchId: string,
  targetId: string
): string {
  const digest =
    createHash("sha256")
      .update(
        batchId +
          "\u0000" +
          targetId,
        "utf8"
      )
      .digest("hex")
      .slice(0, 24);

  return "approval." + digest;
}

export function previewGate13ApprovalManifest(
  manifestText: string
): Gate13ApprovalManifestPreview {
  return {
    manifest:
      parseManifestText(
        manifestText
      ),
    sha256:
      sha256(
        manifestText
      )
  };
}

export function assertGate13ApprovalConfirmation(
  preview:
    Gate13ApprovalManifestPreview,
  confirmation:
    Gate13ApprovalConfirmation
): void {
  if (
    !confirmation.authorizeAll43
  ) {
    throw new Error(
      "Gate 13 approval requires the explicit --authorize-all-43 flag."
    );
  }

  if (
    confirmation.confirmManifestId !==
      preview.manifest.id
  ) {
    throw new Error(
      "Confirmed Gate 13 manifest ID does not match the canonical approval manifest."
    );
  }

  if (
    confirmation.confirmSha256 !==
      preview.sha256
  ) {
    throw new Error(
      "Confirmed Gate 13 manifest SHA-256 does not match the exact manifest bytes."
    );
  }
}

export function buildGate13ApprovalBatchFromManifest(
  input:
    BuildGate13ApprovalBatchInput
): ResearchApprovalBatch {
  const preview =
    previewGate13ApprovalManifest(
      input.manifestText
    );
  const manifest =
    preview.manifest;

  return ResearchApprovalBatchSchema
    .parse({
      id:
        input.batchId,
      sourceManifestId:
        manifest.id,
      sourceManifestSha256:
        preview.sha256,
      approvedBy:
        input.approvedBy,
      approvedAt:
        input.approvedAt,
      targets:
        manifest.targets.map(
          (candidate) => ({
            id:
              candidate.targetId,
            domain:
              candidate
                .canonicalDomain,
            startUrl:
              candidate.startUrl,
            approvedDomains: [
              ...candidate
                .approvedDomainsCandidate
            ],
            companyNameHint:
              candidate.companyName,
            icpContext:
              candidate.icpContext,
            approval: {
              id:
                approvalId(
                  input.batchId,
                  candidate.targetId
                ),
              scope:
                "public_research_only",
              approvedBy:
                input.approvedBy,
              approvedAt:
                input.approvedAt
            }
          })
        )
    });
}
