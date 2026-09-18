import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/run-postgres/test/**/*.integration.ts"
    ],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 30_000
  }
});
