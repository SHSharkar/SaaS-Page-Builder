import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { KEEP_WINDOWS_DAYS } from "@/app/server/lifecycle";
import { authSessions, pages, shortLinks, sites } from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";

export interface PurgeWindowCounts {
  readonly purgedSites: number;
  readonly purgedPages: number;
  readonly purgedShortLinks: number;
  readonly purgedSessions: number;
}

export async function purgeExpiredKeepWindows(
  now = new Date(),
): Promise<PurgeWindowCounts> {
  const siteCutoff = new Date(
    now.getTime() - KEEP_WINDOWS_DAYS.siteTrash * 86_400 * 1_000,
  );
  const pageCutoff = new Date(
    now.getTime() - KEEP_WINDOWS_DAYS.pageTrash * 86_400 * 1_000,
  );

  return withPlatform(async (tx) => {
    const deletedPages = await tx
      .delete(pages)
      .where(and(eq(pages.status, "deleted"), lt(pages.deletedAt, pageCutoff)))
      .returning({ id: pages.id });

    const deletedSites = await tx
      .delete(sites)
      .where(and(eq(sites.status, "deleted"), lt(sites.deletedAt, siteCutoff)))
      .returning({ id: sites.id });

    const deletedLinks = await tx
      .delete(shortLinks)
      .where(lt(shortLinks.expiresAt, now))
      .returning({ id: shortLinks.id });

    const deletedSessions = await tx
      .delete(authSessions)
      .where(lt(authSessions.expiresAt, now))
      .returning({ id: authSessions.id });

    return {
      purgedSites: deletedSites.length,
      purgedPages: deletedPages.length,
      purgedShortLinks: deletedLinks.length,
      purgedSessions: deletedSessions.length,
    };
  });
}
