/**
 * Applies the shipped migrations, then seeds a fresh database.
 * In production this is the `db:migrate` step of a release; the app itself
 * also calls it on first boot so a clean checkout works immediately.
 */
import { ensureDb } from "@/lib/db";

async function main() {
  await ensureDb();
  console.log("Migrations applied and seed checked.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
