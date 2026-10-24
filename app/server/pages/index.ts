import "server-only";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import {
  DEFAULT_PAGE_SEO,
  emptyDocument,
  normalizePath,
  type PageDocument,
  type PageSeo,
} from "@/lib/documents";
import {
  collectTrackingPlacements,
  documentAdminBlockAliases,
  validateDocument,
} from "@/lib/registry";
import {
  pageVersions,
  pages,
  trackingPlacements,
  type PageRow,
  type PageVersionRow,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { cacheDelKeys } from "@/app/server/redis/client";

export async function listSitePages(
  accountId: string,
  siteId: string,
): Promise<PageRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          isNull(pages.deletedAt),
          ne(pages.status, "deleted"),
        ),
      )
      .orderBy(desc(pages.isHomepage), asc(pages.position), asc(pages.title)),
  );
}

export async function getSitePage(
  accountId: string,
  siteId: string,
  pageId: string,
): Promise<PageRow | null> {
  return withAccount(accountId, async (tx) => {
    const [row] = await tx
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.id, pageId),
          isNull(pages.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

export async function createSitePage(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  title: string;
  slug: string;
  document?: PageDocument;
}): Promise<PageRow> {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error("Page title is required");
  }
  const normalizedSlug = normalizePath(input.slug);
  const doc = input.document ?? emptyDocument(cleanTitle);
  const check = validateDocument(doc);
  if (!check.valid) {
    throw new Error(check.errors.join("; "));
  }

  return withAccount(input.accountId, async (tx) => {
    const [created] = await tx
      .insert(pages)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        slug: normalizedSlug,
        title: cleanTitle,
        status: "draft",
        isHomepage: normalizedSlug === "/",
        draftDocument: doc,
        seo: DEFAULT_PAGE_SEO,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create page");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "page.created",
      targetType: "page",
      targetId: created.id,
      summary: `Created page "${created.title}" (${created.slug})`,
    });
    return created;
  });
}

export async function savePageDraft(input: {
  accountId: string;
  actorUserId: string;
  allowAdminBlocks: boolean;
  siteId: string;
  pageId: string;
  expectedLockVersion: number;
  title: string;
  document: PageDocument;
  seo?: PageSeo;
}): Promise<PageRow> {
  const validation = validateDocument(input.document);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
  const restricted = documentAdminBlockAliases(input.document);
  if (restricted.length > 0 && !input.allowAdminBlocks) {
    throw new Error(
      `Admin block capability required for: ${restricted.join(", ")}`,
    );
  }

  return withAccount(input.accountId, async (tx) => {
    const [current] = await tx
      .select()
      .from(pages)
      .where(and(eq(pages.id, input.pageId), eq(pages.siteId, input.siteId)))
      .limit(1);
    if (!current) {
      throw new Error("Page not found");
    }
    if (current.lockVersion !== input.expectedLockVersion) {
      throw new Error("Optimistic lock conflict: reload latest draft");
    }

    const [updated] = await tx
      .update(pages)
      .set({
        title: input.title.trim() || current.title,
        draftDocument: input.document,
        seo: input.seo ?? current.seo,
        lockVersion: current.lockVersion + 1,
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pages.id, input.pageId),
          eq(pages.lockVersion, input.expectedLockVersion),
        ),
      )
      .returning();
    if (!updated) {
      throw new Error("Optimistic lock conflict during draft update");
    }

    const placements = collectTrackingPlacements(input.document);
    for (const p of placements) {
      await tx.insert(trackingPlacements).values({
        accountId: input.accountId,
        siteId: input.siteId,
        pageId: input.pageId,
        blockId: p.blockId,
        blockType: p.blockType,
        label: p.label,
        destinationUrl: p.destinationUrl,
        trackingId: p.trackingId,
      });
    }

    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "page.draft_saved",
      targetType: "page",
      targetId: updated.id,
      summary: `Saved draft v${updated.lockVersion} for "${updated.title}"`,
    });
    return updated;
  });
}

export async function publishSitePage(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  pageId: string;
  note?: string;
}): Promise<PageVersionRow> {
  const version = await withAccount(input.accountId, async (tx) => {
    const [page] = await tx
      .select()
      .from(pages)
      .where(and(eq(pages.id, input.pageId), eq(pages.siteId, input.siteId)))
      .limit(1);
    if (!page) {
      throw new Error("Page not found");
    }
    const check = validateDocument(page.draftDocument);
    if (!check.valid) {
      throw new Error(check.errors.join("; "));
    }

    const priorVersions = await tx
      .select({ num: pageVersions.versionNumber })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, page.id))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(1);
    const nextNumber = (priorVersions[0]?.num ?? 0) + 1;

    const [createdVersion] = await tx
      .insert(pageVersions)
      .values({
        accountId: input.accountId,
        pageId: page.id,
        versionNumber: nextNumber,
        document: page.draftDocument,
        seo: page.seo,
        title: page.title,
        slugSnapshot: page.slug,
        source: "publish",
        note: input.note ?? null,
        publishedBy: input.actorUserId,
      })
      .returning();
    if (!createdVersion) {
      throw new Error("Failed to record page version");
    }

    const now = new Date();
    await tx
      .update(pages)
      .set({
        status: "published",
        publishedVersionId: createdVersion.id,
        firstPublishedAt: page.firstPublishedAt ?? now,
        lastPublishedAt: now,
        lockVersion: page.lockVersion + 1,
        updatedBy: input.actorUserId,
        updatedAt: now,
      })
      .where(eq(pages.id, page.id));

    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "page.published",
      targetType: "page",
      targetId: page.id,
      summary: `Published version #${nextNumber} of "${page.title}"`,
    });

    return createdVersion;
  });

  await cacheDelKeys(`pub:site:${input.siteId}`);
  return version;
}

export async function rollbackPageToVersion(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  pageId: string;
  versionId: string;
}): Promise<PageVersionRow> {
  return withAccount(input.accountId, async (tx) => {
    const [target] = await tx
      .select()
      .from(pageVersions)
      .where(
        and(
          eq(pageVersions.id, input.versionId),
          eq(pageVersions.pageId, input.pageId),
        ),
      )
      .limit(1);
    if (!target) {
      throw new Error("Target version not found");
    }

    const latest = await tx
      .select({ num: pageVersions.versionNumber })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, input.pageId))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(1);
    const nextNumber = (latest[0]?.num ?? 0) + 1;

    const [rolled] = await tx
      .insert(pageVersions)
      .values({
        accountId: input.accountId,
        pageId: input.pageId,
        versionNumber: nextNumber,
        document: target.document,
        seo: target.seo,
        title: target.title,
        slugSnapshot: target.slugSnapshot,
        source: "rollback",
        note: `Rollback to version #${target.versionNumber}`,
        publishedBy: input.actorUserId,
      })
      .returning();
    if (!rolled) {
      throw new Error("Failed to insert rollback version");
    }

    await tx
      .update(pages)
      .set({
        status: "published",
        publishedVersionId: rolled.id,
        draftDocument: target.document,
        lastPublishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(pages.id, input.pageId), eq(pages.siteId, input.siteId)));

    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "page.rolled_back",
      targetType: "page",
      targetId: input.pageId,
      summary: `Rolled back to version #${target.versionNumber} as #${nextNumber}`,
    });
    return rolled;
  });
}
