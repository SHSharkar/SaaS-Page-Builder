/**
 * Server startup: run migrations, seed an empty database, schedule the
 * recurring sweeps and start the in-process worker.
 *
 * In production the worker runs as its own always-on process (the
 * rewards-vault lesson: a queue with no runner looks healthy until a
 * scheduled job never fires). Here the preview is a single process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDb } = await import("@/lib/db");
  await ensureDb();

  const { scheduleRecurring, runDueJobs } = await import("@/lib/queue");
  await scheduleRecurring();

  const g = globalThis as unknown as { __trofeoWorker?: boolean };
  if (!g.__trofeoWorker) {
    g.__trofeoWorker = true;
    const timer = setInterval(() => {
      void runDueJobs().catch((error) => console.error("[queue]", error));
    }, 5_000);
    if (typeof timer.unref === "function") timer.unref();
  }
}
