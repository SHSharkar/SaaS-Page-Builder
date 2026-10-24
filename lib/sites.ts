import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, pages, sites, siteContents, type Domain, type Site } from "@/lib/db/schema";
import { DEFAULT_THEME, normalizeHostname, slugify, type SiteTheme } from "@/lib/documents";
import { cacheGet, cacheKeys, cacheClear, cacheSet } from "@/lib/cache";
import { assertTransition, KEEP, daysFromNow } from "@/lib/lifecycle";

export const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "pages.trofeo.test";

export function platformHost(slug: string): string {
  return `${slug}.${PLATFORM_DOMAIN}`;
}

export async function listSites() {
  await ensureDb();
  return db
    .select({
      site: sites,
      pageCount: sql<number>`(select count(*)::int from page p where p.site_id = ${sites.id} and p.deleted_at is null)`,
      publishedCount: sql<number>`(select count(*)::int from page p where p.site_id = ${sites.id} and p.status = 'published' and p.deleted_at is null)`,
      domainCount: sql<number>`(select count(*)::int from domain d where d.site_id = ${sites.id} and d.removed_at is null)`,
    })
    .from(sites)
    .where(and(isNull(sites.deletedAt), sql`${sites.status} <> 'deleted'`))
    .orderBy(asc(sites.name));
}

export async function getSite(siteId: string): Promise<Site | null> {
  await ensureDb();
  const [site] = await db.select().from(sites).where(and(eq(sites.id, siteId), isNull(sites.deletedAt))).limit(1);
  return site ?? null;
}

export async function getSiteBySlug(slug: string): Promise<Site | null> {
  await ensureDb();
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.slug, slug), isNull(sites.deletedAt)))
    .limit(1);
  return site ?? null;
}

export async function getPrimarySite(): Promise<Site | null> {
  await ensureDb();
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.status, "active"), isNull(sites.deletedAt)))
    .orderBy(asc(sites.createdAt))
    .limit(1);
  return site ?? null;
}

export type HostResolution = {
  site: Site;
  domain: Domain | null;
  /** false when the site is suspended or the domain is not serving yet */
  canServe: boolean;
  reason?: string;
};

/**
 * Hostname resolution against the domain table (PRD M10). The cache holds
 * `dom:{hostname}`; binding, removing or verifying a domain clears it.
 *
 * In this single-host preview environment an unknown host falls back to the
 * first active site, so the reviewer can open the published page directly.
 * Production sets ALLOW_HOST_FALLBACK=false.
 */
export async function resolveHost(rawHost: string): Promise<HostResolution | null> {
  await ensureDb();
  const hostname = normalizeHostname(rawHost);
  if (!hostname) return null;

  const cached = cacheGet<{ siteId: string; canServe: boolean; reason?: string }>(cacheKeys.domain(hostname));
  let resolved: { siteId: string; canServe: boolean; reason?: string } | null = cached ?? null;
  let domain: Domain | null = null;

  if (!resolved) {
    const [row] = await db
      .select({ domain: domains, site: sites })
      .from(domains)
      .innerJoin(sites, eq(sites.id, domains.siteId))
      .where(and(eq(domains.hostname, hostname), isNull(domains.removedAt)))
      .limit(1);

    if (row) {
      domain = row.domain;
      const canServe = row.domain.status === "active" && row.site.status === "active" && !row.site.deletedAt;
      resolved = {
        siteId: row.site.id,
        canServe,
        reason: canServe ? undefined : row.domain.status !== "active" ? "Domain verification is not complete." : "This site is not serving.",
      };
      cacheSet(cacheKeys.domain(hostname), resolved, 60_000);
    } else if (hostname.startsWith("www.")) {
      return resolveHost(hostname.slice(4));
    }
  }

  let site = resolved ? await getSite(resolved.siteId) : null;

  if (!site) {
    if (process.env.ALLOW_HOST_FALLBACK === "false") return null;
    site = await getPrimarySite();
    if (!site) return null;
    return { site, domain: null, canServe: site.status === "active", reason: site.status === "active" ? undefined : "This site is not serving." };
  }

  return {
    site,
    domain,
    canServe: site.status === "active" && !site.deletedAt && (resolved?.canServe ?? true),
    reason: resolved?.reason,
  };
}

export async function listSiteDomains(siteId: string): Promise<Domain[]> {
  await ensureDb();
  return db
    .select()
    .from(domains)
    .where(and(eq(domains.siteId, siteId), isNull(domains.removedAt)))
    .orderBy(asc(domains.kind), asc(domains.hostname));
}

export async function findDomainByHostname(hostname: string): Promise<Domain | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.hostname, normalizeHostname(hostname)), isNull(domains.removedAt)))
    .limit(1);
  return row ?? null;
}

export type CreateSiteInput = {
  name: string;
  slug: string;
  theme?: Partial<SiteTheme>;
  createdBy: string;
};

