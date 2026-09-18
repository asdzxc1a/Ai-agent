import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/test/api-restart.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 30_000
  }
});
