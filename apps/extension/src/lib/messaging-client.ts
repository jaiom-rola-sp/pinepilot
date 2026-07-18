import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import type {
  BackgroundRequest,
  BackgroundRequestType,
  BackgroundResponse,
} from "./messages.js";
import type { AuthState, AuthUser } from "./types.js";

/** Error thrown when a background request fails, carrying any HTTP status. */
export class BackgroundRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BackgroundRequestError";
  }

  /** Quota/usage-limit failure (HTTP 402/429). */
  get isQuota(): boolean {
    return this.status === 402 || this.status === 429;
  }

  /** Unauthenticated / expired-session failure (HTTP 401). */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * Thin typed wrapper used by UI/content contexts to talk to the background
 * worker. These contexts never touch tokens, refresh logic, or the backend.
 */
async function send<T extends BackgroundRequestType>(
  request: Extract<BackgroundRequest, { type: T }>,
): Promise<BackgroundResponse<T>> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse<T>;
}

function unwrap<T extends BackgroundRequestType>(
  response: BackgroundResponse<T>,
): BackgroundResponse<T> extends { ok: true; data: infer D } ? D : never {
  if (!response.ok) {
    throw new BackgroundRequestError(response.error, response.status);
  }
  return response.data as never;
}

export async function requestSignIn(): Promise<AuthState> {
  return unwrap(await send({ type: "AUTH_SIGN_IN" }));
}

export async function requestSignOut(): Promise<AuthState> {
  return unwrap(await send({ type: "AUTH_SIGN_OUT" }));
}

export async function requestAuthState(): Promise<AuthState> {
  return unwrap(await send({ type: "AUTH_GET_STATE" }));
}

export async function requestMe(): Promise<AuthUser> {
  return unwrap(await send({ type: "AUTH_GET_ME" }));
}

export async function requestGenerate(
  request: GenerateRequest,
): Promise<GenerateResponse> {
  return unwrap(await send({ type: "API_GENERATE", request }));
}
