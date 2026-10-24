import "server-only";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  auditEntries,
  domains,
  importJobs,
  mediaAssets,
  pages,
  sessions,
  sites,
  staffInvites,
  verifications,
} from "@/lib/db/schema";
import { KEEP, daysAgo, hoursAgo, monthsAgo } from "@/lib/lifecycle";
import { pruneVersions } from "@/lib/pages";
import { purgeSite } from "@/lib/sites";
import { deleteObject } from "@/lib/media/storage";
import { recordAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";

export interface CleanupReport {
  ranAt: string;
  sessionsRemoved: number;
  verificationsRemoved: number;
  invitesExpired: number;
  invitesRemoved: number;
  versionsPruned: number;
  importJobsRemoved: number;
  importFilesRemoved: number;
  pendingMediaRemoved: number;
  sitesPurged: number;
  domainsForgotten: number;
  auditRemoved: number;
}

export async function sweepOrphanMedia(now = new Date()): Promise<{ pendingRemoved: number; deletedBlobsCleared: number }> {
  await ensureDb();
  const pendingCutoff = hoursAgo(KEEP.pendingMediaHours, now.getTime());
  const stalePending = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.status, "pending"), lt(mediaAssets.createdAt, pendingCutoff)));

  let pendingRemoved = 0;
  for (const row of stalePending) {
    await deleteObject(row.storageKey);
    const removed = await db
      .delete(mediaAssets)
      .where(and(eq(mediaAssets.id, row.id), eq(mediaAssets.status, "pending")))
      .returning({ id: mediaAssets.id });
    pendingRemoved += removed.length;
  }

  const deletedRows = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.status, "deleted"), lt(mediaAssets.createdAt, pendingCutoff)));

  let deletedBlobsCleared = 0;
  for (const row of deletedRows) {
    await deleteObject(row.storageKey);
    const purged = await db
      .delete(mediaAssets)
      .where(and(eq(mediaAssets.id, row.id), eq(mediaAssets.status, "deleted")))
      .returning({ id: mediaAssets.id });
    deletedBlobsCleared += purged.length;
  }

  return { pendingRemoved, deletedBlobsCleared };
}

