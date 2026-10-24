import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  mediaReferences,
  pages,
  pageVersions,
  trackingPlacements,
  type Page,
  type PageVersion,
} from "@/lib/db/schema";
import {
  assertDocumentSize,
  cloneDocumentWithNewIds,
  emptyDocument,
  migrateDocument,
  normalizePath,
  type PageDocument,
  type PageSeo,
} from "@/lib/documents";
import {
  collectTrackingPlacements,
  documentUsesAdminBlocks,
  validateDocument,
} from "@/lib/registry";
import { collectMediaIds } from "@/lib/media/refs";
import { syncMediaReferencesForSource } from "@/lib/media";
import { can } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  cacheGet,
  cacheKeys,
  cacheSet,
  consumeRateLimit,
  invalidatePage,
  invalidateSite,
} from "@/lib/cache";
import { assertTransition, daysFromNow, KEEP } from "@/lib/lifecycle";
import { getSettingNumber } from "@/lib/settings";
import {
  ConflictError,
  ForbiddenError,
  LifecycleError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import { cancelByKey, enqueue } from "@/lib/queue";

export async function listPages(siteId: string): Promise<Page[]> {
  await ensureDb();
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), isNull(pages.deletedAt), ne(pages.status, "deleted")))
    .orderBy(desc(pages.isHomepage), asc(pages.position), asc(pages.title));
}

export async function listPagesWithCounts(
  siteId: string,
): Promise<{ page: Page; versionCount: number }[]> {
  await ensureDb();
  const sitePages = await listPages(siteId);
  if (sitePages.length === 0) return [];
  const counts = await db
    .select({ pageId: pageVersions.pageId, total: count() })
    .from(pageVersions)
    .where(
      inArray(
        pageVersions.pageId,
        sitePages.map((p) => p.id),
      ),
    )
    .groupBy(pageVersions.pageId);
  const countMap = new Map(counts.map((c) => [c.pageId, Number(c.total)]));
  return sitePages.map((page) => ({
    page,
    versionCount: countMap.get(page.id) ?? 0,
  }));
}

export async function listDeletedPages(siteId: string) {
  await ensureDb();
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, "deleted")))
    .orderBy(desc(pages.deletedAt));
  return rows.map((page) => ({
    page,
    restorableUntil: page.deletedAt
      ? daysFromNow(KEEP.pageTrashDays, page.deletedAt.getTime())
      : null,
  }));
}

export async function getPage(siteId: string, pageId: string): Promise<Page | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId), isNull(pages.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getPageIncludingDeleted(
  siteId: string,
  pageId: string,
): Promise<Page | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1);
  return row ?? null;
}

export async function getPageBySlug(siteId: string, rawPath: string): Promise<Page | null> {
  await ensureDb();
  const slug = normalizePath(rawPath);
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug), isNull(pages.deletedAt)))
    .limit(1);
  if (row) return row;
  if (slug === "/") {
    const [home] = await db
      .select()
      .from(pages)
      .where(
        and(eq(pages.siteId, siteId), eq(pages.isHomepage, true), isNull(pages.deletedAt)),
      )
      .limit(1);
    return home ?? null;
  }
  return null;
}

export async function getPublishedDocument(
  siteId: string,
  page: Page,
): Promise<{
  document: PageDocument;
  seo: PageSeo;
  title: string;
  versionId: string;
} | null> {
  if (page.status !== "published" || !page.publishedVersionId) return null;
  const cacheKey = cacheKeys.page(siteId, page.slug);
  type CachedPage = {
    document: PageDocument;
    seo: PageSeo;
    title: string;
    versionId: string;
  };
  const cached = await cacheGet<CachedPage>(cacheKey);
  if (cached && cached.versionId === page.publishedVersionId) return cached;

  const [version] = await db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.id, page.publishedVersionId))
    .limit(1);
  if (!version) return null;

  const value: CachedPage = {
    document: migrateDocument(version.document),
    seo: version.seo ?? {},
    title: version.title,
    versionId: version.id,
  };
  await cacheSet(cacheKey, value, 120);
  return value;
}

