import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/browser-steel/test/**/*.integration.ts"],
    maxWorkers: 1,
    testTimeout: 240_000,
    hookTimeout: 30_000
  }
});
