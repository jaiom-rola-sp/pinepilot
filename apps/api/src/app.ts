import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import { errorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.js";

/**
 * Build a fully-configured (but not-yet-listening) Fastify instance.
 *
 * Kept separate from the server entrypoint so tests can exercise routes via
 * `app.inject()` without binding a port.
 */
export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const isTest = config.NODE_ENV === "test";

  const app = Fastify({
    logger: isTest ? false : { level: config.LOG_LEVEL },
    disableRequestLogging: isTest,
  });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);

  return app;
}
