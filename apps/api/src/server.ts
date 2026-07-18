import { buildApp, buildDefaultDeps } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrismaClient } from "./db/client.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);
  const deps = buildDefaultDeps(config, prisma);
  const app = await buildApp(config, deps);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await prisma.$connect();
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (err) {
    app.log.error(err, "failed to start server");
    await prisma.$disconnect();
    process.exit(1);
  }
}

void main();
