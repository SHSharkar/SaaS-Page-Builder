import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  domains,
  importJobs,
  mediaAssets,
  mediaReferences,
  pages,
  pageVersions,
  siteContents,
  sites,
  type Domain,
  type Site,
} from "@/lib/db/schema";
import { DEFAULT_THEME, normalizeHostname, slugify, type SiteTheme } from "@/lib/documents";
import {
  cacheClear,
  cacheGet,
  cacheKeys,
  cacheSet,
  invalidateDomain,
  invalidateSite,
} from "@/lib/cache";
import { assertTransition, daysFromNow, KEEP } from "@/lib/lifecycle";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { deleteObject } from "@/lib/media/storage";
import { recordAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";

export const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "pages.trofeo.test";

export function platformHost(slug: string): string {
  return `${slug}.${PLATFORM_DOMAIN}`;
}

export async function listSites() {
  await ensureDb();
  const liveSites = await db
    .select()
    .from(sites)
    .where(and(isNull(sites.deletedAt), ne(sites.status, "deleted")))
    .orderBy(asc(sites.name));
  if (liveSites.length === 0) return [];
  const siteIds = liveSites.map((s) => s.id);

  const [domainRows, pageRows] = await Promise.all([
    db
      .select({
        siteId: domains.siteId,
        hostname: domains.hostname,
        isPrimary: domains.isPrimary,
      })
      .from(domains)
      .where(and(inArray(domains.siteId, siteIds), isNull(domains.removedAt)))
      .orderBy(desc(domains.isPrimary), asc(domains.createdAt)),
    db
      .select({
        siteId: pages.siteId,
        status: pages.status,
      })
      .from(pages)
      .where(and(inArray(pages.siteId, siteIds), isNull(pages.deletedAt), ne(pages.status, "deleted"))),
  ]);

  const primaryMap = new Map<string, string>();
  const domainCountMap = new Map<string, number>();
  for (const row of domainRows) {
    if (!primaryMap.has(row.siteId)) primaryMap.set(row.siteId, row.hostname);
    domainCountMap.set(row.siteId, (domainCountMap.get(row.siteId) ?? 0) + 1);
  }

  const pageCountMap = new Map<string, number>();
  const publishedCountMap = new Map<string, number>();
  for (const row of pageRows) {
    pageCountMap.set(row.siteId, (pageCountMap.get(row.siteId) ?? 0) + 1);
    if (row.status === "published") {
      publishedCountMap.set(row.siteId, (publishedCountMap.get(row.siteId) ?? 0) + 1);
    }
  }

  return liveSites.map((site) => ({
    site,
    primaryDomain: primaryMap.get(site.id) ?? null,
    pageCount: pageCountMap.get(site.id) ?? 0,
    publishedCount: publishedCountMap.get(site.id) ?? 0,
    domainCount: domainCountMap.get(site.id) ?? 0,
  }));
}

export async function getSite(siteId: string): Promise<Site | null> {
  await ensureDb();
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)))
    .limit(1);
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
  canServe: boolean;
  reason?: string;
};

function isDevPreviewHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return process.env.NODE_ENV !== "production";
  }
  if (hostname.endsWith(".e2b.app")) {
    return true;
  }
  return false;
}

export async function resolveHost(rawHost: string): Promise<HostResolution | null> {
  await ensureDb();
  const hostname = normalizeHostname(rawHost);
  if (!hostname) return null;

  type CachedHost = { siteId: string; canServe: boolean; reason?: string };
  const cacheKey = cacheKeys.domain(hostname);
  let resolved = await cacheGet<CachedHost>(cacheKey);
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
      const canServe =
        row.domain.status === "active" && row.site.status === "active" && !row.site.deletedAt;
      resolved = {
        siteId: row.site.id,
        canServe,
        reason: canServe
          ? undefined
          : row.domain.status !== "active"
            ? "Domain verification is not complete."
            : "This site is not serving.",
      };
      await cacheSet(cacheKey, resolved, 60);
    } else if (hostname.startsWith("www.")) {
      return resolveHost(hostname.slice(4));
    }
  }

  let site = resolved ? await getSite(resolved.siteId) : null;

  if (!site) {
    const fallbackExplicit = process.env.ALLOW_HOST_FALLBACK;
    const allowFallback =
      fallbackExplicit === "true" || (fallbackExplicit !== "false" && isDevPreviewHost(hostname));
    if (!allowFallback) return null;
    site = await getPrimarySite();
    if (!site) return null;
    return {
      site,
      domain: null,
      canServe: site.status === "active",
      reason: site.status === "active" ? undefined : "This site is not serving.",
    };
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
  if (!slug) throw new ValidationError("Enter a site address.");
  const existing = await getSiteBySlug(slug);
  if (existing) throw new ConflictError(`The address "${slug}" is already in use.`);

  const theme: SiteTheme = { ...DEFAULT_THEME, ...input.theme };
  const site = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(sites)
      .values({ name: input.name.trim(), slug, theme, createdBy: input.createdBy })
      .returning();

    await tx.insert(siteContents).values([
      { siteId: inserted.id, kind: "navigation", draftDocument: null },
      { siteId: inserted.id, kind: "footer", draftDocument: null },
      { siteId: inserted.id, kind: "defaults", draftDocument: null },
    ]);

    await tx.insert(domains).values({
      siteId: inserted.id,
      hostname: platformHost(slug),
      kind: "platform_subdomain",
      status: "active",
      verifiedAt: new Date(),
      certificateIssuer: "lets_encrypt",
      certificateState: "issued",
      isPrimary: true,
      requestedBy: input.createdBy,
    });

    if (theme.logoMediaId) {
      await tx
        .insert(mediaReferences)
        .values({
          mediaId: theme.logoMediaId,
          siteId: inserted.id,
          sourceType: "site_theme",
          sourceId: inserted.id,
        })
        .onConflictDoNothing();
    }

    return inserted;
  });

  return site;
}

