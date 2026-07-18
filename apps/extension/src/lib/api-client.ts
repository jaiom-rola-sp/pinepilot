import type { AuthUser, TokenBundle } from "./types.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Service boundary for backend auth calls. All network access to the PinePilot
 * API from the extension goes through this client (invoked only by the
 * background worker).
 */
export interface AuthApi {
  loginWithGoogle(idToken: string): Promise<TokenBundle>;
  refresh(refreshToken: string): Promise<TokenBundle>;
  getMe(accessToken: string): Promise<AuthUser>;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Injectable for testing; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

interface BackendUser {
  id: string;
  email: string;
  plan: AuthUser["plan"];
}

interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: BackendUser;
}

export class ApiClient implements AuthApi {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async loginWithGoogle(idToken: string): Promise<TokenBundle> {
    const data = await this.post<BackendAuthResponse>("/v1/auth/google", {
      idToken,
    });
    return this.toTokenBundle(data);
  }

  async refresh(refreshToken: string): Promise<TokenBundle> {
    const data = await this.post<BackendAuthResponse>("/v1/auth/refresh", {
      refreshToken,
    });
    return this.toTokenBundle(data);
  }

  async getMe(accessToken: string): Promise<AuthUser> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/me`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = await this.readBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, this.errorMessage(body, "GET /v1/me"));
    }
    return body as AuthUser;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await this.readBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, this.errorMessage(body, path));
    }
    return body as T;
  }

  private async readBody(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  private errorMessage(body: unknown, context: string): string {
    const message = (body as { error?: { message?: string } })?.error?.message;
    return message ?? `Request failed: ${context}`;
  }

  private toTokenBundle(data: BackendAuthResponse): TokenBundle {
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      user: {
        id: data.user.id,
        email: data.user.email,
        plan: data.user.plan,
      },
    };
  }
}
