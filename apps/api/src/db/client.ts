import { PrismaClient } from "@prisma/client";

/**
 * Create a PrismaClient. Kept as a factory (rather than a module-level
 * singleton) so tests can construct isolated clients pointed at a test database.
 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
}

export type { PrismaClient } from "@prisma/client";
