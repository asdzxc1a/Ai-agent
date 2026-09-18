import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/browser-steel/test/**/*.integration.test.ts"
    ],
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 150_000,
    testTimeout: 300_000
  }
});
