import {
  readFile
} from "node:fs/promises";
import {
  resolve
} from "node:path";

import {
  expect,
  test
} from "vitest";

const FORBIDDEN = [
  "@astra/prospect-postgres",
  "@astra/prospect-research",
  "apps/gate13-operator",
  "GATE13_DATABASE_URL",
  "prospect_research_"
] as const;

test(
  "comparator app has no dependency or source path into the original Gate 13 acceptance state",
  async () => {
    const packageText =
      await readFile(
        resolve(
          process.cwd(),
          "apps/gate13-agent-comparator/package.json"
        ),
        "utf8"
      );
    const sourcePaths = [
      "apps/gate13-agent-comparator/src/cli.ts",
      "apps/gate13-agent-comparator/src/protocol.ts",
      "apps/gate13-agent-comparator/src/readiness.ts",
      "apps/gate13-agent-comparator/src/browser-environment.ts",
      "apps/gate13-agent-comparator/src/codex-browser-worker.ts",
      "apps/gate13-agent-comparator/src/bsk-client-source.ts",
      "apps/gate13-agent-comparator/src/bsk-file-broker.ts",
      "apps/gate13-agent-comparator/src/guard-policy.ts"
    ];
    const source =
      (
        await Promise.all(
          sourcePaths.map(
            (path) =>
              readFile(
                resolve(
                  process.cwd(),
                  path
                ),
                "utf8"
              )
          )
        )
      ).join(
        "\n"
      );
    const combined =
      packageText +
      "\n" +
      source;

    for (
      const forbidden of
      FORBIDDEN
    ) {
      expect(
        combined
      ).not.toContain(
        forbidden
      );
    }
  }
);
