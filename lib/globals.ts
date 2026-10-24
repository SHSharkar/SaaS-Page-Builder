import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { siteContents, type SiteContent } from "@/lib/db/schema";
import {
  assertDocumentSize,
  DOCUMENT_SCHEMA_VERSION,
  migrateDocument,
  newBlockId,
  type PageDocument,
  type PageSeo,
} from "@/lib/documents";
import { defaultPropsFor, documentUsesAdminBlocks } from "@/lib/registry";
import { collectMediaIds } from "@/lib/media/refs";
import { syncMediaReferencesForSource } from "@/lib/media";
import { can } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheGet, cacheKeys, cacheSet, invalidateSite } from "@/lib/cache";
import { ConflictError, ForbiddenError } from "@/lib/errors";

export type GlobalKind = "navigation" | "footer" | "defaults";

export const GLOBAL_LABELS: Record<GlobalKind, string> = {
  navigation: "Navigation header",
  footer: "Site footer",
  defaults: "Default SEO tags",
};

export async function listSiteContents(siteId: string): Promise<SiteContent[]> {
  await ensureDb();
  return db.select().from(siteContents).where(eq(siteContents.siteId, siteId));
}

export function starterNavigationDocument(siteName: string): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content: [
      {
        type: "site-header",
        props: {
          ...defaultPropsFor("site-header"),
          id: newBlockId("site-header"),
          brandName: siteName,
        },
      },
    ],
  };
}

export function starterFooterDocument(siteName: string): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content: [
      {
        type: "site-footer",
        props: {
          ...defaultPropsFor("site-footer"),
          id: newBlockId("site-footer"),
          brandName: siteName,
        },
      },
    ],
  };
}

export async function getSiteGlobals(
  siteId: string,
): Promise<Record<GlobalKind, SiteContent | null>> {
  await ensureDb();
  const rows = await db.select().from(siteContents).where(eq(siteContents.siteId, siteId));
  const out: Record<GlobalKind, SiteContent | null> = {
    navigation: null,
    footer: null,
    defaults: null,
  };
  for (const r of rows) out[r.kind] = r;
  return out;
}

export async function getPublishedGlobals(
  siteId: string,
): Promise<Record<GlobalKind, PageDocument | null>> {
  const key = cacheKeys.globals(siteId);
  const cached = await cacheGet<Record<GlobalKind, PageDocument | null>>(key);
  if (cached) return cached;

  const rows = await getSiteGlobals(siteId);
  const value: Record<GlobalKind, PageDocument | null> = {
    navigation: rows.navigation?.publishedDocument
      ? migrateDocument(rows.navigation.publishedDocument)
      : null,
    footer: rows.footer?.publishedDocument
      ? migrateDocument(rows.footer.publishedDocument)
      : null,
    defaults: rows.defaults?.publishedDocument
      ? migrateDocument(rows.defaults.publishedDocument)
      : null,
  };
  await cacheSet(key, value, 120);
  return value;
}

export const defaultHeaderDocument = starterNavigationDocument;
export const defaultFooterDocument = starterFooterDocument;

export function defaultDisclosureDocument(siteName: string): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { seo: { title: `${siteName} - Official Site` } } },
    content: [],
  };
}

export async function ensureDefaultGlobals(
  siteId: string,
  siteName = "Trofeo",
): Promise<Record<GlobalKind, SiteContent | null>> {
  await ensureDb();
  for (const kind of ["navigation", "footer", "defaults"] as const) {
    const fallback =
      kind === "navigation"
        ? starterNavigationDocument(siteName)
        : kind === "footer"
          ? starterFooterDocument(siteName)
          : defaultDisclosureDocument(siteName);
    await db
      .insert(siteContents)
      .values({ siteId, kind, draftDocument: fallback })
      .onConflictDoNothing();
  }
  return getSiteGlobals(siteId);
}

export const GLOBAL_INFO: Record<GlobalKind, { label: string; description: string }> = {
  navigation: {
    label: "Site navigation",
    description: "Top navigation bar, brand mark, links, and primary call to action.",
  },
  footer: {
    label: "Site footer",
    description: "Columns of links, licensing text, and responsible-play notice.",
  },
  defaults: {
    label: "Site defaults",
    description: "Fallback search title, description, and site-wide disclosure copy.",
  },
};

export async function getSiteContent(
  siteId: string,
  kind: GlobalKind,
): Promise<{
  kind: GlobalKind;
  document: PageDocument;
  publishedDocument: PageDocument | null;
  lockVersion: number;
  updatedAt: Date;
}> {
  const globals = await ensureDefaultGlobals(siteId);
  const row = globals[kind];
  const fallback =
    kind === "navigation"
      ? starterNavigationDocument("Trofeo")
      : kind === "footer"
        ? starterFooterDocument("Trofeo")
        : defaultDisclosureDocument("Trofeo");
  return {
    kind,
    document: migrateDocument(row?.draftDocument ?? row?.publishedDocument ?? fallback),
    publishedDocument: row?.publishedDocument ? migrateDocument(row.publishedDocument) : null,
    lockVersion: row?.lockVersion ?? 0,
    updatedAt: row?.updatedAt ?? new Date(),
  };
}

