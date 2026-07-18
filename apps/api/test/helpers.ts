import type { AppConfig } from "../src/config.js";
import type { AppDeps } from "../src/app.js";
import { createPrismaClient } from "../src/db/client.js";
import type {
  GoogleIdentity,
  GoogleTokenVerifier,
} from "../src/auth/google.service.js";
import { GoogleAuthError } from "../src/auth/google.service.js";

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
};

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
export function buildTestDeps(
  overrides: Partial<AppDeps> = {},
): AppDeps & { googleVerifier: FakeGoogleVerifier } {
  const googleVerifier =
    (overrides.googleVerifier as FakeGoogleVerifier) ??
    new FakeGoogleVerifier();
  const prisma =
    overrides.prisma ?? createPrismaClient(testConfig.DATABASE_URL);
  return { prisma, googleVerifier };
}
