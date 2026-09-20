import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function workspaceSource(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@astra/run-engine": workspaceSource(
        "./packages/run-engine/src/index.ts"
      )
    }
  },
  test: {
    include: [
      "apps/api/test/api-restart.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 30_000
  }
});