async function syncPageTrackingPlacements(
  siteId: string,
  pageId: string,
  doc: PageDocument,
): Promise<void> {
  await db.delete(trackingPlacements).where(eq(trackingPlacements.pageId, pageId));
  const placements = collectTrackingPlacements(doc);
  if (placements.length === 0) return;

  await db.insert(trackingPlacements).values(
    placements.map((item) => ({
      siteId,
      pageId,
      blockId: item.blockId,
      blockType: item.blockType,
      label: item.label,
      destinationUrl: item.url,
      trackingId: item.trackingId,
    })),
  );
}

export type CreatePageInput = {
  siteId: string;
  title: string;
  slug?: string;
  isHomepage?: boolean;
  document?: PageDocument;
  seo?: PageSeo;
  actor: Actor;
};

export async function createPage(input: CreatePageInput): Promise<Page> {
  await ensureDb();
  const title = input.title.trim();
  if (!title) throw new ValidationError("Give the page a title.");
  const slug = input.isHomepage ? "/" : normalizePath(input.slug || title);
  const existing = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, input.siteId), eq(pages.slug, slug), isNull(pages.deletedAt)))
    .limit(1);
  if (existing.length) {
    throw new ConflictError(`A page already lives at ${slug} on this site.`);
  }

  const doc = migrateDocument(input.document ?? emptyDocument());
  if (documentUsesAdminBlocks(doc).length > 0 && !can(input.actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can create pages containing raw HTML or external embed blocks.",
    );
  }
  assertDocumentSize(doc);

  const page = await db.transaction(async (tx) => {
    if (input.isHomepage) {
      await tx
        .update(pages)
        .set({ isHomepage: false })
        .where(and(eq(pages.siteId, input.siteId), eq(pages.isHomepage, true)));
    }

    const [inserted] = await tx
      .insert(pages)
      .values({
        siteId: input.siteId,
        title,
        slug,
        isHomepage: Boolean(input.isHomepage),
        status: "draft",
        draftDocument: doc,
        seo: input.seo ?? {},
        createdBy: input.actor.user.id,
        updatedBy: input.actor.user.id,
      })
      .returning();

    return inserted;
  });

  const draftMedia = collectMediaIds(doc);
  if (input.seo?.shareImageId) draftMedia.add(input.seo.shareImageId);
  await syncMediaReferencesForSource(input.siteId, "page_draft", page.id, draftMedia);

  await recordAudit({
    action: "page_created",
    summary: `Created page "${title}" at ${slug}`,
    siteId: input.siteId,
    actor: input.actor,
    targetType: "page",
    targetId: page.id,
  });

  return page;
}

export type SaveDraftInput = {
  siteId: string;
  pageId: string;
  expectedLockVersion: number;
  title?: string;
  slug?: string;
  document: PageDocument;
  seo?: PageSeo;
  actor: Actor;
};

export async function savePageDraft(input: SaveDraftInput): Promise<Page> {
  await ensureDb();
  const doc = migrateDocument(input.document);
  const validated = validateDocument(doc);
  if (!validated.ok) {
    throw new ValidationError(validated.errors[0] ?? "The page document has invalid blocks.");
  }
  if (documentUsesAdminBlocks(doc).length > 0 && !can(input.actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can save pages containing raw HTML or external embed blocks.",
    );
  }
  assertDocumentSize(doc);

  const current = await getPage(input.siteId, input.pageId);
  if (!current) throw new NotFoundError("Page not found.");

  let nextSlug = current.slug;
  if (input.slug !== undefined && !current.isHomepage) {
    nextSlug = normalizePath(input.slug);
    if (nextSlug !== current.slug) {
      const collision = await db
        .select({ id: pages.id })
        .from(pages)
        .where(
          and(
            eq(pages.siteId, input.siteId),
            eq(pages.slug, nextSlug),
            isNull(pages.deletedAt),
          ),
        )
        .limit(1);
      if (collision.length) {
        throw new ConflictError(`Another page already uses ${nextSlug}.`);
      }
    }
  }

  const nextSeo = input.seo ?? current.seo;

  const updated = await db
    .update(pages)
    .set({
      title: input.title?.trim() || current.title,
      slug: nextSlug,
      draftDocument: doc,
      seo: nextSeo,
      lockVersion: sql`${pages.lockVersion} + 1`,
      updatedBy: input.actor.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pages.id, input.pageId),
        eq(pages.siteId, input.siteId),
        eq(pages.lockVersion, input.expectedLockVersion),
      ),
    )
    .returning();

  if (!updated.length) {
    throw new ConflictError(
      "Someone else saved this page while it was open. Reload to inspect their changes before saving again.",
    );
  }

  const draftMedia = collectMediaIds(doc);
  if (nextSeo?.shareImageId) draftMedia.add(nextSeo.shareImageId);
  await syncMediaReferencesForSource(input.siteId, "page_draft", updated[0].id, draftMedia);

  if (nextSlug !== current.slug) {
    await invalidatePage(input.siteId, current.slug);
  }
  return updated[0];
}

