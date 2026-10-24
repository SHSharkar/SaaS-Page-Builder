import os from "node:os";
import { workerHeartbeats } from "../app/server/db/schema";
import { withPlatform } from "../app/server/db/with-account";
import {
  createConfiguredPgBoss,
  ensureScheduledJobs,
} from "../app/server/jobs";
import { JOB_HANDLERS, missingJobHandlers } from "../app/server/jobs/handlers";
import { logger } from "../app/server/logger";
import { JOB_KINDS } from "../lib/enums";
import { isMainModule } from "./lib/check";

export async function recordHeartbeat(
  workerId: string,
  claimingWork = true,
): Promise<void> {
  await withPlatform((tx) =>
    tx
      .insert(workerHeartbeats)
      .values({ workerId, claimingWork, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: workerHeartbeats.workerId,
        set: { claimingWork, updatedAt: new Date() },
      }),
  );
}

export async function startWorkerRuntime(): Promise<() => Promise<void>> {
  const workerId = `${os.hostname()}-${process.pid}`;
  const unhandled = missingJobHandlers();
  if (unhandled.length > 0) {
    throw new Error(`No job handler registered for: ${unhandled.join(", ")}`);
  }

  const boss = await createConfiguredPgBoss();

  for (const kind of JOB_KINDS) {
    const handler = JOB_HANDLERS[kind];
    await boss.work(kind, async () => {
      const outcome = await handler(new Date());
      logger.info(
        {
          kind: outcome.kind,
          handled: outcome.handled,
          detail: outcome.detail,
          workerId,
        },
        "worker.job_completed",
      );
    });
  }

  await ensureScheduledJobs(boss);
  await recordHeartbeat(workerId, true);
  const timer = setInterval(() => {
    void recordHeartbeat(workerId, true);
  }, 15_000);

  return async () => {
    clearInterval(timer);
    await recordHeartbeat(workerId, false);
    await boss.stop({ graceful: true, timeout: 10_000 });
  };
}

if (isMainModule(import.meta.url)) {
  void startWorkerRuntime().then((stop) => {
    const shutdown = () => {
      void stop().finally(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}
