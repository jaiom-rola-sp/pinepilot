import type { FastifyPluginAsync } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import { UnauthorizedError } from "../auth/errors.js";

export interface MeRoutesOptions {
  authService: AuthService;
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  app,
  opts,
) => {
  const { authService } = opts;

  app.get("/v1/me", { preHandler: app.authenticate }, async (request) => {
    const principal = request.principal;
    if (!principal) {
      // Should be unreachable when guarded by `authenticate`.
      throw new UnauthorizedError();
    }
    return authService.getUserById(principal.userId);
  });
};
