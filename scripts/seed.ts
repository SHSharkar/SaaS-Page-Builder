import { closeDb, runMigrations } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { logger } from "@/lib/logger";

async function main() {
  await runMigrations();
  await seedIfEmpty();
  logger.info({ demoPassword: DEMO_PASSWORD }, "Seed run completed without overwriting existing data");
  await closeDb();
}

main().catch((err) => {
  logger.fatal({ err }, "Seed run failed");
  process.exit(1);
});