export type PublishOptions = {
  note?: string;
  source?: "manual" | "scheduled" | "rollback" | "import";
};

export async function publishPage(
  siteId: string,
  pageId: string,
  actor: Actor | null,
  optionsOrNote?: string | PublishOptions,
): Promise<{ page: Page; version: PageVersion }> {
  await ensureDb();
  const opts: PublishOptions =
    typeof optionsOrNote === "string" ? { note: optionsOrNote } : (optionsOrNote ?? {});

  if (actor) {
    const maxPublishPerHour = await getSettingNumber("limits.publish_per_hour", 60);
    const limit = await consumeRateLimit("publish", actor.user.id, maxPublishPerHour, 3600);
    if (!limit.allowed) {
      throw new RateLimitError(
        `Publish rate limit reached (${maxPublishPerHour} publishes per hour). Try again shortly.`,
        limit.retryAfterSeconds,
      );
    }
  }

  const page = await getPage(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  if (page.status !== "published") {
    assertTransition("page", page.status, "published");
  }
  if (actor && documentUsesAdminBlocks(page.draftDocument).length > 0 && !can(actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can publish pages containing raw HTML or external embed blocks.",
    );
  }
  assertDocumentSize(page.draftDocument);

  const [lastVersion] = await db
    .select({ versionNumber: pageVersions.versionNumber })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);
  const nextNumber = (lastVersion?.versionNumber ?? 0) + 1;

  const [version] = await db
    .insert(pageVersions)
    .values({
      pageId,
      versionNumber: nextNumber,
      title: page.title,
      slugSnapshot: page.slug,
      document: page.draftDocument,
      seo: page.seo,
      note: opts.note?.trim() || null,
      source: opts.source ?? "manual",
      publishedBy: actor?.user.id ?? null,
    })
    .returning();

  const now = new Date();
  const [updated] = await db
    .update(pages)
    .set({
      status: "published",
      publishedVersionId: version.id,
      firstPublishedAt: page.firstPublishedAt ?? now,
      lastPublishedAt: now,
      scheduledPublishAt: null,
      updatedBy: actor?.user.id ?? page.updatedBy,
      updatedAt: now,
    })
    .where(eq(pages.id, pageId))
    .returning();

  const liveMedia = collectMediaIds(page.draftDocument);
  if (page.seo?.shareImageId) liveMedia.add(page.seo.shareImageId);
  await syncMediaReferencesForSource(siteId, "page_version", version.id, liveMedia);
  await syncPageTrackingPlacements(siteId, pageId, page.draftDocument);

  await pruneVersions(siteId, pageId, version.id);
  await invalidatePage(siteId, updated.slug);

  await recordAudit({
    action: "page_published",
    summary: `Published "${updated.title}" (v${nextNumber})`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
    detail: { versionNumber: nextNumber, note: opts.note, source: opts.source ?? "manual" },
  });

  return { page: updated, version };
}

