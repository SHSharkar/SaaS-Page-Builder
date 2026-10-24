import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { pageVersions, pages, type Page, type PageVersion } from "@/lib/db/schema";
import {
  DOCUMENT_SCHEMA_VERSION,
  DEFAULT_ROOT_PROPS,
  DEFAULT_SEO,
  emptyDocument,
  normalizePath,
  normalizeSlugPath,
  slugify,
  type PageDocument,
  type PageSeo,
} from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheGet, cacheKeys, cacheSet, consumeRateLimit, invalidatePageCache } from "@/lib/cache";
import { validateDocument } from "@/lib/registry";

export const MAX_VERSIONS_PER_PAGE = 50;

/** Used by the globals cache warmer; documents are validated where they are written. */
export function primeGlobalDocuments(_documents: unknown): void {
  /* no-op: the cache stores documents as written, validation happens on save */
}

export async function listPages(siteId: string) {
  await ensureDb();
  return db
    .select({
      page: pages,
      versionCount: sql<number>`(select count(*)::int from page_version v where v.page_id = ${pages.id})`,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), isNull(pages.deletedAt)))
    .orderBy(desc(pages.isHomepage), asc(pages.title));
}

export async function getPage(siteId: string, pageId: string): Promise<Page | null> {
  await ensureDb();
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId), isNull(pages.deletedAt)))
    .limit(1);
  return page ?? null;
}

export async function getPageBySlug(siteId: string, slug: string): Promise<Page | null> {
  await ensureDb();
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, normalizePath(slug)), isNull(pages.deletedAt)))
    .limit(1);
  return page ?? null;
}

export type CreatePageInput = {
  siteId: string;
  title: string;
  slug: string;
  document?: PageDocument;
  seo?: Partial<PageSeo>;
  actor: Actor;
  source?: "manual" | "template" | "import" | "generated";
  isHomepage?: boolean;
};

export async function createPage(input: CreatePageInput): Promise<Page> {
  await ensureDb();
  const slug = normalizeSlugPath(input.slug ?? input.title);
  const existing = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, input.siteId), eq(pages.slug, slug), isNull(pages.deletedAt)))
    .limit(1);
  if (existing.length) throw new Error(`A page already lives at "/${slug}".`);

  const document = input.document ?? emptyDocument();
  const validation = validateDocument(document);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const wantsHomepage =
    input.isHomepage ?? (await db.select({ id: pages.id }).from(pages).where(and(eq(pages.siteId, input.siteId), isNull(pages.deletedAt)))).length === 0;

  if (wantsHomepage) {
    await db.update(pages).set({ isHomepage: false }).where(eq(pages.siteId, input.siteId));
  }

  const [page] = await db
    .insert(pages)
    .values({
      siteId: input.siteId,
      title: input.title.trim() || "Untitled page",
      slug,
      status: "draft",
      isHomepage: wantsHomepage,
      draftDocument: validation.document,
      draftUpdatedBy: input.actor.user.id,
      seo: { ...DEFAULT_SEO, ...input.seo },
      createdBy: input.actor.user.id,
    })
    .returning();

  await recordAudit({
    action: "page_created",
    summary: `Created the page “${page.title}” at /${page.slug}`,
    siteId: input.siteId,
    actor: input.actor,
    targetType: "page",
    targetId: page.id,
    detail: { source: input.source ?? "manual" },
  });

  return page;
}

export type SaveDraftResult = { lockVersion: number };

/** Saves carry the optimistic counter; a stale save is refused (FR-007). */
export async function saveDraft(
  siteId: string,
  pageId: string,
  document: unknown,
  lockVersion: number,
  actor: Actor,
): Promise<SaveDraftResult> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  if (page.lockVersion !== lockVersion) {
    throw new Error(
      "Someone else saved this page after you opened it. Refresh to load their version before saving again.",
    );
  }
  const validation = validateDocument(document);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const [updated] = await db
    .update(pages)
    .set({
      draftDocument: validation.document,
      draftUpdatedBy: actor.user.id,
      lockVersion: page.lockVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.id, pageId), eq(pages.lockVersion, lockVersion)))
    .returning();

  if (!updated) {
    throw new Error("The page changed while you were saving. Refresh before trying again.");
  }

  await recordAudit({
    action: "page_updated",
    summary: `Saved the draft of “${page.title}”`,
    siteId,
    actor,
    targetType: "page",
    targetId: page.id,
  });

  return { lockVersion: updated.lockVersion };
}

