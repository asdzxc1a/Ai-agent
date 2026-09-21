import {
  execFile
} from "node:child_process";
import {
  createHash
} from "node:crypto";
import {
  readFile
} from "node:fs/promises";
import {
  promisify
} from "node:util";
import {
  fileURLToPath
} from "node:url";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  ResearchApprovalBatchSchema
} from "../src/index.js";

const execFileAsync =
  promisify(execFile);
const repoRoot =
  fileURLToPath(
    new URL(
      "../../../",
      import.meta.url
    )
  );
const scriptPath =
  fileURLToPath(
    new URL(
      "../../../scripts/gate13-approval-preflight.mjs",
      import.meta.url
    )
  );
const manifestUrl =
  new URL(
    "../../../docs/project/data/gate13-us-transportation-approval-candidates-2026-09-20.json",
    import.meta.url
  );

describe(
  "Gate 13 approval operator preflight",
  () => {
    it(
      "emits a schema-valid exact 43-target approval batch bound to the manifest bytes",
      async () => {
        const manifestRaw =
          await readFile(
            manifestUrl,
            "utf8"
          );
        const expectedSha =
          createHash("sha256")
            .update(
              manifestRaw
            )
            .digest("hex");
        const {
          stdout
        } =
          await execFileAsync(
            process.execPath,
            [
              scriptPath,
              "--build-batch",
              "--batch-id",
              "g13-approval-batch-test",
              "--approved-by",
              "operator.test",
              "--approved-at",
              "2026-09-21T08:00:00Z"
            ],
            {
              cwd: repoRoot
            }
          );
        const batch =
          ResearchApprovalBatchSchema
            .parse(
              JSON.parse(
                stdout
              )
            );

        expect(
          batch.sourceManifestId
        ).toBe(
          "g13-us-transportation-approval-candidates-2026-09-20"
        );
        expect(
          batch
            .sourceManifestSha256
        ).toBe(expectedSha);
        expect(batch.targets)
          .toHaveLength(43);
        expect(
          new Set(
            batch.targets.map(
              (target) =>
                target.id
            )
          ).size
        ).toBe(43);

        for (
          const target of
          batch.targets
        ) {
          expect(
            target.approval
              .approvedBy
          ).toBe(
            "operator.test"
          );
          expect(
            target.approval
              .approvedAt
          ).toBe(
            "2026-09-21T08:00:00Z"
          );
          expect(
            target.approval.id
          ).toBe(
            "g13-approval-batch-test:" +
              target.id
          );
        }
      }
    );

    it(
      "reports the exact frozen candidate count without creating approval state",
      async () => {
        const {
          stdout
        } =
          await execFileAsync(
            process.execPath,
            [
              scriptPath
            ],
            {
              cwd: repoRoot
            }
          );
        const summary =
          JSON.parse(
            stdout
          ) as {
            targetCount:
              number;
            manifestStatus:
              string;
            approvalStatus:
              string;
          };

        expect(
          summary.targetCount
        ).toBe(43);
        expect(
          summary.manifestStatus
        ).toBe(
          "NOT_APPROVED"
        );
        expect(
          summary.approvalStatus
        ).toBe(
          "PENDING_OPERATOR_APPROVAL"
        );
      }
    );
  }
);
