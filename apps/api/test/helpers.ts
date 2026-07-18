import type { AppConfig } from "../src/config.js";

/** Deterministic test configuration used to build the app under test. */
export const testConfig: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
};
