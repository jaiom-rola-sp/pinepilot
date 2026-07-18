import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import type { BackendApi } from "./api-client.js";
import { ApiError } from "./api-client.js";
import type { GoogleSignInProvider } from "./google-auth.js";
import type { TokenStore } from "./token-store.js";
import type { AuthState, AuthUser, TokenBundle } from "./types.js";
import { INITIAL_AUTH_STATE } from "./types.js";

export interface AuthManagerDeps {
  provider: GoogleSignInProvider;
  api: BackendApi;
  store: TokenStore;
  /** Injectable clock for deterministic expiry tests. */
  now?: () => number;
}

/** Refresh the access token this many ms before its stated expiry. */
const EXPIRY_SKEW_MS = 30_000;

type StateListener = (state: AuthState) => void;

/**
 * The single owner of authentication state and tokens in the extension.
 *
 * - Access token: kept ONLY in memory here (never persisted, never sent to UI).
 * - Refresh token: delegated to the injected {@link TokenStore}.
 * - UI/content contexts never refresh directly; they message the background
 *   worker, which delegates to this manager.
 */
export class AuthManager {
  private state: AuthState = { ...INITIAL_AUTH_STATE };
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private readonly listeners = new Set<StateListener>();
  private readonly now: () => number;

  constructor(private readonly deps: AuthManagerDeps) {
    this.now = deps.now ?? Date.now;
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Restore a session on worker startup: if a refresh token exists, exchange it
   * for a fresh access token. Silently returns to signed-out on failure.
   */
  async initialize(): Promise<AuthState> {
    const refreshToken = await this.deps.store.getRefreshToken();
    if (!refreshToken) {
      return this.setState({ status: "signedOut", user: null, error: null });
    }
    try {
      const bundle = await this.deps.api.refresh(refreshToken);
      return this.applyLogin(bundle);
    } catch {
      await this.clearSession();
      return this.setState({ status: "signedOut", user: null, error: null });
    }
  }

  /** Signed-out -> signing-in -> signed-in (or error). */
  async signIn(): Promise<AuthState> {
    this.setState({ status: "signingIn", user: null, error: null });
    try {
      const idToken = await this.deps.provider.signIn();
      const bundle = await this.deps.api.loginWithGoogle(idToken);
      return this.applyLogin(bundle);
    } catch (err) {
      return this.setState({
        status: "error",
        user: null,
        error: err instanceof Error ? err.message : "Sign-in failed",
      });
    }
  }

  /** Clear all session state locally and in the token store. */
  async signOut(): Promise<AuthState> {
    await this.clearSession();
    return this.setState({ status: "signedOut", user: null, error: null });
  }

  /** Authenticated call routed through the background worker. */
  async getMe(): Promise<AuthUser> {
    const accessToken = await this.ensureAccessToken();
    return this.deps.api.getMe(accessToken);
  }

  /**
   * Authenticated Pine generation, routed through the background worker. Ensures
   * a valid access token first; on a rejected token, clears the session so the
   * UI reflects the expired state via the existing auth path.
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const accessToken = await this.ensureAccessToken();
    try {
      return await this.deps.api.generate(accessToken, request);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await this.clearSession();
        this.setState({ status: "signedOut", user: null, error: null });
      }
      throw err;
    }
  }

  /**
   * Return a valid access token, transparently refreshing when missing or near
   * expiry. Throws (and forces sign-out) when no valid session can be produced.
   */
  private async ensureAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.now() < this.accessTokenExpiresAt - EXPIRY_SKEW_MS
    ) {
      return this.accessToken;
    }

    const refreshToken = await this.deps.store.getRefreshToken();
    if (!refreshToken) {
      await this.clearSession();
      this.setState({ status: "signedOut", user: null, error: null });
      throw new ApiError(401, "Not authenticated");
    }

    try {
      const bundle = await this.deps.api.refresh(refreshToken);
      this.applyLogin(bundle);
      return bundle.accessToken;
    } catch (err) {
      await this.clearSession();
      this.setState({ status: "signedOut", user: null, error: null });
      throw err instanceof Error ? err : new ApiError(401, "Refresh failed");
    }
  }

  private applyLogin(bundle: TokenBundle): AuthState {
    this.accessToken = bundle.accessToken;
    this.accessTokenExpiresAt = this.now() + bundle.expiresIn * 1000;
    // Fire-and-forget persistence of the rotated refresh token.
    void this.deps.store.setRefreshToken(bundle.refreshToken);
    return this.setState({
      status: "signedIn",
      user: bundle.user,
      error: null,
    });
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    await this.deps.store.clear();
  }

  private setState(next: AuthState): AuthState {
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
    return next;
  }
}
