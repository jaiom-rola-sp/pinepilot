import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

export interface AccessTokenClaims {
  /** Subject: the PinePilot user id. */
  sub: string;
  /** Token type marker to prevent cross-use of tokens. */
  type: "access";
}

export interface TokenServiceOptions {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export interface GeneratedRefreshToken {
  /** Plaintext token returned to the client exactly once. */
  token: string;
  /** SHA-256 hash persisted server-side. */
  hash: string;
  expiresAt: Date;
}

/**
 * Issues and verifies auth tokens.
 *
 * Access tokens: short-lived stateless HS256 JWTs.
 * Refresh tokens: opaque high-entropy random strings. Only their SHA-256 hash
 * is persisted; the plaintext is shown to the client once.
 */
export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  signAccessToken(userId: string): { token: string; expiresIn: number } {
    const token = jwt.sign(
      { sub: userId, type: "access" } satisfies AccessTokenClaims,
      this.options.accessSecret,
      { expiresIn: this.options.accessTtlSeconds },
    );
    return { token, expiresIn: this.options.accessTtlSeconds };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.options.accessSecret);
    } catch (err) {
      throw new TokenError(`Invalid access token: ${(err as Error).message}`);
    }

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      (decoded as { type?: unknown }).type !== "access" ||
      typeof (decoded as { sub?: unknown }).sub !== "string"
    ) {
      throw new TokenError("Malformed access token claims");
    }

    const claims = decoded as AccessTokenClaims;
    return { sub: claims.sub, type: "access" };
  }

  generateRefreshToken(): GeneratedRefreshToken {
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.options.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    return { token, hash: TokenService.hashRefreshToken(token), expiresAt };
  }

  /** Deterministic hash used both when storing and when looking up a token. */
  static hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
