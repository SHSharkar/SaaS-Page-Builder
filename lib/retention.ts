/**
 * The single sweeper for every keep window in PRD 3.6.
 *
 * It is repeat-safe by construction: each step filters on the timestamp window
 * and on a status that the step itself moves, so running it twice changes
 * nothing the second time. The daily job calls it; the settings screen can run
 * one pass by hand.
 */
import { and, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { auditLog, domains, importJobs, mediaAssets, pages, sessions, sites, staffInvites } from "@/lib/db/schema";
import { KEEP, daysAgo, monthsAgo } from "@/lib/lifecycle";
import { sweepPendingMedia } from "@/lib/media";
import { deleteObject } from "@/lib/media/storage";
import { pruneVersions } from "@/lib/pages";
import { cacheClear } from "@/lib/cache";
import { recordAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";

export type CleanupResult = {
  sessionsRemoved: number;
  invitesExpired: number;
  versionsPruned: number;
  importJobsRemoved: number;
  importFilesRemoved: number;
  pendingMediaRemoved: number;
  auditRowsRemoved: number;
  sitesPurged: number;
  domainsForgotten: number;
  ranAt: string;
};

export async function runDailyCleanup(actor: Actor | null): Promise<CleanupResult> {
  await ensureDb();
  const now = new Date();

  // Sessions: expired rows carry no value and are personal data.
  const expiredSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });

  // Invitations: the daily sweep is the backstop for read-time expiry.
  const expiredInvites = await db
    .update(staffInvites)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(staffInvites.status, "pending"), lte(staffInvites.expiresAt, now)))
    .returning({ id: staffInvites.id });

  // Snapshots: fifty per page, newest first.
  const pageRows = await db.select({ id: pages.id }).from(pages);
  let versionsPruned = 0;
  for (const row of pageRows) versionsPruned += await pruneVersions(row.id, KEEP.versionsPerPage);

  // Import jobs: ninety days. The page they produced is untouched.
  const oldJobs = await db
    .delete(importJobs)
    .where(
      and(
        lt(importJobs.createdAt, daysAgo(KEEP.importJobDays, now.getTime())),
        sql`${importJobs.status} <> 'in_review'`,
      ),
    )
    .returning({ id: importJobs.id, fileMediaId: importJobs.fileMediaId });

  // Import files: a year, and only once nothing references them.
  const oldImportFiles = await db
    .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.kind, "import_reference"),
        eq(mediaAssets.status, "ready"),
        lt(mediaAssets.createdAt, monthsAgo(KEEP.importFileMonths, now.getTime())),
      ),
    );
  let importFilesRemoved = 0;
  for (const file of oldImportFiles) {
    const stillUsed = await db
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(eq(importJobs.fileMediaId, file.id))
      .limit(1);
    if (stillUsed.length) continue;
    await deleteObject(file.storageKey);
    await db
      .update(mediaAssets)
      .set({ status: "deleted", deletedAt: now, updatedAt: now })
      .where(eq(mediaAssets.id, file.id));
    importFilesRemoved += 1;
  }

  // Pending uploads that never confirmed.
  const pendingMediaRemoved = await sweepPendingMedia();

  // Audit: two years. Everything newer stays append-only.
  const removedAudit = await db
    .delete(auditLog)
    .where(lt(auditLog.createdAt, monthsAgo(KEEP.auditMonths, now.getTime())))
    .returning({ id: auditLog.id });

  // Deleted sites past the restore window: hard delete, which cascades pages,
  // snapshots, content, media rows, imports and domains.
  const purgeable = await db
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(
      and(
        eq(sites.status, "deleted"),
        isNotNull(sites.deletedAt),
        lt(sites.deletedAt, daysAgo(KEEP.siteRestoreDays, now.getTime())),
      ),
    );
  for (const site of purgeable) {
    await db.delete(sites).where(eq(sites.id, site.id));
  }
  if (purgeable.length) cacheClear();

  // Removed hostnames are forgotten after a quarter, which frees the name.
  const forgotten = await db
    .delete(domains)
    .where(
      and(
        isNotNull(domains.removedAt),
        lt(domains.removedAt, daysAgo(KEEP.removedDomainDays, now.getTime())),
      ),
    )
    .returning({ id: domains.id });

  const result: CleanupResult = {
    sessionsRemoved: expiredSessions.length,
    invitesExpired: expiredInvites.length,
    versionsPruned,
    importJobsRemoved: oldJobs.length,
    importFilesRemoved,
    pendingMediaRemoved,
    auditRowsRemoved: removedAudit.length,
    sitesPurged: purgeable.length,
    domainsForgotten: forgotten.length,
    ranAt: now.toISOString(),
  };

  const total =
    result.sessionsRemoved +
    result.invitesExpired +
    result.versionsPruned +
    result.importJobsRemoved +
    result.importFilesRemoved +
    result.pendingMediaRemoved +
    result.auditRowsRemoved +
    result.sitesPurged +
    result.domainsForgotten;

  await recordAudit({
    action: "cleanup_ran",
    summary:
      total === 0
        ? "Daily cleanup found nothing to sweep"
        : `Daily cleanup: ${result.versionsPruned} snapshots, ${result.sessionsRemoved} sessions, ${result.invitesExpired} invites, ${result.importJobsRemoved + result.importFilesRemoved + result.pendingMediaRemoved} files, ${result.auditRowsRemoved} audit rows, ${result.sitesPurged} sites`,
    actor,
    targetType: "job",
    detail: { ...result },
  });

  return result;
}

/** Everything the sweeper would look at, counted without changing anything. */
export async function cleanupPreview() {
  await ensureDb();
  const now = Date.now();
  const [sessionRows, inviteRows, jobRows, pendingRows, siteRows] = await Promise.all([
    db.select({ id: sessions.id }).from(sessions).where(lt(sessions.expiresAt, new Date(now))),
    db
      .select({ id: staffInvites.id })
      .from(staffInvites)
      .where(and(eq(staffInvites.status, "pending"), lte(staffInvites.expiresAt, new Date(now)))),
    db
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(lt(importJobs.createdAt, daysAgo(KEEP.importJobDays, now))),
    db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.status, "pending"), lt(mediaAssets.createdAt, daysAgo(1, now)))),
    db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.status, "deleted"), lt(sites.deletedAt, daysAgo(KEEP.siteRestoreDays, now)))),
  ]);
  return {
    sessions: sessionRows.length,
    invites: inviteRows.length,
    importJobs: jobRows.length,
    pendingMedia: pendingRows.length,
    purgeableSites: siteRows.length,
  };
}

export async function purgeSites(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  await ensureDb();
  await db.delete(sites).where(inArray(sites.id, ids));
  cacheClear();
  return ids.length;
}
