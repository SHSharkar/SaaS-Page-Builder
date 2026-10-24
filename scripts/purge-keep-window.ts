import { closeDbPool } from "../app/server/db/client";
import { purgeExpiredKeepWindows } from "../app/server/sweeper";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

if (isMainModule(import.meta.url)) {
  void purgeExpiredKeepWindows()
    .then(async (res) => {
      await closeDbPool();
      log.success(
        `Purged expired keep-windows (sites=${res.purgedSites}, pages=${res.purgedPages})`,
      );
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      log.failed(err instanceof Error ? err.message : "Purge failed");
      process.exit(1);
    });
}
