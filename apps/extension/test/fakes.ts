import type { AuthApi } from "../src/lib/api-client.js";
import { ApiError } from "../src/lib/api-client.js";
import type { GoogleSignInProvider } from "../src/lib/google-auth.js";
import { GoogleSignInError } from "../src/lib/google-auth.js";
import type { AuthUser, TokenBundle } from "../src/lib/types.js";

export const testUser: AuthUser = {
  id: "user-1",
  email: "trader@example.com",
  plan: "free",
};

export class FakeGoogleProvider implements GoogleSignInProvider {
  public idToken = "google-id-token";
  public shouldFail = false;

  async signIn(): Promise<string> {
    if (this.shouldFail) {
      throw new GoogleSignInError("sign-in cancelled");
    }
    return this.idToken;
  }
}

export class FakeAuthApi implements AuthApi {
  public loginResult: TokenBundle = {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresIn: 900,
    user: testUser,
  };
  public refreshResult: TokenBundle = {
    accessToken: "access-2",
    refreshToken: "refresh-2",
    expiresIn: 900,
    user: testUser,
  };
  public meResult: AuthUser = testUser;

  public failLogin = false;
  public failRefresh = false;
  public failMe = false;

  public calls = { login: 0, refresh: 0, me: 0 };
  public lastAccessToken: string | null = null;

  async loginWithGoogle(_idToken: string): Promise<TokenBundle> {
    this.calls.login += 1;
    if (this.failLogin) {
      throw new ApiError(401, "login failed");
    }
    return this.loginResult;
  }

  async refresh(_refreshToken: string): Promise<TokenBundle> {
    this.calls.refresh += 1;
    if (this.failRefresh) {
      throw new ApiError(401, "refresh failed");
    }
    return this.refreshResult;
  }

  async getMe(accessToken: string): Promise<AuthUser> {
    this.calls.me += 1;
    this.lastAccessToken = accessToken;
    if (this.failMe) {
      throw new ApiError(401, "me failed");
    }
    return this.meResult;
  }
}