export async function updateSiteTheme(siteId: string, theme: Partial<SiteTheme>): Promise<Site> {
  await ensureDb();
  const site = await getSite(siteId);
  if (!site) throw new NotFoundError("Site not found.");
  const merged = { ...site.theme, ...theme };
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(sites)
      .set({ theme: merged, updatedAt: new Date() })
      .where(eq(sites.id, siteId))
      .returning();

    await tx
      .delete(mediaReferences)
      .where(
        and(
          eq(mediaReferences.siteId, siteId),
          eq(mediaReferences.sourceType, "site_theme"),
          eq(mediaReferences.sourceId, siteId),
        ),
      );
    if (merged.logoMediaId) {
      await tx
        .insert(mediaReferences)
        .values({
          mediaId: merged.logoMediaId,
          siteId,
          sourceType: "site_theme",
          sourceId: siteId,
        })
        .onConflictDoNothing();
    }
    return rows;
  });
  await invalidateSite(siteId);
  return updated;
}

export async function renameSite(siteId: string, name: string): Promise<void> {
  await ensureDb();
  await db
    .update(sites)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(sites.id, siteId));
  await invalidateSite(siteId);
}

export async function setSiteStatus(
  siteId: string,
  status: "active" | "suspended" | "deleted",
): Promise<void> {
  await ensureDb();
  const site = await getSiteRow(siteId);
  if (!site) throw new NotFoundError("Site not found.");
  assertTransition("site", site.status, status);
  const siteDomainRows = await db
    .select({ hostname: domains.hostname })
    .from(domains)
    .where(eq(domains.siteId, siteId));

  await db
    .update(sites)
    .set({ status, deletedAt: status === "deleted" ? new Date() : null, updatedAt: new Date() })
    .where(eq(sites.id, siteId));

  await Promise.all([
    invalidateSite(siteId),
    ...siteDomainRows.map((d) => invalidateDomain(d.hostname)),
  ]);
}

export async function getSiteRow(siteId: string): Promise<Site | null> {
  await ensureDb();
  const [row] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  return row ?? null;
}

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
  if (!site) throw new NotFoundError("Site not found.");
  if (site.status !== "deleted") {
    throw new ValidationError("That site is not deleted, so there is nothing to restore.");
  }
  const siteDomainRows = await db
    .select({ hostname: domains.hostname })
    .from(domains)
    .where(eq(domains.siteId, siteId));

  const [restored] = await db
    .update(sites)
    .set({ status: "active", deletedAt: null, updatedAt: new Date() })
    .where(eq(sites.id, siteId))
    .returning();

  await Promise.all([
    invalidateSite(siteId),
    ...siteDomainRows.map((d) => invalidateDomain(d.hostname)),
  ]);
  return restored;
}

export async function purgeSite(siteId: string, actor: Actor | null = null): Promise<void> {
  await ensureDb();
  const site = await getSiteRow(siteId);
  if (!site) throw new NotFoundError("Site not found.");

  if (site.status !== "deleted") {
    throw new ValidationError("Delete the site before purging it. Only a deleted site can be purged.");
  }

  const [storedMedia, siteDomainRows] = await Promise.all([
    db
      .select({ storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(eq(mediaAssets.siteId, siteId)),
    db.select({ hostname: domains.hostname }).from(domains).where(eq(domains.siteId, siteId)),
  ]);

  await db.delete(sites).where(eq(sites.id, siteId));

  await Promise.all(
    storedMedia.map(async (item) => {
      try {
        await deleteObject(item.storageKey);
      } catch {
        // Object cleanup is best-effort after row removal.
      }
    }),
  );

  await Promise.all([
    cacheClear(),
    ...siteDomainRows.map((d) => invalidateDomain(d.hostname)),
  ]);

  await recordAudit({
    actor,
    action: "site_purged",
    targetType: "site",
    targetId: siteId,
    summary: `Permanently purged site "${site.name}" (${storedMedia.length} stored files removed)`,
  });
}

export async function siteCounts(siteId: string) {
  await ensureDb();
  const [
    [totalPages],
    [publishedPages],
    [draftPages],
    [readyMedia],
    [liveDomains],
    [allImports],
    [allVersions],
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), isNull(pages.deletedAt), ne(pages.status, "deleted"))),
    db
      .select({ total: count() })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.status, "published"), isNull(pages.deletedAt))),
    db
      .select({ total: count() })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.status, "draft"), isNull(pages.deletedAt))),
    db
      .select({ total: count() })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.status, "ready"))),
    db
      .select({ total: count() })
      .from(domains)
      .where(and(eq(domains.siteId, siteId), isNull(domains.removedAt))),
    db.select({ total: count() }).from(importJobs).where(eq(importJobs.siteId, siteId)),
    db
      .select({ total: count() })
      .from(pageVersions)
      .innerJoin(pages, eq(pages.id, pageVersions.pageId))
      .where(eq(pages.siteId, siteId)),
  ]);
  return {
    pages: Number(totalPages?.total ?? 0),
    published: Number(publishedPages?.total ?? 0),
    drafts: Number(draftPages?.total ?? 0),
    media: Number(readyMedia?.total ?? 0),
    domains: Number(liveDomains?.total ?? 0),
    imports: Number(allImports?.total ?? 0),
    versions: Number(allVersions?.total ?? 0),
  };
}

export { pages };
