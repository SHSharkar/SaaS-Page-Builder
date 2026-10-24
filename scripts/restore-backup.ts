import { closeDbPool } from "../app/server/db/client";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { replayErasureLog } from "./replay-erasure-log";

if (isMainModule(import.meta.url)) {
  void replayErasureLog()
    .then(async (purged) => {
      await closeDbPool();
      log.success(
        `Post-restore erasure log replay complete (${purged} contact rows scrubbed)`,
      );
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      log.failed(err instanceof Error ? err.message : "Restore hook failed");
      process.exit(1);
    });
}
