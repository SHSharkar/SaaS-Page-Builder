import "server-only";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import {
  DEFAULT_PAGE_SEO,
  DEFAULT_SITE_THEME,
  emptyDocument,
  slugify,
  type SiteTheme,
} from "@/lib/documents";
import { deriveDurableScanCode } from "@/app/server/crypto";
import { getEnv } from "@/app/server/env";
import {
  pages,
  siteContents,
  siteDomains,
  sites,
  type SiteRow,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { assertTransition } from "@/app/server/lifecycle";

export function buildPlatformSubdomain(slug: string): string {
  return `${slug}.${getEnv().PLATFORM_DOMAIN}`;
}

export async function listAccountSites(accountId: string): Promise<SiteRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(sites)
      .where(and(isNull(sites.deletedAt), ne(sites.status, "deleted")))
      .orderBy(asc(sites.name)),
  );
}

export async function getAccountSite(
  accountId: string,
  siteId: string,
): Promise<SiteRow | null> {
  return withAccount(accountId, async (tx) => {
    const [row] = await tx
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)))
      .limit(1);
    return row ?? null;
  });
}

export async function createAccountSite(input: {
  accountId: string;
  actorUserId: string;
  name: string;
  slug?: string;
  theme?: Partial<SiteTheme>;
}): Promise<SiteRow> {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    throw new Error("Site name must be at least 2 characters");
  }
  const baseSlug = slugify(input.slug ?? cleanName);
  const siteId = crypto.randomUUID();
  const scanCode = deriveDurableScanCode(input.accountId, siteId);
  const theme: SiteTheme = {
    ...DEFAULT_SITE_THEME,
    logoText: cleanName.slice(0, 32),
    ...input.theme,
  };

  return withAccount(input.accountId, async (tx) => {
    const [created] = await tx
      .insert(sites)
      .values({
        id: siteId,
        accountId: input.accountId,
        name: cleanName,
        slug: baseSlug,
        scanCode,
        status: "active",
        theme,
        createdBy: input.actorUserId,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to insert site");
    }

    await tx.insert(siteDomains).values({
      accountId: input.accountId,
      siteId: created.id,
      hostname: buildPlatformSubdomain(created.slug),
      kind: "platform_subdomain",
      isPrimary: true,
      status: "active",
      certificateState: "issued",
      requestedBy: input.actorUserId,
      verifiedAt: new Date(),
    });

    await tx.insert(siteContents).values([
      {
        accountId: input.accountId,
        siteId: created.id,
        kind: "navigation",
        draftDocument: emptyDocument("Navigation"),
      },
      {
        accountId: input.accountId,
        siteId: created.id,
        kind: "footer",
        draftDocument: emptyDocument("Footer"),
      },
      {
        accountId: input.accountId,
        siteId: created.id,
        kind: "defaults",
        draftDocument: emptyDocument("Defaults"),
      },
    ]);

    const homeDoc = emptyDocument(cleanName);
    homeDoc.content.push({
      id: `blk_${crypto.randomUUID().slice(0, 8)}`,
      type: "hero-banner",
      props: {
        eyebrow: "Live site",
        headline: cleanName,
        subheadline: "Composed with structured blocks.",
        ctaLabel: "Learn more",
        ctaHref: "/features",
      },
    });

    await tx.insert(pages).values({
      accountId: input.accountId,
      siteId: created.id,
      slug: "/",
      title: "Home",
      isHomepage: true,
      status: "draft",
      draftDocument: homeDoc,
      seo: DEFAULT_PAGE_SEO,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    });

    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "site.created",
      targetType: "site",
      targetId: created.id,
      summary: `Created site "${created.name}" (${created.slug})`,
    });

    return created;
  });
}

export async function transitionSiteStatus(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  nextStatus: "active" | "suspended" | "deleted";
}): Promise<SiteRow> {
  return withAccount(input.accountId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, input.siteId))
      .limit(1);
    if (!existing) {
      throw new Error("Site not found");
    }
    assertTransition("site", existing.status, input.nextStatus);
    const [updated] = await tx
      .update(sites)
      .set({
        status: input.nextStatus,
        deletedAt: input.nextStatus === "deleted" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, input.siteId))
      .returning();
    if (!updated) {
      throw new Error("Failed to update site status");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: `site.${input.nextStatus}`,
      targetType: "site",
      targetId: updated.id,
      summary: `Changed site "${updated.name}" status to ${input.nextStatus}`,
    });
    return updated;
  });
}
