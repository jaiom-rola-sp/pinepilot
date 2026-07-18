/**
 * Persistence boundary for the refresh token.
 *
 * SECURITY: The access token is NEVER stored here — it lives only in memory in
 * the background worker. Only the long-lived refresh token is persisted, and
 * only in `chrome.storage.session` (see {@link ChromeSessionTokenStore}).
 */
export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clear(): Promise<void>;
}

const REFRESH_KEY = "pp_refresh_token";

/**
 * Stores the refresh token in `chrome.storage.session`:
 *  - memory-backed (not written to disk),
 *  - cleared when the browser session ends,
 *  - not accessible to web pages / content scripts (TRUSTED_CONTEXTS default).
 *
 * This survives MV3 service-worker suspension (so the user stays signed in
 * within a browser session) without persisting a credential to disk.
 */
export class ChromeSessionTokenStore implements TokenStore {
  async getRefreshToken(): Promise<string | null> {
    const result = await chrome.storage.session.get(REFRESH_KEY);
    const value = result[REFRESH_KEY];
    return typeof value === "string" ? value : null;
  }

  async setRefreshToken(token: string): Promise<void> {
    await chrome.storage.session.set({ [REFRESH_KEY]: token });
  }

  async clear(): Promise<void> {
    await chrome.storage.session.remove(REFRESH_KEY);
  }
}

/** In-memory store for tests and non-Chrome environments. */
export class InMemoryTokenStore implements TokenStore {
  private token: string | null = null;

  async getRefreshToken(): Promise<string | null> {
    return this.token;
  }

  async setRefreshToken(token: string): Promise<void> {
    this.token = token;
  }

  async clear(): Promise<void> {
    this.token = null;
  }
}
