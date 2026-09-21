import {
  readFile
} from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  GATE13_APPROVAL_MANIFEST_PATH,
  assertGate13ApprovalConfirmation,
  buildGate13ApprovalBatchFromManifest,
  previewGate13ApprovalManifest
} from "../src/approval.js";

const approvedAt =
  "2026-09-21T12:00:00.000Z";

async function canonicalManifest():
  Promise<string> {
  return readFile(
    GATE13_APPROVAL_MANIFEST_PATH,
    "utf8"
  );
}

describe(
  "Gate 13 approval operator",
  () => {
    it(
      "derives the exact 43-target batch and manifest hash from canonical bytes",
      async () => {
        const text =
          await canonicalManifest();
        const preview =
          previewGate13ApprovalManifest(
            text
          );
        const batch =
          buildGate13ApprovalBatchFromManifest({
            manifestText:
              text,
            batchId:
              "g13.batch.test",
            approvedBy:
              "operator@example",
            approvedAt
          });

        expect(
          preview.sha256
        ).toBe(
          "9b050c12d784f8476ca0f80cbdb9e425b634b9d2c484730ac1617c025dcec109"
        );
        expect(
          batch
            .sourceManifestSha256
        ).toBe(
          preview.sha256
        );
        expect(
          batch
            .sourceManifestRaw
        ).toBe(text);
        expect(
          batch.targets
        ).toHaveLength(43);
        expect(
          new Set(
            batch.targets.map(
              (target) =>
                target.id
            )
          ).size
        ).toBe(43);
        expect(
          new Set(
            batch.targets.map(
              (target) =>
                target.approval.id
            )
          ).size
        ).toBe(43);
        expect(
          batch.targets
            .every(
              (target) =>
                target.approval
                  .approvedBy ===
                  batch.approvedBy &&
                target.approval
                  .approvedAt ===
                  batch.approvedAt
            )
        ).toBe(true);

        const unp =
          batch.targets.find(
            (target) =>
              target.id ===
              "g13.us.transport.unp"
          );

        expect(
          unp
        ).toMatchObject({
          domain:
            "up.com",
          startUrl:
            "https://www.up.com/about-us",
          approvedDomains: [
            "up.com"
          ],
          companyNameHint:
            "Union Pacific Corporation"
        });
      }
    );

    it(
      "requires exact manifest identity, hash, and explicit all-43 authorization",
      async () => {
        const text =
          await canonicalManifest();
        const preview =
          previewGate13ApprovalManifest(
            text
          );

        expect(() =>
          assertGate13ApprovalConfirmation(
            preview,
            {
              confirmManifestId:
                preview.manifest.id,
              confirmSha256:
                preview.sha256,
              authorizeAll43:
                true
            }
          )
        ).not.toThrow();

        expect(() =>
          assertGate13ApprovalConfirmation(
            preview,
            {
              confirmManifestId:
                preview.manifest.id,
              confirmSha256:
                "0".repeat(64),
              authorizeAll43:
                true
            }
          )
        ).toThrow(
          "exact manifest bytes"
        );

        expect(() =>
          assertGate13ApprovalConfirmation(
            preview,
            {
              confirmManifestId:
                "wrong-manifest",
              confirmSha256:
                preview.sha256,
              authorizeAll43:
                true
            }
          )
        ).toThrow(
          "manifest ID"
        );

        expect(() =>
          assertGate13ApprovalConfirmation(
            preview,
            {
              confirmManifestId:
                preview.manifest.id,
              confirmSha256:
                preview.sha256,
              authorizeAll43:
                false
            }
          )
        ).toThrow(
          "--authorize-all-43"
        );
      }
    );

    it(
      "rejects manifest drift before an approval batch can be built",
      async () => {
        const text =
          await canonicalManifest();
        const parsed =
          JSON.parse(
            text
          ) as {
            status: string;
            targets: Array<{
              approvalStatus:
                string;
            }>;
          };

        parsed.status =
          "APPROVED";

        expect(() =>
          previewGate13ApprovalManifest(
            JSON.stringify(
              parsed
            )
          )
        ).toThrow();

        const second =
          JSON.parse(
            text
          ) as {
            status: string;
            targets: Array<{
              approvalStatus:
                string;
            }>;
          };

        second.targets[0]!
          .approvalStatus =
          "APPROVED";

        expect(() =>
          buildGate13ApprovalBatchFromManifest({
            manifestText:
              JSON.stringify(
                second
              ),
            batchId:
              "g13.batch.test",
            approvedBy:
              "operator@example",
            approvedAt
          })
        ).toThrow();
      }
    );
  }
);
