import "server-only";
import { count, eq } from "drizzle-orm";
import {
  pages,
  siteDomains,
  sites,
  trackingPlacements,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";

export async function getWorkspaceOverview(accountId: string) {
  return withAccount(accountId, async (tx) => {
    const [siteStat] = await tx
      .select({ total: count() })
      .from(sites)
      .where(eq(sites.status, "active"));
    const [publishedStat] = await tx
      .select({ total: count() })
      .from(pages)
      .where(eq(pages.status, "published"));
    const [domainStat] = await tx
      .select({ total: count() })
      .from(siteDomains)
      .where(eq(siteDomains.status, "active"));
    const [placementStat] = await tx
      .select({ total: count() })
      .from(trackingPlacements);
    return {
      activeSites: Number(siteStat?.total ?? 0),
      publishedPages: Number(publishedStat?.total ?? 0),
      verifiedDomains: Number(domainStat?.total ?? 0),
      trackedPlacements: Number(placementStat?.total ?? 0),
    };
  });
}
