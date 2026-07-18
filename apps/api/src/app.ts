import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { PrismaClient } from "./db/client.js";
import { errorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import {
  GoogleOAuthVerifier,
  type GoogleTokenVerifier,
} from "./auth/google.service.js";
import { TokenService } from "./auth/token.service.js";
import { AuthService } from "./auth/auth.service.js";
import { authPlugin } from "./auth/auth.plugin.js";
import { authRoutes } from "./auth/auth.routes.js";

/**
 * Injectable dependencies. Tests provide a test-database Prisma client and a
 * fake Google verifier; production wiring builds real implementations from
 * config via {@link buildDefaultDeps}.
 */
export interface AppDeps {
  prisma: PrismaClient;
  googleVerifier: GoogleTokenVerifier;
}

export function buildDefaultDeps(
  config: AppConfig,
  prisma: PrismaClient,
): AppDeps {
  return {
    prisma,
    googleVerifier: new GoogleOAuthVerifier(config.GOOGLE_CLIENT_ID),
  };
}

/**
 * Build a fully-configured (but not-yet-listening) Fastify instance.
 * Separated from the server entrypoint so tests can use `app.inject()`.
 */
export async function buildApp(
  config: AppConfig,
  deps: AppDeps,
): Promise<FastifyInstance> {
  const isTest = config.NODE_ENV === "test";

  const app = Fastify({
    logger: isTest ? false : { level: config.LOG_LEVEL },
    disableRequestLogging: isTest,
  });

  app.setErrorHandler(errorHandler);

  const tokenService = new TokenService({
    accessSecret: config.JWT_ACCESS_SECRET,
    accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
  });

  const authService = new AuthService({
    prisma: deps.prisma,
    googleVerifier: deps.googleVerifier,
    tokenService,
  });

  await app.register(authPlugin, { tokenService });

  await app.register(healthRoutes);
  await app.register(authRoutes, { authService });
  await app.register(meRoutes, { authService });

  return app;
}