export async function updatePageMeta(
  siteId: string,
  pageId: string,
  input: { title?: string; slug?: string; seo?: Partial<PageSeo> },
  actor: Actor,
): Promise<Page> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");

  const slug = input.slug !== undefined ? normalizeSlugPath(input.slug) : page.slug;
  if (slug !== page.slug) {
    const clash = await db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug), isNull(pages.deletedAt)))
      .limit(1);
    if (clash.length && clash[0].id !== pageId) throw new Error(`A page already lives at "/${slug}".`);
  }

  const [updated] = await db
    .update(pages)
    .set({
      title: input.title?.trim() || page.title,
      slug,
      seo: { ...page.seo, ...input.seo },
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId))
    .returning();

  invalidatePageCache(siteId);
  await recordAudit({
    action: "page_updated",
    summary: `Updated page settings for “${updated.title}”`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
  return updated;
}

export type PublishResult = { versionId: string; versionNumber: number };

/** Publish: snapshot the draft, then clear the cache in the same request. */
export async function publishPage(
  siteId: string,
  pageId: string,
  actor: Actor,
  source: "manual" | "template" | "import" | "generated" | "rollback" = "manual",
): Promise<PublishResult> {
  await ensureDb();
  if (!consumeRateLimit(`publish:${pageId}`, 30, 3600)) {
    throw new Error("This page has been published 30 times in the last hour. Try again later.");
  }
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  const validation = validateDocument(page.draftDocument);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const result = await db.transaction(async (tx) => {
    if (page.isHomepage) {
      // One published homepage per site, enforced again by a partial index.
      await tx
        .update(pages)
        .set({ isHomepage: false })
        .where(and(eq(pages.siteId, siteId), eq(pages.isHomepage, true), sql`${pages.id} <> ${pageId}`));
    }
    const [latest] = await tx
      .select({ max: sql<number>`coalesce(max(${pageVersions.versionNumber}), 0)::int` })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId));

    const [version] = await tx
      .insert(pageVersions)
      .values({
        pageId,
        versionNumber: (latest?.max ?? 0) + 1,
        document: validation.document,
        documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
        source,
        seo: page.seo,
        title: page.title,
        publishedBy: actor.user.id,
      })
      .returning();

    await tx
      .update(pages)
      .set({
        status: "published",
        currentPublishedVersionId: version.id,
        isHomepage: page.isHomepage,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, pageId));

    return version;
  });

  invalidatePageCache(siteId);

  await recordAudit({
    action: "page_published",
    summary: `Published “${page.title}” as version ${result.versionNumber}`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
    detail: { versionNumber: result.versionNumber, versionId: result.id },
  });

  return { versionId: result.id, versionNumber: result.versionNumber };
}

