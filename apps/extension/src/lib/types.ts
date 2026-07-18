import type { Plan } from "@pinepilot/shared";

/** Client-side view of the authenticated user (subset of the backend DTO). */
export interface AuthUser {
  id: string;
  email: string;
  plan: Plan;
}

/** Explicit, debuggable auth lifecycle states surfaced to the UI. */
export type AuthStatus = "signedOut" | "signingIn" | "signedIn" | "error";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
  status: "signedOut",
  user: null,
  error: null,
};

/** Tokens returned by the backend on login/refresh. */
export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  user: AuthUser;
}
