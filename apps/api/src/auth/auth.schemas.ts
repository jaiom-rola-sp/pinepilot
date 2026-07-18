import { z } from "zod";
import type { Plan } from "@pinepilot/shared";

/** `POST /v1/auth/google` request body. */
export const GoogleLoginBodySchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});
export type GoogleLoginBody = z.infer<typeof GoogleLoginBodySchema>;

/** `POST /v1/auth/refresh` request body. */
export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

/** Public, client-safe representation of a user. */
export interface UserDto {
  id: string;
  email: string;
  plan: Plan;
  status: string;
  createdAt: string;
}

/** Token bundle issued on login/refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  tokenType: "Bearer";
}

/** `POST /v1/auth/google` and `/v1/auth/refresh` response. */
export interface AuthResponse extends AuthTokens {
  user: UserDto;
}
