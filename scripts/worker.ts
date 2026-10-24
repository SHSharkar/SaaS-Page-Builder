import { logger } from "@/lib/logger";
import { startWorkerProcess } from "@/lib/queue";
import { closeDb } from "@/lib/db";

async function main() {
  const boss = await startWorkerProcess();
  logger.info("Background worker started and listening on all queues");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down background worker gracefully");
    await boss.stop({ graceful: true, timeout: 30_000 });
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Worker startup failed");
  process.exit(1);
});
