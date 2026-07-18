import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share a single Postgres database and reset tables in
    // beforeEach; run test files serially so they don't race each other.
    fileParallelism: false,
  },
});
