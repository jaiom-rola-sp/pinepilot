import type { PrismaClient } from "@prisma/client";
import { TooManyRequestsError } from "../http-errors.js";

/** Metric key for generate requests in the FeatureUsage table. */
export const GENERATE_METRIC = "generate";

export type PlanName = "free" | "pro" | "team";
export type PlanLimits = Record<PlanName, number>;

/** A point-in-time view of a user's quota for the current period. */
export interface QuotaSnapshot {
  limit: number;
  used: number;
  remaining: number;
  /** When the current window ends and usage resets. */
  resetAt: Date;
}

export interface UsageServiceDeps {
  prisma: PrismaClient;
  planLimits: PlanLimits;
  /** Injectable clock for deterministic period tests. */
  now?: () => Date;
}

/**
 * Start (inclusive) and end (exclusive) of the calendar month containing
 * `now`, in UTC. Usage resets at the first instant of each UTC month.
 */
export function computeMonthlyPeriod(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { periodStart, periodEnd };
}

/**
 * Account-level usage metering and quota enforcement for generate requests.
 * Isolated behind this service boundary so callers never touch the usage table
 * directly. Limits come from a simple plan → number map (config-driven for now).
 */
export class UsageService {
  private readonly prisma: PrismaClient;
  private readonly planLimits: PlanLimits;
  private readonly now: () => Date;

  constructor(deps: UsageServiceDeps) {
    this.prisma = deps.prisma;
    this.planLimits = deps.planLimits;
    this.now = deps.now ?? (() => new Date());
  }

  limitForPlan(plan: string): number {
    return this.planLimits[plan as PlanName] ?? this.planLimits.free;
  }

  /** Read current usage without mutating it. */
  async peek(userId: string, plan: string): Promise<QuotaSnapshot> {
    const limit = this.limitForPlan(plan);
    const { periodStart, periodEnd } = computeMonthlyPeriod(this.now());
    const row = await this.prisma.featureUsage.findUnique({
      where: {
        userId_metricType_periodStart: {
          userId,
          metricType: GENERATE_METRIC,
          periodStart,
        },
      },
    });
    const used = row?.count ?? 0;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetAt: periodEnd,
    };
  }

  /**
   * Atomically consume one generate credit, enforcing the plan limit. The
   * increment and the limit check happen in a single transaction: if consuming
   * would exceed the limit, the increment is rolled back and a 429 is thrown
   * BEFORE any provider work runs. Returns the post-consumption snapshot.
   *
   * @throws {TooManyRequestsError} when the quota is already exhausted.
   */
  async reserve(userId: string, plan: string): Promise<QuotaSnapshot> {
    const limit = this.limitForPlan(plan);
    const { periodStart, periodEnd } = computeMonthlyPeriod(this.now());

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.featureUsage.upsert({
        where: {
          userId_metricType_periodStart: {
            userId,
            metricType: GENERATE_METRIC,
            periodStart,
          },
        },
        create: {
          userId,
          metricType: GENERATE_METRIC,
          count: 1,
          periodStart,
          periodEnd,
        },
        update: { count: { increment: 1 } },
      });

      if (row.count > limit) {
        // Roll back the increment (throwing aborts the transaction) and signal
        // quota exhaustion with standard rate-limit headers.
        throw new TooManyRequestsError(
          "Monthly generation limit reached for your plan.",
          {
            code: "quota_exceeded",
            headers: buildRateLimitHeaders(limit, 0, periodEnd),
          },
        );
      }

      return {
        limit,
        used: row.count,
        remaining: Math.max(0, limit - row.count),
        resetAt: periodEnd,
      };
    });
  }

  /**
   * Return a previously-reserved credit (e.g. when generation fails after the
   * reservation), so failed requests do not consume quota. Never drops below 0.
   */
  async release(userId: string, _plan: string): Promise<void> {
    const { periodStart } = computeMonthlyPeriod(this.now());
    await this.prisma.featureUsage.updateMany({
      where: {
        userId,
        metricType: GENERATE_METRIC,
        periodStart,
        count: { gt: 0 },
      },
      data: { count: { decrement: 1 } },
    });
  }
}

/** Build standard `X-RateLimit-*` headers (values are strings for HTTP). */
export function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: Date,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.floor(resetAt.getTime() / 1000)),
  };
}
