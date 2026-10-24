import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { siteContents, type SiteContent } from "@/lib/db/schema";
import type { PageDocument, PageSeo } from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheGet, cacheKeys, cacheSet, invalidateGlobals } from "@/lib/cache";
import { primeGlobalDocuments } from "@/lib/pages";
import { validateDocument } from "@/lib/registry";

export type GlobalKind = "navigation" | "footer" | "defaults";

export const GLOBAL_LABELS: Record<GlobalKind, string> = {
  navigation: "Navigation bar",
  footer: "Footer",
  defaults: "Default search tags",
};

export async function getSiteContent(siteId: string, kind: GlobalKind): Promise<SiteContent | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(siteContents)
    .where(and(eq(siteContents.siteId, siteId), eq(siteContents.kind, kind)))
    .limit(1);
  return row ?? null;
}

export async function listSiteContents(siteId: string): Promise<SiteContent[]> {
  await ensureDb();
  return db.select().from(siteContents).where(eq(siteContents.siteId, siteId));
}

export async function getDefaultSeo(siteId: string): Promise<Partial<PageSeo>> {
  const content = await getSiteContent(siteId, "defaults");
  const document = content?.draftDocument ?? content?.publishedDocument;
  const seo = (document?.root?.props as Record<string, unknown> | undefined)?.seo;
  return (seo ?? {}) as Partial<PageSeo>;
}

export type PublishedGlobals = {
  navigation: PageDocument | null;
  footer: PageDocument | null;
  defaults: PageDocument | null;
};

export async function getPublishedGlobals(siteId: string): Promise<PublishedGlobals> {
  await ensureDb();
  const cached = cacheGet<PublishedGlobals>(cacheKeys.globals(siteId));
  if (cached) {
    primeGlobalDocuments(cached);
    return cached;
  }
  const rows = await db.select().from(siteContents).where(eq(siteContents.siteId, siteId));
  const globals: PublishedGlobals = {
    navigation: rows.find((row) => row.kind === "navigation")?.publishedDocument ?? null,
    footer: rows.find((row) => row.kind === "footer")?.publishedDocument ?? null,
    defaults: rows.find((row) => row.kind === "defaults")?.publishedDocument ?? null,
  };
  cacheSet(cacheKeys.globals(siteId), globals, 60_000);
  return globals;
}

export async function saveGlobalsDraft(
  siteId: string,
  kind: GlobalKind,
  document: unknown,
  lockVersion: number,
  actor: Actor,
): Promise<{ lockVersion: number }> {
  await ensureDb();
  const row = await getSiteContent(siteId, kind);
  if (!row) throw new Error("That site content record does not exist.");
  if (row.lockVersion !== lockVersion) {
    throw new Error("Someone else saved this content after you opened it. Refresh before saving.");
  }
  const validation = validateDocument(document);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const [updated] = await db
    .update(siteContents)
    .set({
      draftDocument: validation.document,
      lockVersion: row.lockVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(siteContents.id, row.id))
    .returning();

  await recordAudit({
    action: "globals_updated",
    summary: `Updated the draft ${GLOBAL_LABELS[kind].toLowerCase()}`,
    siteId,
    actor,
    targetType: "site_content",
    targetId: row.id,
  });

  return { lockVersion: updated.lockVersion };
}

export async function publishGlobals(siteId: string, kind: GlobalKind, actor: Actor): Promise<void> {
  await ensureDb();
  const row = await getSiteContent(siteId, kind);
  if (!row) throw new Error("That site content record does not exist.");
  const document = row.draftDocument ?? row.publishedDocument;
  if (!document) throw new Error("Nothing to publish yet — add blocks first.");
  const validation = validateDocument(document);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  await db
    .update(siteContents)
    .set({
      publishedDocument: validation.document,
      publishedAt: new Date(),
      publishedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(eq(siteContents.id, row.id));

  invalidateGlobals(siteId);

  await recordAudit({
    action: "globals_published",
    summary: `Published the ${GLOBAL_LABELS[kind].toLowerCase()} to every page`,
    siteId,
    actor,
    targetType: "site_content",
    targetId: row.id,
  });
}