export async function pruneVersions(pageId: string, keepLimit: number): Promise<number>;
export async function pruneVersions(
  siteId: string,
  pageId: string,
  keepVersionId?: string | null,
  keepLimit?: number,
): Promise<number>;
export async function pruneVersions(
  first: string,
  second: string | number,
  keepVersionId: string | null = null,
  keepLimit: number = KEEP.pageVersionsPerPage,
): Promise<number> {
  await ensureDb();
  let siteId = first;
  let pageId: string;
  let resolvedKeepVersionId = keepVersionId;
  let limit = keepLimit;

  if (typeof second === "number") {
    pageId = first;
    limit = second;
    const [row] = await db
      .select({ siteId: pages.siteId, publishedVersionId: pages.publishedVersionId })
      .from(pages)
      .where(eq(pages.id, pageId))
      .limit(1);
    if (!row) return 0;
    siteId = row.siteId;
    resolvedKeepVersionId = row.publishedVersionId;
  } else {
    pageId = second;
  }

  const all = await db
    .select({ id: pageVersions.id })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber));
  if (all.length <= limit) return 0;
  const victims = all
    .slice(limit)
    .map((r) => r.id)
    .filter((id) => id !== resolvedKeepVersionId);
  if (victims.length) {
    await db
      .delete(mediaReferences)
      .where(
        and(
          eq(mediaReferences.siteId, siteId),
          eq(mediaReferences.sourceType, "page_version"),
          inArray(mediaReferences.sourceId, victims),
        ),
      );
    await db.delete(pageVersions).where(inArray(pageVersions.id, victims));
  }
  return victims.length;
}

export async function unpublishPage(
  siteId: string,
  pageId: string,
  actor: Actor | null,
  options?: { source?: string },
): Promise<Page> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  if (page.status !== "published") {
    throw new LifecycleError(
      "page",
      page.status,
      "draft",
      "Only a published page can be unpublished.",
    );
  }

  const [updated] = await db
    .update(pages)
    .set({
      status: "draft",
      scheduledUnpublishAt: null,
      lockVersion: sql`${pages.lockVersion} + 1`,
      updatedBy: actor?.user.id ?? page.updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId))
    .returning();

  await db.delete(trackingPlacements).where(eq(trackingPlacements.pageId, pageId));
  await invalidatePage(siteId, updated.slug);
  await recordAudit({
    action: "page_unpublished",
    summary: `Took "${updated.title}" offline`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
    detail: options?.source ? { source: options.source } : {},
  });
  return updated;
}

export async function archivePage(
  siteId: string,
  pageId: string,
  actor: Actor,
): Promise<Page> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  assertTransition("page", page.status, "archived");

  const [updated] = await db
    .update(pages)
    .set({
      status: "archived",
      scheduledPublishAt: null,
      scheduledUnpublishAt: null,
      lockVersion: sql`${pages.lockVersion} + 1`,
      updatedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId))
    .returning();

  await db.delete(trackingPlacements).where(eq(trackingPlacements.pageId, pageId));
  await invalidatePage(siteId, updated.slug);
  await recordAudit({
    action: "page_archived",
    summary: `Archived "${updated.title}"`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
  return updated;
}

export async function rollbackToVersion(
  siteId: string,
  pageId: string,
  versionId: string,
  actor: Actor,
  republish = true,
): Promise<Page> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  const [version] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, pageId)))
    .limit(1);
  if (!version) throw new NotFoundError("Version not found.");

  const restoredDoc = migrateDocument(version.document);
  if (documentUsesAdminBlocks(restoredDoc).length > 0 && !can(actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can restore versions containing raw HTML or external embed blocks.",
    );
  }

  const [updated] = await db
    .update(pages)
    .set({
      draftDocument: restoredDoc,
      seo: version.seo,
      title: version.title,
      lockVersion: sql`${pages.lockVersion} + 1`,
      updatedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId))
    .returning();

  const draftMedia = collectMediaIds(restoredDoc);
  if (version.seo?.shareImageId) draftMedia.add(version.seo.shareImageId);
  await syncMediaReferencesForSource(siteId, "page_draft", updated.id, draftMedia);

  await recordAudit({
    action: "page_restored_version",
    summary: `Restored draft of "${page.title}" from v${version.versionNumber}`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
    detail: { versionNumber: version.versionNumber, republished: republish },
  });

  if (republish) {
    const res = await publishPage(siteId, pageId, actor, {
      note: `Rolled back to v${version.versionNumber}`,
      source: "rollback",
    });
    return res.page;
  }
  return updated;
}

export async function listPageVersions(pageId: string): Promise<PageVersion[]> {
  await ensureDb();
  return db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.versionNumber));
}

export async function listVersions(siteIdOrPageId: string, maybePageId?: string): Promise<PageVersion[]> {
  const pageId = maybePageId ?? siteIdOrPageId;
  return listPageVersions(pageId);
}

