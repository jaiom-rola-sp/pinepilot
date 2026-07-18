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

  // Auth (A1)
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 minutes
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Generation / LLM (G1)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-2024-08-06"),
  // Extra attempts when model output fails schema/guardrail validation.
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),

  // Usage quotas (B1) — monthly generate limits per plan. Simple, configurable
  // source of truth until real billing/plan management lands.
  QUOTA_FREE_MONTHLY: z.coerce.number().int().min(0).default(25),
  QUOTA_PRO_MONTHLY: z.coerce.number().int().min(0).default(1000),
  QUOTA_TEAM_MONTHLY: z.coerce.number().int().min(0).default(5000),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/** Monthly generate limits keyed by plan, derived from config. */
export function planLimitsFromConfig(
  config: AppConfig,
): Record<"free" | "pro" | "team", number> {
  return {
    free: config.QUOTA_FREE_MONTHLY,
    pro: config.QUOTA_PRO_MONTHLY,
    team: config.QUOTA_TEAM_MONTHLY,
  };
}

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
