import { fileURLToPath } from "node:url";

import {
  defineConfig
} from "vitest/config";

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
      "@astra/sales-domain":
        workspaceSource(
          "./packages/sales-domain/src/index.ts"
        ),
      "@astra/sales-bench":
        workspaceSource(
          "./packages/sales-bench/src/index.ts"
        )
    }
  }
});
