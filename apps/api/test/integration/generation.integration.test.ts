import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { createPrismaClient } from "../../src/db/client.js";
import type { PrismaClient } from "../../src/db/client.js";
import { FakeGoogleVerifier, FakeLlmProvider, testConfig } from "../helpers.js";

const prisma: PrismaClient = createPrismaClient(testConfig.DATABASE_URL);
const google = new FakeGoogleVerifier();
const llm = new FakeLlmProvider();
let app: FastifyInstance;

const validBody = {
  prompt: "Build an RSI strategy with an ATR stop loss",
  taskType: "strategy",
  pineVersion: "v6",
};

async function signInAndGetToken(): Promise<{
  accessToken: string;
  userId: string;
}> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/google",
    payload: { idToken: "valid" },
  });
  const body = res.json() as { accessToken: string; user: { id: string } };
  return { accessToken: body.accessToken, userId: body.user.id };
}

beforeAll(async () => {
  app = await buildApp(testConfig, {
    prisma,
    googleVerifier: google,
    llmProvider: llm,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Reset provider behaviour.
  llm.shouldThrow = false;
  llm.calls = 0;
  llm.sequence = null;
  llm.content = {
    title: "RSI ATR Strategy",
    summary: "RSI entries with ATR-based stops.",
    code: "//@version=6\nstrategy('RSI ATR')\nplot(close)",
    assumptions: ["Long only"],
    warnings: ["Backtest before live use"],
  };
  await prisma.generation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /v1/generate auth", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      payload: validBody,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an invalid body with 400 (authenticated)", async () => {
    const { accessToken } = await signInAndGetToken();
    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { taskType: "strategy" }, // missing prompt
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /v1/generate success", () => {
  it("returns valid structured output and persists a Generation row", async () => {
    const { accessToken, userId } = await signInAndGetToken();

    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      title: string;
      code: string;
      assumptions: string[];
      warnings: string[];
      usage: { requestsRemaining: number };
    };
    expect(body.title).toBe("RSI ATR Strategy");
    expect(body.code).toContain("//@version=6");
    expect(Array.isArray(body.assumptions)).toBe(true);
    expect(body.usage.requestsRemaining).toBeGreaterThanOrEqual(0);

    const rows = await prisma.generation.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.prompt).toBe(validBody.prompt);
    expect(row.taskType).toBe("strategy");
    expect(row.pineVersion).toBe("v6");
    expect(row.outputTitle).toBe("RSI ATR Strategy");
    expect(row.outputCode).toContain("//@version=6");
    expect(row.outputSummary).toBeTruthy();
    expect(row.provider).toBe("fake");
    expect(row.model).toBe("fake-model");
    expect(row.promptVersion).toBe("pine-gen-v1");
    expect(row.tokenCost).toBe(123);
    expect(row.compileStatus).toBe("unknown");
  });
});

describe("POST /v1/generate validation & failure handling", () => {
  it("retries on guardrail-invalid output then succeeds", async () => {
    const { accessToken, userId } = await signInAndGetToken();
    // First output lacks the v6 marker; second is valid.
    llm.sequence = [
      {
        title: "x",
        summary: "y",
        code: "strategy('no marker')",
        assumptions: [],
        warnings: [],
      },
      {
        title: "Fixed",
        summary: "now valid",
        code: "//@version=6\nstrategy('ok')",
        assumptions: [],
        warnings: [],
      },
    ];

    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    expect(llm.calls).toBe(2);
    const rows = await prisma.generation.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outputTitle).toBe("Fixed");
  });

  it("returns 422 when output is schema-invalid after retries", async () => {
    const { accessToken } = await signInAndGetToken();
    llm.content = { not: "a valid generation" };

    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validBody,
    });

    expect(res.statusCode).toBe(422);
    expect(llm.calls).toBe(2); // initial + one retry (LLM_MAX_RETRIES=1)
  });

  it("maps provider failure to 502", async () => {
    const { accessToken } = await signInAndGetToken();
    llm.shouldThrow = true;

    const res = await app.inject({
      method: "POST",
      url: "/v1/generate",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validBody,
    });

    expect(res.statusCode).toBe(502);
    const body = res.json() as { error: { statusCode: number } };
    expect(body.error.statusCode).toBe(502);
  });
});