export async function createSite(input: CreateSiteInput): Promise<Site> {
  await ensureDb();
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("Enter a site address.");
  const existing = await getSiteBySlug(slug);
  if (existing) throw new Error(`The address "${slug}" is already in use.`);

  const theme: SiteTheme = { ...DEFAULT_THEME, ...input.theme };
  const [site] = await db
    .insert(sites)
    .values({ name: input.name.trim(), slug, theme, createdBy: input.createdBy })
    .returning();

  await db.insert(siteContents).values([
    { siteId: site.id, kind: "navigation", draftDocument: null },
    { siteId: site.id, kind: "footer", draftDocument: null },
    { siteId: site.id, kind: "defaults", draftDocument: null },
  ]);

  await db.insert(domains).values({
    siteId: site.id,
    hostname: platformHost(slug),
    kind: "platform_subdomain",
    status: "active",
    verifiedAt: new Date(),
    certificateIssuer: "lets_encrypt",
    certificateState: "issued",
    isPrimary: true,
    requestedBy: input.createdBy,
  });

  return site;
}

export async function updateSiteTheme(siteId: string, theme: Partial<SiteTheme>): Promise<Site> {
  await ensureDb();
  const site = await getSite(siteId);
  if (!site) throw new Error("Site not found.");
  const [updated] = await db
    .update(sites)
    .set({ theme: { ...site.theme, ...theme }, updatedAt: new Date() })
    .where(eq(sites.id, siteId))
    .returning();
  return updated;
}

export async function renameSite(siteId: string, name: string): Promise<void> {
  await ensureDb();
  await db.update(sites).set({ name: name.trim(), updatedAt: new Date() }).where(eq(sites.id, siteId));
}

export async function setSiteStatus(siteId: string, status: "active" | "suspended" | "deleted"): Promise<void> {
  await ensureDb();
  const site = await getSiteRow(siteId);
  if (!site) throw new Error("Site not found.");
  assertTransition("site", site.status, status);
  await db
    .update(sites)
    .set({ status, deletedAt: status === "deleted" ? new Date() : null, updatedAt: new Date() })
    .where(eq(sites.id, siteId));
}

/** Includes soft-deleted rows: the restore path needs to see them. */
export async function getSiteRow(siteId: string): Promise<Site | null> {
  await ensureDb();
  const [row] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  return row ?? null;
}

/** Soft-deleted sites inside their restore window. */
export async function listDeletedSites() {
  await ensureDb();
  const rows = await db.select().from(sites).where(eq(sites.status, "deleted"));
  return rows.map((site) => ({
    site,
    restorableUntil: site.deletedAt ? daysFromNow(KEEP.siteRestoreDays, site.deletedAt.getTime()) : null,
  }));
}

export async function restoreSite(siteId: string): Promise<Site> {
  await ensureDb();
  const site = await getSiteRow(siteId);
  if (!site) throw new Error("Site not found.");
  if (site.status !== "deleted") throw new Error("That site is not deleted, so there is nothing to restore.");
  const [restored] = await db
    .update(sites)
    .set({ status: "active", deletedAt: null, updatedAt: new Date() })
    .where(eq(sites.id, siteId))
    .returning();
  cacheClear();
  return restored;
}

/** The hard delete: rows cascade, hostnames are released with the site. */
export async function purgeSite(siteId: string): Promise<void> {
  await ensureDb();
  const site = await getSiteRow(siteId);
  if (!site) throw new Error("Site not found.");
  // A hard delete is only ever the second stage: a live site must be deleted first,
  // so nobody can destroy a running site with a single mis-click.
  if (site.status !== "deleted") {
    throw new Error("Delete the site before purging it. Only a deleted site can be purged.");
  }
  await db.delete(sites).where(eq(sites.id, siteId));
  cacheClear();
}

export async function siteCounts(siteId: string) {
  await ensureDb();
  const [row] = await db
    .select({
      pages: sql<number>`(select count(*)::int from page where site_id = ${siteId} and deleted_at is null)`,
      published: sql<number>`(select count(*)::int from page where site_id = ${siteId} and status = 'published' and deleted_at is null)`,
      drafts: sql<number>`(select count(*)::int from page where site_id = ${siteId} and status = 'draft' and deleted_at is null)`,
      media: sql<number>`(select count(*)::int from media_asset where site_id = ${siteId} and status = 'ready')`,
      domains: sql<number>`(select count(*)::int from domain where site_id = ${siteId} and removed_at is null)`,
      imports: sql<number>`(select count(*)::int from import_job where site_id = ${siteId})`,
      versions: sql<number>`(select count(*)::int from page_version v join page p on p.id = v.page_id where p.site_id = ${siteId})`,
    })
    .from(sql`(select 1) as t`);
  return row;
}

export { pages };