export async function unpublishPage(siteId: string, pageId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  await db.update(pages).set({ status: "draft", updatedAt: new Date() }).where(eq(pages.id, pageId));
  // A takedown is never delayed by a cache: clear now, in this request.
  invalidatePageCache(siteId);
  await recordAudit({
    action: "page_unpublished",
    summary: `Took “${page.title}” offline`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export async function archivePage(siteId: string, pageId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  await db
    .update(pages)
    .set({ status: "archived", isHomepage: false, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
  invalidatePageCache(siteId);
  await recordAudit({
    action: "page_archived",
    summary: `Archived “${page.title}”`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export async function listVersions(pageId: string): Promise<PageVersion[]> {
  await ensureDb();
  return db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(MAX_VERSIONS_PER_PAGE);
}

/** Rollback republishes an old snapshot as a brand-new snapshot; history never rewrites. */
export async function rollbackToVersion(
  siteId: string,
  pageId: string,
  versionId: string,
  actor: Actor,
): Promise<PublishResult> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  const [version] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, pageId)))
    .limit(1);
  if (!version) throw new Error("That version does not belong to this page.");

  await db
    .update(pages)
    .set({
      draftDocument: version.document,
      title: version.title,
      seo: version.seo,
      lockVersion: page.lockVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId));

  const result = await publishPage(siteId, pageId, actor, "rollback");
  await recordAudit({
    action: "page_rolled_back",
    summary: `Rolled “${page.title}” back to version ${version.versionNumber}`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
    detail: { fromVersion: version.versionNumber, newVersion: result.versionNumber },
  });
  return result;
}

export async function setHomepage(siteId: string, pageId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  if (page.status !== "published") throw new Error("Publish the page before making it the homepage.");

  await db.transaction(async (tx) => {
    await tx.update(pages).set({ isHomepage: false }).where(eq(pages.siteId, siteId));
    await tx.update(pages).set({ isHomepage: true, updatedAt: new Date() }).where(eq(pages.id, pageId));
  });

  invalidatePageCache(siteId);
  await recordAudit({
    action: "homepage_set",
    summary: `Made “${page.title}” the site homepage`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export async function schedulePublish(
  siteId: string,
  pageId: string,
  when: Date | null,
  operator: "publish" | "unpublish",
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new Error("Page not found.");
  await db
    .update(pages)
    .set(
      operator === "publish"
        ? { scheduledPublishAt: when, updatedAt: new Date() }
        : { scheduledUnpublishAt: when, updatedAt: new Date() },
    )
    .where(eq(pages.id, pageId));

  // The queue owns the clock: one queued job per page and operation, replaced
  // whenever the schedule changes and cancelled when it is cleared.
  const { jobs } = await import("@/lib/db/schema");
  const { enqueue } = await import("@/lib/queue");
  const dedupeKey = `page.schedule:${pageId}:${operator}`;
  await db.delete(jobs).where(and(eq(jobs.dedupeKey, dedupeKey), eq(jobs.status, "queued")));
  if (when) {
    await enqueue(
      operator === "publish" ? "page.publish.scheduled" : "page.unpublish.scheduled",
      { siteId, pageId },
      { runAt: when, dedupeKey },
    );
  }

  await recordAudit({
    action: "page_scheduled",
    summary: when
      ? `Scheduled ${operator} of “${page.title}” for ${when.toISOString()}`
      : `Cleared the scheduled ${operator} of “${page.title}”`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

/** Reads the published snapshot for the public renderer. */
export async function getPublishedDocument(
  siteId: string,
  page: Page,
): Promise<{ document: PageDocument; versionId: string; seo: PageSeo; title: string } | null> {
  await ensureDb();
  if (page.status !== "published" || !page.currentPublishedVersionId) return null;
  const cacheKey = cacheKeys.page(siteId, page.slug, page.currentPublishedVersionId);
  const cached = cacheGet<{ document: PageDocument; versionId: string; seo: PageSeo; title: string }>(cacheKey);
  if (cached) return cached;

  const [version] = await db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.id, page.currentPublishedVersionId))
    .limit(1);
  if (!version) return null;

  const payload = { document: version.document, versionId: version.id, seo: version.seo, title: version.title };
  cacheSet(cacheKey, payload, 10 * 60_000);
  return payload;
}

export async function pruneVersions(pageId: string, keep = MAX_VERSIONS_PER_PAGE): Promise<number> {
  await ensureDb();
  const page = await db.select({ current: pages.currentPublishedVersionId }).from(pages).where(eq(pages.id, pageId)).limit(1);
  const cutoff = await db
    .select({ versionNumber: pageVersions.versionNumber })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(keep);
  const keepNumbers = cutoff.map((row) => row.versionNumber);
  if (!keepNumbers.length) return 0;
  const oldestKept = Math.min(...keepNumbers);
  const deleted = await db
    .delete(pageVersions)
    .where(
      and(
        eq(pageVersions.pageId, pageId),
        lt(pageVersions.versionNumber, oldestKept),
        page[0]?.current ? sql`${pageVersions.id} <> ${page[0].current}` : sql`true`,
      ),
    )
    .returning({ id: pageVersions.id });
  return deleted.length;
}

export function newPageDocument(): PageDocument {
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, root: { props: { ...DEFAULT_ROOT_PROPS } }, content: [] };
}
