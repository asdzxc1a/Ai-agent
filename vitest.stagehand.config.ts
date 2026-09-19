import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function workspaceSource(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@astra/agent-runtime": workspaceSource(
        "./packages/agent-runtime/src/index.ts"
      ),
      "@astra/agent-loop": workspaceSource(
        "./packages/agent-loop/src/index.ts"
      ),
      "@astra/artifact-store": workspaceSource(
        "./packages/artifact-store/src/index.ts"
      ),
      "@astra/browser-runtime": workspaceSource(
        "./packages/browser-runtime/src/index.ts"
      ),
      "@astra/browser-steel": workspaceSource(
        "./packages/browser-steel/src/index.ts"
      ),
      "@astra/contracts": workspaceSource(
        "./packages/contracts/src/index.ts"
      ),
      "@astra/run-engine": workspaceSource(
        "./packages/run-engine/src/index.ts"
      ),
      "@astra/research-bench": workspaceSource(
        "./packages/research-bench/src/index.ts"
      ),
      "@astra/sandbox-runtime": workspaceSource(
        "./packages/sandbox-runtime/src/index.ts"
      )
    }
  },
  test: {
    include: [
      "packages/agent-stagehand/test/**/*.integration.ts",
      "packages/run-engine/test/steel-cancellation.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 300_000,
    hookTimeout: 30_000
  }
});
