import type { AppConfig } from "../src/config.js";
import type { AppDeps } from "../src/app.js";
import { createPrismaClient } from "../src/db/client.js";
import type {
  GoogleIdentity,
  GoogleTokenVerifier,
} from "../src/auth/google.service.js";
import { GoogleAuthError } from "../src/auth/google.service.js";
import type {
  LlmGenerateParams,
  LlmProvider,
  LlmResult,
} from "../src/generation/llm-provider.js";
import { LlmProviderError } from "../src/generation/llm-provider.js";

/** Deterministic test configuration used to build the app under test. */
export const testConfig: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://jaiomrola@localhost:5432/pinepilot_test",
  REDIS_URL: "redis://localhost:6379",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough",
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 30,
  OPENAI_API_KEY: "test-openai-key",
  OPENAI_MODEL: "gpt-4o-2024-08-06",
  LLM_MAX_RETRIES: 1,
};

const VALID_PINE_CONTENT = {
  title: "Sample Indicator",
  summary: "A simple indicator generated for tests.",
  code: "//@version=6\nindicator('Sample')\nplot(close)",
  assumptions: ["Uses close price"],
  warnings: ["Backtest before live use"],
};

/**
 * Configurable fake LLM provider. Returns a fixed valid structured output by
 * default; can be switched to invalid output (drives retry/422) or to throwing
 * (drives 502).
 */
export class FakeLlmProvider implements LlmProvider {
  public readonly name = "fake";
  public readonly model = "fake-model";
  public content: unknown = { ...VALID_PINE_CONTENT };
  public tokensUsed = 123;
  public shouldThrow = false;
  public calls = 0;
  /** Optional per-call outputs, consumed in order (for retry tests). */
  public sequence: unknown[] | null = null;

  async generateStructured(_params: LlmGenerateParams): Promise<LlmResult> {
    this.calls += 1;
    if (this.shouldThrow) {
      throw new LlmProviderError("simulated provider failure");
    }
    const content =
      this.sequence && this.sequence.length > 0
        ? this.sequence.shift()
        : this.content;
    return { content, tokensUsed: this.tokensUsed };
  }
}

/**
 * Configurable fake Google verifier: returns a fixed identity, or throws to
 * simulate a rejected ID token. Keeps tests off the network.
 */
export class FakeGoogleVerifier implements GoogleTokenVerifier {
  public identity: GoogleIdentity = {
    googleId: "google-sub-123",
    email: "trader@example.com",
    emailVerified: true,
  };
  public shouldFail = false;

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (this.shouldFail || idToken === "invalid") {
      throw new GoogleAuthError("simulated verification failure");
    }
    return this.identity;
  }
}

/** Build injectable deps for tests with a real (test-DB) Prisma client. */
export function buildTestDeps(overrides: Partial<AppDeps> = {}): AppDeps & {
  googleVerifier: FakeGoogleVerifier;
  llmProvider: FakeLlmProvider;
} {
  const googleVerifier =
    (overrides.googleVerifier as FakeGoogleVerifier) ??
    new FakeGoogleVerifier();
  const llmProvider =
    (overrides.llmProvider as FakeLlmProvider) ?? new FakeLlmProvider();
  const prisma =
    overrides.prisma ?? createPrismaClient(testConfig.DATABASE_URL);
  return { prisma, googleVerifier, llmProvider };
}
