import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/agent-stagehand/test/**/*.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 300_000,
    hookTimeout: 30_000
  }
});
