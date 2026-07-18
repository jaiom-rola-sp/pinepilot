import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import type { AuthState, AuthUser } from "./types.js";

/**
 * Typed contract for messages sent from UI/content contexts to the background
 * service worker. The background worker is the single owner of auth logic and
 * authenticated API calls; all other contexts communicate only via these.
 */
export type BackgroundRequest =
  | { type: "AUTH_SIGN_IN" }
  | { type: "AUTH_SIGN_OUT" }
  | { type: "AUTH_GET_STATE" }
  | { type: "AUTH_GET_ME" }
  | { type: "API_GENERATE"; request: GenerateRequest };

export type BackgroundRequestType = BackgroundRequest["type"];

/** Response payload keyed by request type. */
export interface BackgroundResponseData {
  AUTH_SIGN_IN: AuthState;
  AUTH_SIGN_OUT: AuthState;
  AUTH_GET_STATE: AuthState;
  AUTH_GET_ME: AuthUser;
  API_GENERATE: GenerateResponse;
}

export type BackgroundResponse<T extends BackgroundRequestType> =
  | { ok: true; data: BackgroundResponseData[T] }
  | { ok: false; error: string; status?: number };

/** Broadcast emitted by the background worker when auth state changes. */
export interface AuthStateChangedEvent {
  type: "AUTH_STATE_CHANGED";
  state: AuthState;
}

const REQUEST_TYPES: ReadonlySet<string> = new Set<BackgroundRequestType>([
  "AUTH_SIGN_IN",
  "AUTH_SIGN_OUT",
  "AUTH_GET_STATE",
  "AUTH_GET_ME",
  "API_GENERATE",
]);

/** Runtime guard: is an unknown value a valid background request? */
export function isBackgroundRequest(
  value: unknown,
): value is BackgroundRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string" &&
    REQUEST_TYPES.has((value as { type: string }).type)
  );
}

export function isAuthStateChangedEvent(
  value: unknown,
): value is AuthStateChangedEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "AUTH_STATE_CHANGED"
  );
}
