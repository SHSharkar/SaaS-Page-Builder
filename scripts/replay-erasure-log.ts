import { eq } from "drizzle-orm";
import { closeDbPool } from "../app/server/db/client";
import { erasureLogs, guestContacts } from "../app/server/db/schema";
import { withPlatform } from "../app/server/db/with-account";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

export async function replayErasureLog(): Promise<number> {
  return withPlatform(async (tx) => {
    const entries = await tx.select().from(erasureLogs);
    let removed = 0;
    for (const entry of entries) {
      const deleted = await tx
        .delete(guestContacts)
        .where(eq(guestContacts.lookupHash, entry.subjectLookupHash))
        .returning({ id: guestContacts.id });
      removed += deleted.length;
    }
    return removed;
  });
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