export async function runDailyCleanup(actor: Actor | null = null): Promise<CleanupReport> {
  await ensureDb();
  const now = new Date();

  const expiredSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });

  const expiredVerifications = await db
    .delete(verifications)
    .where(lt(verifications.expiresAt, now))
    .returning({ id: verifications.id });

  const newlyExpired = await db
    .update(staffInvites)
    .set({ status: "expired" })
    .where(and(eq(staffInvites.status, "pending"), lt(staffInvites.expiresAt, now)))
    .returning({ id: staffInvites.id });

  const inviteCutoff = daysAgo(KEEP.inviteHistoryDays, now.getTime());
  const oldInvites = await db
    .delete(staffInvites)
    .where(
      and(
        inArray(staffInvites.status, ["revoked", "expired"]),
        lt(staffInvites.createdAt, inviteCutoff),
      ),
    )
    .returning({ id: staffInvites.id });

  const pageRows = await db
    .select({
      id: pages.id,
      siteId: pages.siteId,
      publishedVersionId: pages.publishedVersionId,
    })
    .from(pages)
    .where(isNull(pages.deletedAt));
  let versionsPruned = 0;
  for (const row of pageRows) {
    versionsPruned += await pruneVersions(
      row.siteId,
      row.id,
      row.publishedVersionId,
      KEEP.versionsPerPage,
    );
  }

  const importCutoff = daysAgo(KEEP.importJobDays, now.getTime());
  const finishedImports = await db
    .select({ id: importJobs.id, sourceMediaId: importJobs.sourceMediaId })
    .from(importJobs)
    .where(
      and(
        inArray(importJobs.status, ["applied", "failed", "discarded"]),
        lt(importJobs.updatedAt, importCutoff),
      ),
    );

  let importJobsRemoved = 0;
  if (finishedImports.length) {
    const removed = await db
      .delete(importJobs)
      .where(
        inArray(
          importJobs.id,
          finishedImports.map((row) => row.id),
        ),
      )
      .returning({ id: importJobs.id });
    importJobsRemoved = removed.length;
  }

  const importFileCutoff = monthsAgo(KEEP.importFileMonths, now.getTime());
  const staleHtml = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.mimeType, "text/html"), lt(mediaAssets.createdAt, importFileCutoff)));
  let importFilesRemoved = 0;
  for (const asset of staleHtml) {
    const stillUsed = await db
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(eq(importJobs.sourceMediaId, asset.id))
      .limit(1);
    if (stillUsed.length) continue;
    await deleteObject(asset.storageKey);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
    importFilesRemoved += 1;
  }

  const { pendingRemoved: pendingMediaRemoved } = await sweepOrphanMedia(now);

  const siteCutoff = daysAgo(KEEP.siteRestoreDays, now.getTime());
  const doomedSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.status, "deleted"), lt(sites.deletedAt, siteCutoff)));
  let sitesPurged = 0;
  for (const row of doomedSites) {
    await purgeSite(row.id, actor);
    sitesPurged += 1;
  }

  const domainCutoff = daysAgo(KEEP.removedDomainDays, now.getTime());
  const forgottenDomains = await db
    .delete(domains)
    .where(and(eq(domains.status, "removed"), lt(domains.removedAt, domainCutoff)))
    .returning({ id: domains.id });

  const auditCutoff = monthsAgo(KEEP.auditMonths, now.getTime());
  const trimmedAudit = await db
    .delete(auditEntries)
    .where(lt(auditEntries.createdAt, auditCutoff))
    .returning({ id: auditEntries.id });

  const report: CleanupReport = {
    ranAt: now.toISOString(),
    sessionsRemoved: expiredSessions.length,
    verificationsRemoved: expiredVerifications.length,
    invitesExpired: newlyExpired.length,
    invitesRemoved: oldInvites.length,
    versionsPruned,
    importJobsRemoved,
    importFilesRemoved,
    pendingMediaRemoved,
    sitesPurged,
    domainsForgotten: forgottenDomains.length,
    auditRemoved: trimmedAudit.length,
  };

  const changed =
    report.sessionsRemoved +
    report.verificationsRemoved +
    report.invitesExpired +
    report.invitesRemoved +
    report.versionsPruned +
    report.importJobsRemoved +
    report.importFilesRemoved +
    report.pendingMediaRemoved +
    report.sitesPurged +
    report.domainsForgotten +
    report.auditRemoved;

  if (actor || changed > 0) {
    await recordAudit({
      actor,
      action: "daily_cleanup_ran",
      targetType: "platform",
      summary: actor
        ? `Ran the sweeper (${changed} stale rows cleared)`
        : `Daily sweeper cleared ${changed} stale rows`,
      metadata: { ...report },
    });
  }

  return report;
}

export async function cleanupPreview(): Promise<{
  sessions: number;
  expiredSessions: number;
  invites: number;
  expiredInvites: number;
  importJobs: number;
  pendingMedia: number;
  purgeableSites: number;
  purgeablePages: number;
}> {
  await ensureDb();
  const now = new Date();
  const [expiredSessions, staleInvites, oldImports, stalePending, doomedSites, doomedPages] =
    await Promise.all([
      db.select({ id: sessions.id }).from(sessions).where(lt(sessions.expiresAt, now)),
      db
        .select({ id: staffInvites.id })
        .from(staffInvites)
        .where(and(eq(staffInvites.status, "pending"), lt(staffInvites.expiresAt, now))),
      db
        .select({ id: importJobs.id })
        .from(importJobs)
        .where(
          and(
            inArray(importJobs.status, ["applied", "failed", "discarded"]),
            lt(importJobs.updatedAt, daysAgo(KEEP.importJobDays, now.getTime())),
          ),
        ),
      db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.status, "pending"),
            lt(mediaAssets.createdAt, hoursAgo(KEEP.pendingMediaHours, now.getTime())),
          ),
        ),
      db
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(
            eq(sites.status, "deleted"),
            lt(sites.deletedAt, daysAgo(KEEP.siteRestoreDays, now.getTime())),
          ),
        ),
      db
        .select({ id: pages.id })
        .from(pages)
        .where(
          and(
            eq(pages.status, "deleted"),
            lt(pages.deletedAt, daysAgo(KEEP.pageTrashDays, now.getTime())),
          ),
        ),
    ]);
  return {
    sessions: expiredSessions.length,
    expiredSessions: expiredSessions.length,
    invites: staleInvites.length,
    expiredInvites: staleInvites.length,
    importJobs: oldImports.length,
    pendingMedia: stalePending.length,
    purgeableSites: doomedSites.length,
    purgeablePages: doomedPages.length,
  };
}

export const runDailySweep = runDailyCleanup;
export const previewDailySweep = cleanupPreview;
export const runOrphanMediaSweep = sweepOrphanMedia;
export type SweepSummary = CleanupReport;

