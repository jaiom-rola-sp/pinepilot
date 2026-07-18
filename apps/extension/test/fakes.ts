import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import type { BackendApi } from "../src/lib/api-client.js";
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

const generateResult: GenerateResponse = {
  title: "RSI ATR Strategy",
  summary: "RSI entries with ATR-based stops.",
  code: "//@version=6\nstrategy('RSI ATR')\nplot(close)",
  assumptions: ["Long only"],
  warnings: ["Backtest before live use"],
  usage: { requestsRemaining: 42 },
};

export class FakeBackendApi implements BackendApi {
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
  public generateResult: GenerateResponse = generateResult;

  public failLogin = false;
  public failRefresh = false;
  public failMe = false;
  /** Set to an ApiError to make generate reject. */
  public generateError: ApiError | null = null;

  public calls = { login: 0, refresh: 0, me: 0, generate: 0 };
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

  async generate(
    accessToken: string,
    _request: GenerateRequest,
  ): Promise<GenerateResponse> {
    this.calls.generate += 1;
    this.lastAccessToken = accessToken;
    if (this.generateError) {
      throw this.generateError;
    }
    return this.generateResult;
  }
}

/** @deprecated Use {@link FakeBackendApi}. */
export const FakeAuthApi = FakeBackendApi;
