import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { buildTestDeps, testConfig } from "./helpers.js";

describe("buildApp", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("initializes a Fastify instance cleanly", async () => {
    app = await buildApp(testConfig, buildTestDeps());
    await app.ready();

    expect(app).toBeDefined();
    expect(typeof app.inject).toBe("function");
    expect(app.hasRoute({ method: "GET", url: "/health" })).toBe(true);
    expect(app.hasRoute({ method: "POST", url: "/v1/auth/google" })).toBe(true);
    expect(app.hasRoute({ method: "GET", url: "/v1/me" })).toBe(true);
  });
});
