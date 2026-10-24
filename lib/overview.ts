import { sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";

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

      (select count(*)::int from import_job where status in ('in_review','mapped')) as "importsInReview",

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
