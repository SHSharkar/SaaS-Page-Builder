
import { ensureDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";

async function main() {
  await ensureDb();
  await seedIfEmpty();
  console.log("Seed run complete (existing data is never overwritten).");
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
