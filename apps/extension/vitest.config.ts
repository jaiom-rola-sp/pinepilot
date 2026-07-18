import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom is required for React component tests; node-only tests are
    // unaffected (they use Web APIs available in both environments).
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
