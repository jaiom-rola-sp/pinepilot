import type { FastifyPluginAsync } from "fastify";

export interface HealthResponse {
  status: "ok";
  service: "pinepilot-api";
  uptime: number;
}

/**
 * Liveness endpoint. Intentionally dependency-free (no DB/Redis checks) so it
 * reflects process liveness only; readiness with dependency checks is added in
 * a later milestone.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      service: "pinepilot-api",
      uptime: process.uptime(),
    };
  });
};
