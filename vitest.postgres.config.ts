import {
  fileURLToPath
} from "node:url";

import {
  defineConfig
} from "vitest/config";

function workspaceSource(
  path: string
): string {
  return fileURLToPath(
    new URL(
      path,
      import.meta.url
    )
  );
}

export default defineConfig({
  resolve: {
    alias: {
      "@astra/contracts":
        workspaceSource(
          "./packages/contracts/src/index.ts"
        ),
      "@astra/run-engine":
        workspaceSource(
          "./packages/run-engine/src/index.ts"
        ),
      "@astra/artifact-store":
        workspaceSource(
          "./packages/artifact-store/src/index.ts"
        ),
      "@astra/sales-domain":
        workspaceSource(
          "./packages/sales-domain/src/index.ts"
        ),
      "@astra/sandbox-runtime":
        workspaceSource(
          "./packages/sandbox-runtime/src/index.ts"
        ),
      "@astra/prospect-research":
        workspaceSource(
          "./packages/prospect-research/src/index.ts"
        ),
      "@astra/prospect-postgres":
        workspaceSource(
          "./packages/prospect-postgres/src/index.ts"
        )
    }
  },
  test: {
    include: [
      "packages/run-postgres/test/**/*.integration.ts",
      "packages/prospect-postgres/test/**/*.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 30_000
  }
});
