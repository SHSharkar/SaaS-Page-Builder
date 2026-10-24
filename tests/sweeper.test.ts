import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, pages, sites } from "@/lib/db/schema";
import {
  createSite,
  getSite,
  listDeletedSites,
  listSites,
  purgeSite,
  restoreSite,
  setSiteStatus,
} from "@/lib/sites";
import {
  createPage,
  listVersions,
  newPageDocument,
  pruneVersions,
  publishPage,
  saveDraft,
} from "@/lib/pages";
import { cleanupPreview, runDailyCleanup } from "@/lib/sweeper";
import { daysAgo, KEEP } from "@/lib/lifecycle";
import type { Actor } from "@/lib/auth/session";
import { adminActor } from "./support/actor";

let actor: Actor;

function doc(text: string) {
  return {
    ...newPageDocument(),
    content: [
      {
        type: "hero",
        props: { id: `hero-${Math.random().toString(36).slice(2)}`, headline: text },
      },
    ],
  };
}

beforeAll(async () => {
  await ensureDb();
  actor = await adminActor();
});

describe("soft delete and restore", () => {
  it("hides a deleted site from the live list, shows it in trash, and brings it back", async () => {
    const site = await createSite({
      name: "Soft Delete",
      slug: `soft-${Date.now()}`,
      createdBy: actor.user.id,
    });

    await setSiteStatus(site.id, "deleted");
    expect(await getSite(site.id)).toBeNull();
    expect((await listSites()).find((row) => row.site.id === site.id)).toBeUndefined();

    const deleted = await listDeletedSites();
    const entry = deleted.find((row) => row.site.id === site.id);
    expect(entry).toBeTruthy();
    expect(entry?.restorableUntil).toBeInstanceOf(Date);

    await restoreSite(site.id);
    expect((await getSite(site.id))?.status).toBe("active");
  });

  it("refuses to purge a site that has not been deleted first", async () => {
    const site = await createSite({
      name: "Still Live",
      slug: `live-${Date.now()}`,
      createdBy: actor.user.id,
    });
    await expect(purgeSite(site.id)).rejects.toThrow(/deleted/);
    expect(await getSite(site.id)).not.toBeNull();
  });
});

describe("the daily sweeper", () => {
  it("previews without changing anything", async () => {
    const before = await cleanupPreview();
    const after = await cleanupPreview();
    expect(after).toEqual(before);
  });

  it("purges a site once the restore window has closed", async () => {
    const site = await createSite({
      name: "Expired",
      slug: `expired-${Date.now()}`,
      createdBy: actor.user.id,
    });
    await db
      .update(sites)
      .set({ status: "deleted", deletedAt: daysAgo(KEEP.siteRestoreDays + 1) })
      .where(eq(sites.id, site.id));

    expect((await cleanupPreview()).purgeableSites).toBeGreaterThan(0);
    const first = await runDailyCleanup(actor);
    expect(first.sitesPurged).toBeGreaterThan(0);
    expect(await getSite(site.id)).toBeNull();
  });

  it("is repeat-safe: a second pass finds nothing", async () => {
    const first = await runDailyCleanup(actor);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await runDailyCleanup(actor);
    expect(second.sessionsRemoved).toBe(0);
    expect(second.invitesExpired).toBe(0);
    expect(second.versionsPruned).toBe(0);
    expect(second.importJobsRemoved).toBe(0);
    expect(second.importFilesRemoved).toBe(0);
    expect(second.pendingMediaRemoved).toBe(0);
    expect(second.sitesPurged).toBe(0);
    expect(second.domainsForgotten).toBe(0);
    expect(first.ranAt).not.toBe(second.ranAt);
  });

  it("trims snapshots past a cap but never the live one", async () => {
    const site = await createSite({
      name: "Snapshots",
      slug: `snapshots-${Date.now()}`,
      createdBy: actor.user.id,
    });
    const page = await createPage({ siteId: site.id, title: "Many", slug: "many", actor });
    let lock = page.lockVersion;

    for (let index = 0; index < 12; index += 1) {
      lock = (await saveDraft(site.id, page.id, doc(`Version ${index}`), lock, actor)).lockVersion;
      await publishPage(site.id, page.id, actor);
    }
    expect((await listVersions(site.id, page.id)).length).toBe(12);

    expect(await pruneVersions(page.id, 5)).toBe(7);
    const remaining = await listVersions(site.id, page.id);
    expect(remaining.length).toBe(5);

    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(remaining.map((version) => version.id)).toContain(row.publishedVersionId);

    const result = await runDailyCleanup(actor);
    expect(result.versionsPruned).toBe(0);
    expect((await listVersions(site.id, page.id)).length).toBe(5);
  });

  it("forgets a removed hostname after 90 days", async () => {
    const site = await createSite({
      name: "Domains",
      slug: `domains-${Date.now()}`,
      createdBy: actor.user.id,
    });
    await db.insert(domains).values({
      siteId: site.id,
      hostname: `gone-${Date.now()}.example`,
      status: "removed",
      removedAt: daysAgo(KEEP.removedDomainDays + 1),
    });
    const result = await runDailyCleanup(actor);
    expect(result.domainsForgotten).toBeGreaterThan(0);
  });

  it("keeps a hostname that was removed yesterday", async () => {
    const site = await createSite({
      name: "Domains 2",
      slug: `domains-two-${Date.now()}`,
      createdBy: actor.user.id,
    });
    const hostname = `recent-${Date.now()}.example`;
    await db.insert(domains).values({
      siteId: site.id,
      hostname,
      status: "removed",
      removedAt: daysAgo(1),
    });
    await runDailyCleanup(actor);
    const rows = await db.select().from(domains).where(eq(domains.hostname, hostname));
    expect(rows).toHaveLength(1);
  });
});
