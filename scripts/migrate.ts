import { closeDb, runMigrations } from "@/lib/db";
import { syncRbacCatalog } from "@/lib/auth/rbac";
import { syncComponentCatalog } from "@/lib/registry/sync";
import { seedPlatformSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

async function main() {
  await runMigrations();
  await syncRbacCatalog();
  await syncComponentCatalog();
  await seedPlatformSettings();
  logger.info("Database migrations and catalog sync completed");
  await closeDb();
}

main().catch((err) => {
  logger.fatal({ err }, "Database migration failed");
  process.exit(1);
});
