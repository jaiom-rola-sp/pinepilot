import type {
  BackgroundRequest,
  BackgroundRequestType,
  BackgroundResponse,
} from "./messages.js";
import type { AuthState, AuthUser } from "./types.js";

/**
 * Thin typed wrapper used by UI/content contexts to talk to the background
 * worker. These contexts never touch tokens or refresh logic directly.
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
    throw new Error(response.error);
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
