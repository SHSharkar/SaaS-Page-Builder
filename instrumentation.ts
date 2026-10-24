
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
