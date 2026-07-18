import { z } from "zod";

/**
 * Environment/configuration contract for the API service.
 *
 * Parsed once at startup. Secrets and connection strings are required so the
 * process fails fast (rather than at first use) when misconfigured.
 */
export const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/** Error thrown when environment validation fails, with readable details. */
export class ConfigError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(
      `Invalid configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`,
    );
    this.name = "ConfigError";
    this.issues = issues;
  }
}

/**
 * Validate and load configuration from an environment-like object.
 *
 * @param env source of raw values (defaults to `process.env`)
 * @throws {ConfigError} when required values are missing or invalid
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigError(issues);
  }

  return parsed.data;
}
