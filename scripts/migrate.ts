
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
