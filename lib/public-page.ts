import "server-only";
import { cache } from "react";
import { normalizePath, type PageDocument, type PageSeo, type SiteTheme } from "@/lib/documents";
import { getSite, resolveHost } from "@/lib/sites";
import { getPageBySlug, getPublishedDocument, listPages } from "@/lib/pages";
import { getDefaultSeo, getPublishedGlobals } from "@/lib/globals";
import { getMedia, mediaMapFor } from "@/lib/media";
import { resolveDocumentMedia } from "@/lib/registry";
import type { Page, Site } from "@/lib/db/schema";
import type { ResolvedMedia } from "@/lib/media/refs";

export type RenderedPage = {
  site: Site;
  page: Page;
  document: PageDocument;
  seo: PageSeo;
  title: string;
  versionId: string;
  host: string;
  path: string;
  shareImageUrl: string | null;
};

export type LoadedPage =
  | {
      kind: "page";
      rendered: RenderedPage;
      navigation: PageDocument | null;
      footer: PageDocument | null;
      defaultSeo: Partial<PageSeo>;
      theme: SiteTheme;
    }
  | { kind: "not_found"; reason: string };

export const loadPublicPage = cache(async (host: string, rawPath: string): Promise<LoadedPage> => {
  const resolution = await resolveHost(host);
  if (!resolution) return { kind: "not_found", reason: "unknown-host" };
  if (!resolution.canServe) return { kind: "not_found", reason: resolution.reason ?? "not-serving" };

  const site = resolution.site;
  const path = normalizePath(rawPath);
  const page = await getPageBySlug(site.id, path);
  if (!page) return { kind: "not_found", reason: "no-page" };

  const published = await getPublishedDocument(site.id, page);
  if (!published) return { kind: "not_found", reason: "not-published" };

  const media = await mediaMapFor(site.id);
  const globals = await getPublishedGlobals(site.id);

  const document = resolveDocumentMedia(published.document, media);
  const navigation = globals.navigation ? resolveDocumentMedia(globals.navigation, media) : null;
  const footer = globals.footer ? resolveDocumentMedia(globals.footer, media) : null;

  let shareImageUrl: string | null = null;
  if (published.seo?.shareImageId) {
    const asset = await getMedia(site.id, published.seo.shareImageId);
    shareImageUrl = asset?.publicUrl ?? null;
  }

  return {
    kind: "page",
    rendered: {
      site,
      page,
      document,
      seo: published.seo,
      title: published.title,
      versionId: published.versionId,
      host,
      path,
      shareImageUrl,
    },
    navigation,
    footer,
    defaultSeo: (globals.defaults?.root?.props as Record<string, unknown> | undefined)?.seo
      ? ((globals.defaults?.root?.props as Record<string, unknown>).seo as Partial<PageSeo>)
      : await getDefaultSeo(site.id),
    theme: site.theme,
  };
});

export async function resolveSiteForHost(host: string | null): Promise<Site | null> {
  if (!host) return null;
  const res = await resolveHost(host);
  return res?.canServe ? res.site : null;
}

export async function listPublishedSlugsForSite(
  siteId: string,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await listPages(siteId);
  return rows
    .filter((p) => p.status === "published" && p.publishedVersionId)
    .map((p) => ({
      slug: p.isHomepage || p.slug === "/" ? "" : p.slug.replace(/^\/+/, ""),
      updatedAt: p.updatedAt,
    }));
}

export const loadPreviewPage = cache(async (siteId: string, rawPath: string) => {
  const site = await getSite(siteId);
  if (!site) return { kind: "not_found" as const, reason: "no-site" };
  const path = normalizePath(rawPath);
  const page = await getPageBySlug(site.id, path);
  if (!page) return { kind: "not_found" as const, reason: "no-page" };

  const media = await mediaMapFor(site.id);
  const globals = await getPublishedGlobals(site.id);
  const document = resolveDocumentMedia(page.draftDocument, media);

  return {
    kind: "page" as const,
    rendered: {
      site,
      page,
      document,
      seo: { ...page.seo, noindex: true },
      title: page.title,
      versionId: "preview",
      host: "",
      path,
      shareImageUrl: null,
    },
    navigation: globals.navigation ? resolveDocumentMedia(globals.navigation, media) : null,
    footer: globals.footer ? resolveDocumentMedia(globals.footer, media) : null,
    theme: site.theme,
  };
});

export function mediaRefUrl(
  media: Map<string, ResolvedMedia>,
  ref: { id?: string } | null | undefined,
): string | null {
  if (!ref?.id) return null;
  return media.get(ref.id)?.url ?? null;
}
