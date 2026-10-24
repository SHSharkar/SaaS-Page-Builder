import { and, eq, lte, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { jobs, users, staffInvites, pages, siteContents } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import { publishPage, unpublishPage, pruneVersions } from "@/lib/pages";
import { verifyDomain } from "@/lib/domains";
import { cacheClear } from "@/lib/cache";

export const JOB_KINDS = [
  "page.publish.scheduled",
  "page.unpublish.scheduled",
  "invite.sweep",
  "version.prune",
  "media.orphan-sweep",
  "domain.verify",
  "session.sweep",
  "sitemap.refresh",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown> = {},
  options: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
): Promise<void> {
  await ensureDb();
  await db
    .insert(jobs)
    .values({
      kind,
      payload,
      runAt: options.runAt ?? new Date(),
      dedupeKey: options.dedupeKey ?? null,
      maxAttempts: options.maxAttempts ?? 5,
    })
    .onConflictDoNothing();
}

/** Jobs act as the last active admin, recorded as such in the audit trail. */
export async function getSystemActor(): Promise<Actor | null> {
  await ensureDb();
  const [admin] = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")))
    .limit(1);
  return admin ? { user: admin, sessionId: "system", stepUpValid: true } : null;
}

async function handle(jobKind: string, payload: Record<string, unknown>): Promise<void> {
  const actor = await getSystemActor();
  switch (jobKind) {
    case "page.publish.scheduled": {
      if (!actor) throw new Error("No active admin to act as.");
      await publishPage(String(payload.siteId), String(payload.pageId), actor, "manual");
      await db
        .update(pages)
        .set({ scheduledPublishAt: null })
        .where(eq(pages.id, String(payload.pageId)));
      break;
    }
    case "page.unpublish.scheduled": {
      if (!actor) throw new Error("No active admin to act as.");
      await unpublishPage(String(payload.siteId), String(payload.pageId), actor);
      await db
        .update(pages)
        .set({ scheduledUnpublishAt: null })
        .where(eq(pages.id, String(payload.pageId)));
      break;
    }
    case "invite.sweep": {
      await db
        .update(staffInvites)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(staffInvites.status, "pending"), lte(staffInvites.expiresAt, new Date())));
      break;
    }
    case "version.prune": {
      const pageId = payload.pageId ? String(payload.pageId) : null;
      const rows = pageId
        ? await db.select({ id: pages.id }).from(pages).where(eq(pages.id, pageId))
        : await db.select({ id: pages.id }).from(pages);
      for (const row of rows) await pruneVersions(row.id);
      break;
    }
    case "media.orphan-sweep": {
      // Marked rows whose files never landed; the media module owns the detail.
      break;
    }
    case "domain.verify": {
      await verifyDomain(String(payload.domainId), actor);
      break;
    }
    case "session.sweep": {
      const { sweepSessions } = await import("@/lib/auth/session");
      await sweepSessions();
      break;
    }
    case "sitemap.refresh": {
      cacheClear();
      break;
    }
    default:
      throw new Error(`Unknown job kind: ${jobKind}`);
  }
}

/** At-least-once delivery: every handler must converge when repeated. */
export async function runDueJobs(limit = 10): Promise<{ processed: number; failed: number }> {
  await ensureDb();
  const due = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, new Date())))
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const job of due) {
    await db.update(jobs).set({ status: "running", updatedAt: new Date() }).where(eq(jobs.id, job.id));
    try {
      await handle(job.kind, job.payload);
      processed += 1;
      await db
        .update(jobs)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date(), lastError: null })
        .where(eq(jobs.id, job.id));
    } catch (error) {
      failed += 1;
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      if (attempts >= job.maxAttempts) {
        await db
          .update(jobs)
          .set({ status: "dead", attempts, lastError: message, updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
      } else {
        const backoffMs = Math.min(5 * 60_000, 2 ** attempts * 1000) + Math.random() * 500;
        await db
          .update(jobs)
          .set({
            status: "queued",
            attempts,
            lastError: message,
            runAt: new Date(Date.now() + backoffMs),
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id));
      }
    }
  }

  return { processed, failed };
}

/**
 * Schedules the recurring sweeps. A missed run is skipped rather than
 * replayed: the next run covers the work (PRD 3.3).
 */
export async function scheduleRecurring(): Promise<void> {
  await ensureDb();
  const now = Date.now();
  await enqueue("invite.sweep", {}, { dedupeKey: "invite.sweep:daily", runAt: new Date(now + 60_000) });
  await enqueue("session.sweep", {}, { dedupeKey: "session.sweep:daily", runAt: new Date(now + 120_000) });
  await enqueue("version.prune", {}, { dedupeKey: "version.prune:daily", runAt: new Date(now + 180_000) });
  await enqueue("media.orphan-sweep", {}, { dedupeKey: "media.sweep:weekly", runAt: new Date(now + 240_000) });
}

export async function listRecentJobs(limit = 20) {
  await ensureDb();
  return db.select().from(jobs).orderBy(sql`${jobs.createdAt} desc`).limit(limit);
}
