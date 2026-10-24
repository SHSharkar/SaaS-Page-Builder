import "server-only";
import { sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { listSites } from "@/lib/sites";
import { listAudit, type AuditRow } from "@/lib/audit";

export type Overview = {
  sites: number;
  pages: number;
  published: number;
  drafts: number;
  versions: number;
  media: number;
  domains: number;
  pendingDomains: number;
  importsInReview: number;
  staff: number;
  pendingInvites: number;
};

export async function platformOverview(): Promise<Overview> {
  await ensureDb();
  const result = await db.execute<Overview>(sql`
    select
      (select count(*)::int from site where deleted_at is null and status <> 'deleted') as sites,
      (select count(*)::int from page where deleted_at is null) as pages,
      (select count(*)::int from page where status = 'published' and deleted_at is null) as published,
      (select count(*)::int from page where status = 'draft' and deleted_at is null) as drafts,
      (select count(*)::int from page_version) as versions,
      (select count(*)::int from media_asset where status = 'ready') as media,
      (select count(*)::int from domain where removed_at is null) as domains,
      (select count(*)::int from domain where removed_at is null and status in ('pending','verifying')) as "pendingDomains",
      (select count(*)::int from import_job where status in ('review','in_review')) as "importsInReview",
      (select count(*)::int from "user" where banned = false) as staff,
      (select count(*)::int from staff_invite where status = 'pending') as "pendingInvites"
  `);
  return (
    result.rows[0] ?? {
      sites: 0,
      pages: 0,
      published: 0,
      drafts: 0,
      versions: 0,
      media: 0,
      domains: 0,
      pendingDomains: 0,
      importsInReview: 0,
      staff: 0,
      pendingInvites: 0,
    }
  );
}

export async function loadOverview(): Promise<{
  activeSiteCount: number;
  siteCount: number;
  publishedCount: number;
  pageCount: number;
  verifiedDomains: number;
  pendingDomains: number;
  templateCount: number;
  mediaCount: number;
  sites: Awaited<ReturnType<typeof listSites>>;
  recentAudit: AuditRow[];
}> {
  await ensureDb();
  const [countsRow, siteEntries, recentAudit] = await Promise.all([
    db.execute<{
      activeSiteCount: number;
      siteCount: number;
      publishedCount: number;
      pageCount: number;
      verifiedDomains: number;
      pendingDomains: number;
      templateCount: number;
      mediaCount: number;
    }>(sql`
      select
        (select count(*)::int from site where status = 'active' and deleted_at is null) as "activeSiteCount",
        (select count(*)::int from site where deleted_at is null and status <> 'deleted') as "siteCount",
        (select count(*)::int from page where status = 'published' and deleted_at is null) as "publishedCount",
        (select count(*)::int from page where deleted_at is null) as "pageCount",
        (select count(*)::int from domain where status = 'active' and removed_at is null) as "verifiedDomains",
        (select count(*)::int from domain where status in ('pending','verifying') and removed_at is null) as "pendingDomains",
        (select count(*)::int from template where status = 'active') as "templateCount",
        (select count(*)::int from media_asset where status = 'ready') as "mediaCount"
    `),
    listSites(),
    listAudit({ limit: 8 }),
  ]);

  const counts = countsRow.rows[0] ?? {
    activeSiteCount: 0,
    siteCount: 0,
    publishedCount: 0,
    pageCount: 0,
    verifiedDomains: 0,
    pendingDomains: 0,
    templateCount: 0,
    mediaCount: 0,
  };

  return {
    ...counts,
    sites: siteEntries,
    recentAudit,
  };
}
