import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { createPrismaClient } from "../../src/db/client.js";
import type { PrismaClient } from "../../src/db/client.js";
import { TokenService } from "../../src/auth/token.service.js";
import type { AuthResponse, UserDto } from "../../src/auth/auth.schemas.js";
import { FakeGoogleVerifier, FakeLlmProvider, testConfig } from "../helpers.js";

const prisma: PrismaClient = createPrismaClient(testConfig.DATABASE_URL);
const google = new FakeGoogleVerifier();
let app: FastifyInstance;

async function login(idToken = "valid"): Promise<AuthResponse> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/google",
    payload: { idToken },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as AuthResponse;
}

beforeAll(async () => {
  app = await buildApp(testConfig, {
    prisma,
    googleVerifier: google,
    llmProvider: new FakeLlmProvider(),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  google.shouldFail = false;
  google.identity = {
    googleId: "google-sub-123",
    email: "trader@example.com",
    emailVerified: true,
  };
  // Cascades remove refresh tokens and other dependents.
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /v1/auth/google (login)", () => {
  it("returns tokens and a user on the success path", async () => {
    const body = await login();

    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.tokenType).toBe("Bearer");
    expect(body.expiresIn).toBe(testConfig.ACCESS_TOKEN_TTL_SECONDS);
    expect(body.user.email).toBe("trader@example.com");

    const stored = await prisma.refreshToken.findMany();
    expect(stored).toHaveLength(1);
    // Only the hash is persisted, never the plaintext token.
    expect(stored[0]?.tokenHash).toBe(
      TokenService.hashRefreshToken(body.refreshToken),
    );
  });

  it("upserts the same user on repeated first-party login", async () => {
    const first = await login();
    const second = await login();

    expect(second.user.id).toBe(first.user.id);
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
  });

  it("rejects an invalid Google ID token with 401", async () => {
    google.shouldFail = true;
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/google",
      payload: { idToken: "whatever" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/google",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/me (protected)", () => {
  it("rejects requests without an Authorization header (401)", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a bogus bearer token (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns the current user with a valid access token (200)", async () => {
    const { accessToken, user } = await login();
    const res = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const me = res.json() as UserDto;
    expect(me.id).toBe(user.id);
    expect(me.email).toBe("trader@example.com");
    expect(me.plan).toBe("free");
  });
});

describe("POST /v1/auth/refresh", () => {
  it("rotates tokens on the success path and revokes the old token", async () => {
    const { refreshToken } = await login();

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const rotated = res.json() as AuthResponse;
    expect(rotated.refreshToken).not.toBe(refreshToken);

    // Old token is now revoked; reuse must fail.
    const reuse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    // New token works.
    const again = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: rotated.refreshToken },
    });
    expect(again.statusCode).toBe(200);
  });

  it("rejects an unknown refresh token (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: "does-not-exist" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired refresh token (401)", async () => {
    const { user } = await login();
    const expiredPlain = "expired-refresh-token-value";
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: TokenService.hashRefreshToken(expiredPlain),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: expiredPlain },
    });
    expect(res.statusCode).toBe(401);
  });
});