export const loadSiteGlobals = getSiteGlobals;
export const saveSiteContent = saveGlobalsDraft;

export async function saveGlobalsDraft(
  siteId: string,
  kind: GlobalKind,
  doc: PageDocument,
  actor: Actor,
  expectedLockVersion?: number,
): Promise<SiteContent> {
  await ensureDb();
  const migrated = migrateDocument(doc);
  if (documentUsesAdminBlocks(migrated).length > 0 && !can(actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can save site globals containing raw HTML or external embed blocks.",
    );
  }
  assertDocumentSize(migrated);

  const [existing] = await db
    .select()
    .from(siteContents)
    .where(and(eq(siteContents.siteId, siteId), eq(siteContents.kind, kind)))
    .limit(1);

  if (!existing) {
    const [inserted] = await db
      .insert(siteContents)
      .values({ siteId, kind, draftDocument: migrated, updatedBy: actor.user.id })
      .returning();
    const refs = collectMediaIds(migrated);
    await syncMediaReferencesForSource(siteId, "site_content", inserted.id, refs);
    return inserted;
  }

  const whereClause =
    expectedLockVersion !== undefined
      ? and(eq(siteContents.id, existing.id), eq(siteContents.lockVersion, expectedLockVersion))
      : eq(siteContents.id, existing.id);

  const updatedRows = await db
    .update(siteContents)
    .set({
      draftDocument: migrated,
      lockVersion: sql`${siteContents.lockVersion} + 1`,
      updatedBy: actor.user.id,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning();

  if (!updatedRows.length) {
    throw new ConflictError(
      "Someone else saved these shared settings while they were open. Reload before saving again.",
    );
  }

  const updated = updatedRows[0];
  const refs = collectMediaIds(updated.draftDocument);
  collectMediaIds(updated.publishedDocument, refs);
  await syncMediaReferencesForSource(siteId, "site_content", updated.id, refs);

  return updated;
}

export async function publishGlobals(
  siteId: string,
  kind: GlobalKind,
  actor: Actor,
): Promise<SiteContent> {
  await ensureDb();
  const [existing] = await db
    .select()
    .from(siteContents)
    .where(and(eq(siteContents.siteId, siteId), eq(siteContents.kind, kind)))
    .limit(1);
  const draft = existing?.draftDocument
    ? migrateDocument(existing.draftDocument)
    : kind === "navigation"
      ? starterNavigationDocument("Site")
      : starterFooterDocument("Site");

  if (documentUsesAdminBlocks(draft).length > 0 && !can(actor, "catalog.admin_blocks")) {
    throw new ForbiddenError(
      "Only administrators can publish site globals containing raw HTML or external embed blocks.",
    );
  }
  assertDocumentSize(draft);

  let updated: SiteContent;
  if (!existing) {
    [updated] = await db
      .insert(siteContents)
      .values({
        siteId,
        kind,
        draftDocument: draft,
        publishedDocument: draft,
        publishedAt: new Date(),
        updatedBy: actor.user.id,
      })
      .returning();
  } else {
    [updated] = await db
      .update(siteContents)
      .set({
        draftDocument: draft,
        publishedDocument: draft,
        publishedAt: new Date(),
        lockVersion: sql`${siteContents.lockVersion} + 1`,
        updatedBy: actor.user.id,
        updatedAt: new Date(),
      })
      .where(eq(siteContents.id, existing.id))
      .returning();
  }

  const refs = collectMediaIds(updated.draftDocument);
  collectMediaIds(updated.publishedDocument, refs);
  await syncMediaReferencesForSource(siteId, "site_content", updated.id, refs);

  await invalidateSite(siteId);
  await recordAudit({
    action: "globals_published",
    summary: `Published site ${kind}`,
    siteId,
    actor,
    targetType: "site_content",
    targetId: updated.id,
  });
  return updated;
}

export async function saveDefaultSeo(
  siteId: string,
  seo: Partial<PageSeo>,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const doc: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { seo } },
    content: [],
  };
  const [existing] = await db
    .select()
    .from(siteContents)
    .where(and(eq(siteContents.siteId, siteId), eq(siteContents.kind, "defaults")))
    .limit(1);
  if (!existing) {
    await db.insert(siteContents).values({
      siteId,
      kind: "defaults",
      draftDocument: doc,
      publishedDocument: doc,
      publishedAt: new Date(),
      updatedBy: actor.user.id,
    });
  } else {
    await db
      .update(siteContents)
      .set({
        draftDocument: doc,
        publishedDocument: doc,
        publishedAt: new Date(),
        lockVersion: sql`${siteContents.lockVersion} + 1`,
        updatedBy: actor.user.id,
        updatedAt: new Date(),
      })
      .where(eq(siteContents.id, existing.id));
  }
  await invalidateSite(siteId);
  await recordAudit({
    action: "seo_defaults_saved",
    summary: "Updated site-wide default SEO",
    siteId,
    actor,
    targetType: "site",
    targetId: siteId,
  });
}

export async function getDefaultSeo(siteId: string): Promise<Partial<PageSeo>> {
  const globals = await getSiteGlobals(siteId);
  const props = globals.defaults?.publishedDocument?.root?.props as
    | { seo?: Partial<PageSeo> }
    | undefined;
  return props?.seo ?? {};
}
