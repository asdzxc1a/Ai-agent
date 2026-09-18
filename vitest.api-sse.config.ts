import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/test/api-sse.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 30_000
  }
});
