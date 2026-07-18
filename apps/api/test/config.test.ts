import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
} satisfies NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("parses a valid environment and applies defaults", () => {
    const config = loadConfig(validEnv);

    expect(config.NODE_ENV).toBe("test");
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.REDIS_URL).toBe(validEnv.REDIS_URL);
    // Defaults
    expect(config.HOST).toBe("0.0.0.0");
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("info");
  });

  it("coerces PORT from a string to a number", () => {
    const config = loadConfig({ ...validEnv, PORT: "8080" });
    expect(config.PORT).toBe(8080);
  });

  it("throws ConfigError when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _omit, ...withoutDb } = validEnv;

    expect(() => loadConfig(withoutDb)).toThrow(ConfigError);

    try {
      loadConfig(withoutDb);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).issues.join("\n")).toContain("DATABASE_URL");
    }
  });

  it("throws ConfigError when PORT is not a valid number", () => {
    expect(() => loadConfig({ ...validEnv, PORT: "not-a-number" })).toThrow(
      ConfigError,
    );
  });

  it("throws ConfigError for an unsupported NODE_ENV", () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: "staging" })).toThrow(
      ConfigError,
    );
  });
});
