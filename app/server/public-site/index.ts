import "server-only";
import {
  normalizeHostname,
  normalizePath,
  type PageDocument,
  type PageSeo,
  type SiteTheme,
} from "@/lib/documents";
import { getDbPool } from "@/app/server/db/client";
import { cacheGetJson, cacheSetJson } from "@/app/server/redis/client";

export interface PublicPagePayload {
  readonly siteId: string;
  readonly siteName: string;
  readonly siteSlug: string;
  readonly siteTheme: SiteTheme;
  readonly pageId: string;
  readonly pageTitle: string;
  readonly versionId: string;
  readonly document: PageDocument;
  readonly seo: PageSeo;
  readonly navDocument: PageDocument | null;
  readonly footerDocument: PageDocument | null;
}

export async function resolvePublishedPage(input: {
  hostname?: string | null;
  siteSlug?: string | null;
  pageSlug?: string;
}): Promise<PublicPagePayload | null> {
  const cleanHost = input.hostname ? normalizeHostname(input.hostname) : "";
  const cleanSiteSlug = input.siteSlug?.trim().toLowerCase() ?? "";
  const cleanPageSlug = normalizePath(input.pageSlug ?? "/");
  const cacheKey = `pub:page:${cleanHost || cleanSiteSlug}:${cleanPageSlug}`;

  const cached = await cacheGetJson<PublicPagePayload>(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await getDbPool().query<{
    site_id: string;
    site_name: string;
    site_slug: string;
    site_theme: SiteTheme;
    page_id: string;
    page_title: string;
    version_id: string;
    document: PageDocument;
    seo: PageSeo;
    nav_document: PageDocument | null;
    footer_document: PageDocument | null;
  }>("SELECT * FROM resolve_public_page_snapshot($1, $2, $3)", [
    cleanHost || null,
    cleanSiteSlug || null,
    cleanPageSlug,
  ]);

  const row = res.rows[0];
  if (!row) {
    return null;
  }

  const payload: PublicPagePayload = {
    siteId: row.site_id,
    siteName: row.site_name,
    siteSlug: row.site_slug,
    siteTheme: row.site_theme,
    pageId: row.page_id,
    pageTitle: row.page_title,
    versionId: row.version_id,
    document: row.document,
    seo: row.seo,
    navDocument: row.nav_document,
    footerDocument: row.footer_document,
  };
  await cacheSetJson(cacheKey, payload, 120);
  return payload;
}
