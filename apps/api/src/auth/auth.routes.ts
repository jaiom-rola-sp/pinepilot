import type { FastifyPluginAsync } from "fastify";
import type { ZodSchema } from "zod";
import type { AuthService } from "./auth.service.js";
import { GoogleLoginBodySchema, RefreshBodySchema } from "./auth.schemas.js";
import { GoogleAuthError } from "./google.service.js";
import { HttpError, UnauthorizedError } from "./errors.js";

export interface AuthRoutesOptions {
  authService: AuthService;
}

function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, message);
  }
  return result.data;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  opts,
) => {
  const { authService } = opts;

  app.post("/v1/auth/google", async (request, reply) => {
    const { idToken } = parseBody(GoogleLoginBodySchema, request.body);
    try {
      const result = await authService.loginWithGoogle(idToken);
      return reply.status(200).send(result);
    } catch (err) {
      // Provider verification failures are auth failures, not server errors.
      if (err instanceof GoogleAuthError) {
        throw new UnauthorizedError("Google authentication failed");
      }
      throw err;
    }
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const { refreshToken } = parseBody(RefreshBodySchema, request.body);
    const result = await authService.refresh(refreshToken);
    return reply.status(200).send(result);
  });
};
