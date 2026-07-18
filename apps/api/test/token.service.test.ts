import { describe, expect, it } from "vitest";
import { TokenError, TokenService } from "../src/auth/token.service.js";

function makeService(accessTtlSeconds = 900): TokenService {
  return new TokenService({
    accessSecret: "test-access-secret-that-is-long-enough",
    accessTtlSeconds,
    refreshTtlDays: 30,
  });
}

describe("TokenService access tokens", () => {
  it("signs and verifies an access token round-trip", () => {
    const svc = makeService();
    const { token, expiresIn } = svc.signAccessToken("user-1");

    expect(expiresIn).toBe(900);
    const claims = svc.verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.type).toBe("access");
  });

  it("rejects a tampered/invalid token", () => {
    const svc = makeService();
    expect(() => svc.verifyAccessToken("not-a-jwt")).toThrow(TokenError);
  });

  it("rejects a token signed with a different secret", () => {
    const a = makeService();
    const other = new TokenService({
      accessSecret: "a-completely-different-secret-value",
      accessTtlSeconds: 900,
      refreshTtlDays: 30,
    });
    const { token } = a.signAccessToken("user-1");
    expect(() => other.verifyAccessToken(token)).toThrow(TokenError);
  });

  it("rejects an expired token", async () => {
    const svc = makeService(1);
    const { token } = svc.signAccessToken("user-1");
    // jsonwebtoken exp is second-granular; wait past expiry.
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => svc.verifyAccessToken(token)).toThrow(TokenError);
  });
});

describe("TokenService refresh tokens", () => {
  it("generates a hashed refresh token with a future expiry", () => {
    const svc = makeService();
    const generated = svc.generateRefreshToken();

    expect(generated.token).toBeTruthy();
    expect(generated.hash).toHaveLength(64); // sha256 hex
    expect(generated.hash).not.toBe(generated.token);
    expect(generated.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("hashes deterministically for lookup", () => {
    const generated = makeService().generateRefreshToken();
    expect(TokenService.hashRefreshToken(generated.token)).toBe(generated.hash);
  });
});