export async function getVersionById(siteId: string, versionId: string): Promise<PageVersion | null> {
  await ensureDb();
  const [row] = await db
    .select({ version: pageVersions, siteId: pages.siteId })
    .from(pageVersions)
    .innerJoin(pages, eq(pages.id, pageVersions.pageId))
    .where(and(eq(pageVersions.id, versionId), eq(pages.siteId, siteId)))
    .limit(1);
  return row?.version ?? null;
}

export async function duplicatePage(
  siteId: string,
  pageId: string,
  actor: Actor,
  targetSiteId?: string,
): Promise<Page> {
  await ensureDb();
  const source = await getPage(siteId, pageId);
  if (!source) throw new NotFoundError("Page not found.");
  const destination = targetSiteId ?? siteId;
  const copyDoc = cloneDocumentWithNewIds(migrateDocument(source.draftDocument));

  const baseSlug = source.isHomepage ? "/home-copy" : `${source.slug}-copy`;
  let candidate = baseSlug;
  let counter = 2;
  while (
    (
      await db
        .select({ id: pages.id })
        .from(pages)
        .where(
          and(
            eq(pages.siteId, destination),
            eq(pages.slug, candidate),
            isNull(pages.deletedAt),
          ),
        )
        .limit(1)
    ).length
  ) {
    candidate = `${baseSlug}-${counter++}`;
  }

  return createPage({
    siteId: destination,
    title: `${source.title} (Copy)`,
    slug: candidate,
    isHomepage: false,
    document: copyDoc,
    seo: source.seo,
    actor,
  });
}

