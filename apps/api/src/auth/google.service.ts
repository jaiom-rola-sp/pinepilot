import { OAuth2Client } from "google-auth-library";

/** Verified identity extracted from a Google ID token. */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Provider boundary for Google authentication. Kept as an interface so the
 * concrete (network-calling) implementation can be swapped for a fake in tests
 * and so an additional provider could be added later without touching callers.
 */
export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/**
 * Concrete verifier that validates a Google ID token against Google's public
 * keys and checks the audience matches our OAuth client ID. No client secret is
 * required for ID-token verification, keeping secrets out of this path.
 */
export class GoogleOAuthVerifier implements GoogleTokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw new GoogleAuthError(
        `Failed to verify Google ID token: ${(err as Error).message}`,
      );
    }

    if (!payload?.sub || !payload.email) {
      throw new GoogleAuthError("Google ID token missing required claims");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
    };
  }
}
