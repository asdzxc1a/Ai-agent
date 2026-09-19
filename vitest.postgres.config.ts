import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function workspaceSource(
  path: string
): string {
  return fileURLToPath(
    new URL(path, import.meta.url)
  );
}

export default defineConfig({
  resolve: {
    alias: {
      "@astra/artifact-store":
        workspaceSource(
          "./packages/artifact-store/src/index.ts"
        )
    }
  },
  test: {
    include: [
      "packages/run-postgres/test/**/*.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 30_000
  }
});
