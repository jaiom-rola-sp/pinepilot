import type { PrismaClient, User } from "@prisma/client";
import type { Plan } from "@pinepilot/shared";
import type { GoogleTokenVerifier } from "./google.service.js";
import { TokenService } from "./token.service.js";
import type { AuthResponse, AuthTokens, UserDto } from "./auth.schemas.js";
import { UnauthorizedError } from "./errors.js";

export interface AuthServiceDeps {
  prisma: PrismaClient;
  googleVerifier: GoogleTokenVerifier;
  tokenService: TokenService;
}

/**
 * Orchestrates authentication: Google login, user upsert, token issuance, and
 * conservative refresh-token rotation. Provider-specific logic lives behind the
 * injected `googleVerifier`; token mechanics behind `tokenService`.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /** Verify a Google ID token, upsert the user, and issue a token bundle. */
  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const identity = await this.deps.googleVerifier.verify(idToken);

    // Upsert on stable email identity; first login creates the user.
    const user = await this.deps.prisma.user.upsert({
      where: { email: identity.email },
      create: { email: identity.email, authProvider: "google" },
      update: {},
    });

    const tokens = await this.issueTokens(user.id);
    return { ...tokens, user: toUserDto(user) };
  }

  /** Look up a user by id (for protected routes such as GET /v1/me). */
  async getUserById(userId: string): Promise<UserDto> {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    return toUserDto(user);
  }

  /**
   * Rotate a refresh token: validate the presented token, revoke it, and issue
   * a fresh access + refresh pair. Invalid, expired, or already-revoked tokens
   * are rejected.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const hash = this.hashRefresh(refreshToken);
    const existing = await this.deps.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });

    if (!existing) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    if (existing.revokedAt) {
      throw new UnauthorizedError("Refresh token has been revoked");
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Refresh token has expired");
    }

    const user = await this.deps.prisma.user.findUnique({
      where: { id: existing.userId },
    });
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    // Issue the replacement first so we can link the rotation.
    const tokens = await this.issueTokens(user.id);
    const newHash = this.hashRefresh(tokens.refreshToken);
    await this.deps.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: newHash },
    });

    return { ...tokens, user: toUserDto(user) };
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const access = this.deps.tokenService.signAccessToken(userId);
    const refresh = this.deps.tokenService.generateRefreshToken();

    await this.deps.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
      },
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      tokenType: "Bearer",
    };
  }

  private hashRefresh(token: string): string {
    return TokenService.hashRefreshToken(token);
  }
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan as Plan,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
