import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure each test starts with a clean DOM (vitest does not enable
// testing-library auto-cleanup unless globals are on).
afterEach(() => {
  cleanup();
});
