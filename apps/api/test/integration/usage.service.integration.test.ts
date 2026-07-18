import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../src/db/client.js";
import type { PrismaClient } from "../../src/db/client.js";
import {
  GENERATE_METRIC,
  UsageService,
  computeMonthlyPeriod,
} from "../../src/generation/usage.service.js";
import { TooManyRequestsError } from "../../src/http-errors.js";
import { testConfig } from "../helpers.js";

const prisma: PrismaClient = createPrismaClient(testConfig.DATABASE_URL);

const planLimits = { free: 3, pro: 5, team: 10 };
// Fixed clock so period boundaries are deterministic.
const fixedNow = new Date("2026-06-15T12:00:00.000Z");

function makeService(): UsageService {
  return new UsageService({ prisma, planLimits, now: () => fixedNow });
}

async function createUser(
  plan: "free" | "pro" | "team",
  email = `q-${plan}-${Date.now()}-${Math.random()}@example.com`,
): Promise<string> {
  const user = await prisma.user.create({
    data: { email, authProvider: "google", plan },
  });
  return user.id;
}

async function usageCount(userId: string): Promise<number> {
  const { periodStart } = computeMonthlyPeriod(fixedNow);
  const row = await prisma.featureUsage.findUnique({
    where: {
      userId_metricType_periodStart: {
        userId,
        metricType: GENERATE_METRIC,
        periodStart,
      },
    },
  });
  return row?.count ?? 0;
}

beforeEach(async () => {
  await prisma.featureUsage.deleteMany();
  await prisma.generation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("computeMonthlyPeriod", () => {
  it("returns the UTC month boundaries", () => {
    const { periodStart, periodEnd } = computeMonthlyPeriod(
      new Date("2026-06-15T12:00:00.000Z"),
    );
    expect(periodStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("UsageService.reserve", () => {
  it("consumes credits and reports decreasing remaining", async () => {
    const service = makeService();
    const userId = await createUser("free");

    const first = await service.reserve(userId, "free");
    expect(first.limit).toBe(3);
    expect(first.used).toBe(1);
    expect(first.remaining).toBe(2);

    const second = await service.reserve(userId, "free");
    expect(second.used).toBe(2);
    expect(second.remaining).toBe(1);

    expect(await usageCount(userId)).toBe(2);
  });

  it("throws a structured 429 at the limit without over-counting", async () => {
    const service = makeService();
    const userId = await createUser("free");

    await service.reserve(userId, "free");
    await service.reserve(userId, "free");
    await service.reserve(userId, "free"); // now at limit (3)

    await expect(service.reserve(userId, "free")).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );

    // The rejected reservation must NOT have incremented past the limit.
    expect(await usageCount(userId)).toBe(3);

    const err = await service.reserve(userId, "free").catch((e) => e);
    expect((err as TooManyRequestsError).statusCode).toBe(429);
    expect((err as TooManyRequestsError).code).toBe("quota_exceeded");
    expect((err as TooManyRequestsError).headers).toMatchObject({
      "X-RateLimit-Limit": "3",
      "X-RateLimit-Remaining": "0",
    });
  });

  it("applies different limits for different plans", async () => {
    const service = makeService();
    const freeUser = await createUser("free");
    const proUser = await createUser("pro");

    for (let i = 0; i < 3; i += 1) await service.reserve(freeUser, "free");
    await expect(service.reserve(freeUser, "free")).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );

    // Pro allows more (limit 5) — the 4th succeeds where free failed.
    for (let i = 0; i < 5; i += 1) await service.reserve(proUser, "pro");
    await expect(service.reserve(proUser, "pro")).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );
    expect(await usageCount(proUser)).toBe(5);
  });
});

describe("UsageService.release", () => {
  it("returns a consumed credit and never drops below zero", async () => {
    const service = makeService();
    const userId = await createUser("free");

    await service.reserve(userId, "free");
    expect(await usageCount(userId)).toBe(1);

    await service.release(userId, "free");
    expect(await usageCount(userId)).toBe(0);

    // Releasing again is a no-op (guards against negative counts).
    await service.release(userId, "free");
    expect(await usageCount(userId)).toBe(0);
  });
});

describe("UsageService.peek", () => {
  it("reads usage without mutating it", async () => {
    const service = makeService();
    const userId = await createUser("free");
    await service.reserve(userId, "free");

    const snap = await service.peek(userId, "free");
    expect(snap).toMatchObject({ limit: 3, used: 1, remaining: 2 });
    expect(await usageCount(userId)).toBe(1);
  });
});
