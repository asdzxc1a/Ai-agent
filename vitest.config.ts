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
      "@astra/sales-domain": workspaceSource(
        "./packages/sales-domain/src/index.ts"
      ),
      "@astra/sales-bench": workspaceSource(
        "./packages/sales-bench/src/index.ts"
      )
    }
  }
});
