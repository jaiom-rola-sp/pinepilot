/**
 * Provider boundary for obtaining a Google ID token in the extension. Kept as
 * an interface so the background worker can depend on an abstraction and tests
 * can inject a fake without touching Chrome APIs.
 */
export interface GoogleSignInProvider {
  /** Returns a Google ID token (JWT) to be verified by the backend. */
  signIn(): Promise<string>;
}

export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSignInError";
  }
}

/**
 * Chrome implementation using `chrome.identity.launchWebAuthFlow`. Requests an
 * OpenID Connect `id_token` via the implicit flow; no client secret is needed
 * or stored in the extension.
 */
export class ChromeIdentityGoogleProvider implements GoogleSignInProvider {
  constructor(private readonly clientId: string) {}

  async signIn(): Promise<string> {
    if (!this.clientId) {
      throw new GoogleSignInError("Missing Google client ID");
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const nonce = crypto.randomUUID();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("response_type", "id_token");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("prompt", "select_account");

    const redirect = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    if (!redirect) {
      throw new GoogleSignInError("Sign-in was cancelled");
    }

    const idToken = ChromeIdentityGoogleProvider.parseIdToken(redirect);
    if (!idToken) {
      throw new GoogleSignInError("No id_token returned from Google");
    }
    return idToken;
  }

  /** Extract `id_token` from the OAuth redirect URL fragment. */
  static parseIdToken(redirectUrl: string): string | null {
    const hashIndex = redirectUrl.indexOf("#");
    if (hashIndex === -1) {
      return null;
    }
    const fragment = redirectUrl.slice(hashIndex + 1);
    const params = new URLSearchParams(fragment);
    return params.get("id_token");
  }
}
