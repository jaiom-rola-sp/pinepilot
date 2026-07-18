import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { HealthResponse } from "../src/routes/health.js";
import { buildTestDeps, testConfig } from "./helpers.js";

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(testConfig, buildTestDeps());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with the expected payload", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");

    const body = response.json() as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pinepilot-api");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns 404 for an unknown route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/does-not-exist",
    });
    expect(response.statusCode).toBe(404);
  });
});
