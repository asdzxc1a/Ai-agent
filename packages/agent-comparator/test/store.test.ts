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
  describe,
  expect,
  test
} from "vitest";

import {
  ComparatorFileStore
} from "../src/store.js";

describe(
  "ComparatorFileStore",
  () => {
    test(
      "requires separate authorization before first-attempt reservation",
      async () => {
        const root =
          await mkdtemp(
            join(
              tmpdir(),
              "astra-comparator-"
            )
          );
        const store =
          new ComparatorFileStore(
            root,
            () =>
              new Date(
                "2026-09-23T10:00:00.000Z"
              )
          );

        await expect(
          store.reserve({
            targetId:
              "fixture.target",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              {
              harness:
                "codex-cli",
              harnessVersion:
                "fixture",
              model:
                "gpt-5.6-sol",
              browserSkillCliVersion:
                "fixture",
              browserSkillExtensionVersion:
                "fixture",
              browserVersion:
                "fixture",
              browserLabel:
                "astra-agent-comparator"
            }
          })
        ).rejects.toThrow(
          "not authorized"
        );

        const authorization =
          await store.authorize({
            protocolVersion:
              "gate13-agent-comparator-v1",
            protocolSha256:
              "a".repeat(64),
            manifestSha256:
              "c".repeat(64),
            targetCount: 43,
            authorizedBy:
              "fixture-operator"
          });

        expect(
          authorization.authorizedAt
        ).toBe(
          "2026-09-23T10:00:00.000Z"
        );

        const reservation =
          await store.reserve({
            targetId:
              "fixture.target",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              {
              harness:
                "codex-cli",
              harnessVersion:
                "fixture",
              model:
                "gpt-5.6-sol",
              browserSkillCliVersion:
                "fixture",
              browserSkillExtensionVersion:
                "fixture",
              browserVersion:
                "fixture",
              browserLabel:
                "astra-agent-comparator"
            }
          });

        expect(
          reservation.targetId
        ).toBe(
          "fixture.target"
        );

        await expect(
          store.reserve({
            targetId:
              "fixture.target",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              {
              harness:
                "codex-cli",
              harnessVersion:
                "fixture",
              model:
                "gpt-5.6-sol",
              browserSkillCliVersion:
                "fixture",
              browserSkillExtensionVersion:
                "fixture",
              browserVersion:
                "fixture",
              browserLabel:
                "astra-agent-comparator"
            }
          })
        ).rejects.toMatchObject({
          code:
            "EEXIST"
        });
      }
    );

    test(
      "restart recovery preserves the reserved first attempt as failed instead of releasing it",
      async () => {
        const root =
          await mkdtemp(
            join(
              tmpdir(),
              "astra-comparator-recovery-"
            )
          );
        let now =
          new Date(
            "2026-09-23T10:00:00.000Z"
          );
        const store =
          new ComparatorFileStore(
            root,
            () => now
          );

        await store.authorize({
          protocolVersion:
            "gate13-agent-comparator-v1",
          protocolSha256:
            "a".repeat(64),
          manifestSha256:
            "c".repeat(64),
          targetCount: 43,
          authorizedBy:
            "fixture"
        });
        const reservation =
          await store.reserve({
            targetId:
              "fixture.interrupted",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity: {
              harness:
                "codex-cli",
              harnessVersion:
                "fixture",
              model:
                "gpt-5.6-sol",
              browserSkillCliVersion:
                "fixture",
              browserSkillExtensionVersion:
                "fixture",
              browserVersion:
                "fixture",
              browserLabel:
                "astra-agent-comparator"
            }
          });

        now =
          new Date(
            "2026-09-23T10:05:00.000Z"
          );
        const recovered =
          await store
            .finalizeInterrupted(
              "fixture.interrupted",
              "worker process disappeared"
            );

        expect(
          recovered
        ).toMatchObject({
          attemptId:
            reservation.attemptId,
          status:
            "FAILED",
          elapsedMs:
            300_000,
          humanBaselineMinutes:
            null,
          humanReviewMinutes:
            null
        });
        expect(
          recovered.failureReason
        ).toContain(
          "INTERRUPTED"
        );

        await expect(
          store.reserve({
            targetId:
              "fixture.interrupted",
            protocolSha256:
              "a".repeat(64),
            promptSha256:
              "b".repeat(64),
            manifestSha256:
              "c".repeat(64),
            agentIdentity:
              recovered
                .agentIdentity
          })
        ).rejects.toMatchObject({
          code:
            "EEXIST"
        });
      }
    );
  }
);