export async function makeHomepage(
  siteId: string,
  pageId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const target = await getPage(siteId, pageId);
  if (!target) throw new NotFoundError("Page not found.");

  await db.transaction(async (tx) => {
    const [prevHome] = await tx
      .select()
      .from(pages)
      .where(
        and(eq(pages.siteId, siteId), eq(pages.isHomepage, true), isNull(pages.deletedAt)),
      )
      .limit(1);

    if (prevHome && prevHome.id !== pageId) {
      const displacedSlug =
        prevHome.slug === "/"
          ? normalizePath(prevHome.title) === "/"
            ? `/page-${prevHome.id.slice(0, 6)}`
            : normalizePath(prevHome.title)
          : prevHome.slug;
      await tx
        .update(pages)
        .set({ isHomepage: false, slug: displacedSlug, updatedAt: new Date() })
        .where(eq(pages.id, prevHome.id));
    }

    await tx
      .update(pages)
      .set({ isHomepage: true, slug: "/", updatedAt: new Date() })
      .where(eq(pages.id, pageId));
  });

  await invalidateSite(siteId);
  await recordAudit({
    action: "page_homepage_changed",
    summary: `Set "${target.title}" as homepage`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export async function softDeletePage(
  siteId: string,
  pageId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const page = await getPage(siteId, pageId);
  if (!page) return;
  if (page.isHomepage) {
    throw new ValidationError(
      "Promote another page to homepage before deleting the current homepage.",
    );
  }
  assertTransition("page", page.status, "deleted");
  await db
    .update(pages)
    .set({
      status: "deleted",
      publishedVersionId: null,
      scheduledPublishAt: null,
      scheduledUnpublishAt: null,
      deletedAt: new Date(),
      updatedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId));
  await Promise.all([
    cancelByKey("page.scheduled-publish", `publish:${pageId}`),
    cancelByKey("page.scheduled-unpublish", `unpublish:${pageId}`),
    db.delete(trackingPlacements).where(eq(trackingPlacements.pageId, pageId)),
    db
      .delete(mediaReferences)
      .where(
        and(
          eq(mediaReferences.siteId, siteId),
          eq(mediaReferences.sourceType, "page_draft"),
          eq(mediaReferences.sourceId, pageId),
        ),
      ),
    invalidatePage(siteId, page.slug),
  ]);
  await recordAudit({
    action: "page_deleted",
    summary: `Moved "${page.title}" to trash (restorable for ${KEEP.pageTrashDays} days)`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export async function restorePage(
  siteId: string,
  pageId: string,
  actor: Actor,
): Promise<Page> {
  await ensureDb();
  const page = await getPageIncludingDeleted(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  if (page.status === "draft" && !page.deletedAt) return page;
  assertTransition("page", page.status, "draft");

  let slug = page.slug;
  const collision = await db
    .select({ id: pages.id })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.slug, slug),
        isNull(pages.deletedAt),
        ne(pages.id, pageId),
      ),
    )
    .limit(1);
  if (collision.length) {
    slug = `${slug === "/" ? "/restored" : slug}-restored-${page.id.slice(0, 4)}`;
  }

  const [restored] = await db
    .update(pages)
    .set({
      status: "draft",
      slug,
      deletedAt: null,
      updatedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, pageId))
    .returning();

  const draftMedia = collectMediaIds(restored.draftDocument);
  if (restored.seo?.shareImageId) draftMedia.add(restored.seo.shareImageId);
  await syncMediaReferencesForSource(siteId, "page_draft", restored.id, draftMedia);

  await recordAudit({
    action: "page_restored",
    summary: `Restored "${restored.title}" from trash as draft at ${slug}`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
  return restored;
}

export async function purgePage(
  siteId: string,
  pageId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const page = await getPageIncludingDeleted(siteId, pageId);
  if (!page) throw new NotFoundError("Page not found.");
  if (page.status !== "deleted") {
    throw new ValidationError("Move the page to trash before permanently purging it.");
  }
  await db
    .delete(mediaReferences)
    .where(and(eq(mediaReferences.siteId, siteId), eq(mediaReferences.sourceId, pageId)));
  await db.delete(pages).where(eq(pages.id, pageId));
  await recordAudit({
    action: "page_purged",
    summary: `Permanently purged "${page.title}"`,
    siteId,
    actor,
    targetType: "page",
    targetId: pageId,
  });
}

export { emptyDocument as newPageDocument } from "@/lib/documents";
export const setHomepage = makeHomepage;

export async function saveDraft(
  siteId: string,
  pageId: string,
  document: PageDocument,
  expectedLockVersion: number,
  actor: Actor,
): Promise<Page> {
  return savePageDraft({
    siteId,
    pageId,
    document,
    expectedLockVersion,
    actor,
  });
}

export async function updatePageMeta(
  siteId: string,
  pageId: string,
  patch: { title?: string; slug?: string; seo?: Partial<PageSeo> },
  actor: Actor,
): Promise<Page> {
  const current = await getPage(siteId, pageId);
  if (!current) throw new NotFoundError("Page not found.");
  return savePageDraft({
    siteId,
    pageId,
    expectedLockVersion: current.lockVersion,
    title: patch.title ?? current.title,
    slug: patch.slug ?? current.slug,
    document: current.draftDocument,
    seo: patch.seo ? { ...current.seo, ...patch.seo } : current.seo,
    actor,
  });
}

export async function schedulePublish(input: {
  siteId: string;
  pageId: string;
  publishAt: Date | null;
  unpublishAt: Date | null;
  actor: Actor;
}): Promise<void> {
  await ensureDb();
  const page = await getPage(input.siteId, input.pageId);
  if (!page) throw new NotFoundError("Page not found.");

  await db
    .update(pages)
    .set({
      scheduledPublishAt: input.publishAt,
      scheduledUnpublishAt: input.unpublishAt,
      updatedBy: input.actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, input.pageId));

  await cancelByKey("page.scheduled-publish", `publish:${input.pageId}`);
  await cancelByKey("page.scheduled-unpublish", `unpublish:${input.pageId}`);

  if (input.publishAt) {
    await enqueue(
      "page.scheduled-publish",
      { siteId: input.siteId, pageId: input.pageId },
      { dedupeKey: `publish:${input.pageId}`, runAt: input.publishAt },
    );
  }
  if (input.unpublishAt) {
    await enqueue(
      "page.scheduled-unpublish",
      { siteId: input.siteId, pageId: input.pageId },
      { dedupeKey: `unpublish:${input.pageId}`, runAt: input.unpublishAt },
    );
  }

  await recordAudit({
    action: "page_scheduled",
    summary:
      input.publishAt || input.unpublishAt
        ? `Scheduled "${page.title}"${input.publishAt ? ` publish for ${input.publishAt.toISOString()}` : ""}${input.unpublishAt ? ` unpublish for ${input.unpublishAt.toISOString()}` : ""}`
        : `Cleared publish schedule on "${page.title}"`,
    siteId: input.siteId,
    actor: input.actor,
    targetType: "page",
    targetId: input.pageId,
  });
}
