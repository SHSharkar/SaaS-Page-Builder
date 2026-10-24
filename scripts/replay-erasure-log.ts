import { closeDbPool } from "../app/server/db/client";
import { purgeErasedContacts } from "../app/server/privacy";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

export async function replayErasureLog(): Promise<number> {
  const result = await purgeErasedContacts();
  return result.removed;
}

if (isMainModule(import.meta.url)) {
  void replayErasureLog()
    .then(async (count) => {
      await closeDbPool();
      log.success(
        `Replayed erasure log (${count} restored contact rows purged)`,
      );
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      log.failed(
        err instanceof Error ? err.message : "Replay erasure log failed",
      );
      process.exit(1);
    });
}
