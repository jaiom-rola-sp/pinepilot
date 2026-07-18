import type { GenerateResponse } from "@pinepilot/shared";
import type { AuthManager } from "./auth-manager.js";
import { ApiError } from "./api-client.js";
import type { BackgroundRequest } from "./messages.js";
import type { AuthState, AuthUser } from "./types.js";

export type AnyBackgroundResponse =
  | { ok: true; data: AuthState | AuthUser | GenerateResponse }
  | { ok: false; error: string; status?: number };

/**
 * Pure dispatcher from a typed background request to a response. Kept separate
 * from the Chrome `onMessage` wiring so it can be unit-tested directly.
 */
export async function handleBackgroundRequest(
  manager: AuthManager,
  request: BackgroundRequest,
): Promise<AnyBackgroundResponse> {
  try {
    switch (request.type) {
      case "AUTH_SIGN_IN":
        return { ok: true, data: await manager.signIn() };
      case "AUTH_SIGN_OUT":
        return { ok: true, data: await manager.signOut() };
      case "AUTH_GET_STATE":
        return { ok: true, data: manager.getState() };
      case "AUTH_GET_ME":
        return { ok: true, data: await manager.getMe() };
      case "API_GENERATE":
        return { ok: true, data: await manager.generate(request.request) };
      default: {
        const _exhaustive: never = request;
        return {
          ok: false,
          error: `Unknown request: ${JSON.stringify(_exhaustive)}`,
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error",
      // Surface HTTP status (e.g. 401/402/429) so the UI can distinguish
      // quota/usage and expired-session failures.
      status: err instanceof ApiError ? err.status : undefined,
    };
  }
}
