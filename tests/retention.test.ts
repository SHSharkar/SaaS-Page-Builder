import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, pages, pageVersions, sites, users } from "@/lib/db/schema";
import { createSite, getSite, listDeletedSites, purgeSite, restoreSite } from "@/lib/sites";
import { createPage, publishPage, pruneVersions, saveDraft, listVersions, newPageDocument } from "@/lib/pages";
import { runDailyCleanup, cleanupPreview } from "@/lib/retention";
import { KEEP, daysAgo } from "@/lib/lifecycle";
import type { Actor } from "@/lib/auth/session";
import { adminActor } from "./support/actor";

let actor: Actor;

beforeAll(async () => {
  await ensureDb();
  actor = await adminActor();
});

function doc(text: string) {
  return {
    ...newPageDocument(),
    content: [{ type: "hero", props: { id: `hero-${Math.random().toString(36).slice(2)}`, headline: text } }],
  };
}

describe("site deletion is two-staged", () => {
  it("stops serving immediately but keeps the rows", async () => {
    const site = await createSite({ name: "Two stage", slug: `two-stage-${Date.now()}`, createdBy: actor.user.id });
    const page = await createPage({ siteId: site.id, title: "Live", slug: "live", actor });
    await saveDraft(site.id, page.id, doc("Live"), page.lockVersion, actor);
    await publishPage(site.id, page.id, actor);

    await db.update(sites).set({ status: "deleted", deletedAt: new Date() }).where(eq(sites.id, site.id));

    const deleted = await listDeletedSites();
    expect(deleted.map((row) => row.site.id)).toContain(site.id);
    // The pages are still there: this is a soft delete.
    expect(await db.select().from(pages).where(eq(pages.siteId, site.id))).toHaveLength(1);
  });

  it("restores a freshly deleted site", async () => {
    const site = await createSite({ name: "Restore me", slug: `restore-me-${Date.now()}`, createdBy: actor.user.id });
    await db.update(sites).set({ status: "deleted", deletedAt: new Date() }).where(eq(sites.id, site.id));
    const restored = await restoreSite(site.id);
    expect(restored.status).toBe("active");
    expect(restored.deletedAt).toBeNull();
    expect((await listDeletedSites()).map((row) => row.site.id)).not.toContain(site.id);
  });

  it("refuses to restore a site that was never deleted", async () => {
    const site = await createSite({ name: "Still here", slug: `still-here-${Date.now()}`, createdBy: actor.user.id });
    await expect(restoreSite(site.id)).rejects.toThrow(/not deleted/);
  });

  it("purges on demand, cascading to pages and snapshots", async () => {
    const site = await createSite({ name: "Purge me", slug: `purge-me-${Date.now()}`, createdBy: actor.user.id });
    const page = await createPage({ siteId: site.id, title: "Doomed", slug: "doomed", actor });
    await saveDraft(site.id, page.id, doc("Doomed"), page.lockVersion, actor);
    await publishPage(site.id, page.id, actor);
    await db.update(sites).set({ status: "deleted", deletedAt: new Date() }).where(eq(sites.id, site.id));

    await purgeSite(site.id);
    expect(await getSite(site.id)).toBeNull();
    expect(await db.select().from(pages).where(eq(pages.siteId, site.id))).toHaveLength(0);
    expect(await db.select().from(pageVersions).where(eq(pageVersions.pageId, page.id))).toHaveLength(0);
  });

  it("leaves a live site alone when a purge is aimed at it", async () => {
    const site = await createSite({ name: "Live site", slug: `live-site-${Date.now()}`, createdBy: actor.user.id });
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
    const site = await createSite({ name: "Expired", slug: `expired-${Date.now()}`, createdBy: actor.user.id });
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
    const second = await runDailyCleanup(actor);
    expect(second.sessionsRemoved).toBe(0);
    expect(second.invitesExpired).toBe(0);
    expect(second.versionsPruned).toBe(0);
    expect(second.importJobsRemoved).toBe(0);
    expect(second.importFilesRemoved).toBe(0);
    expect(second.pendingMediaRemoved).toBe(0);
    expect(second.sitesPurged).toBe(0);
    expect(second.domainsForgotten).toBe(0);
    // Only the audit log grows, because every pass records that it ran.
    expect(first.ranAt).not.toBe(second.ranAt);
  });

  it("trims snapshots past a cap but never the live one", async () => {
    const site = await createSite({ name: "Snapshots", slug: `snapshots-${Date.now()}`, createdBy: actor.user.id });
    const page = await createPage({ siteId: site.id, title: "Many", slug: "many", actor });
    let lock = page.lockVersion;
    // Under the 30-per-hour publish throttle on purpose; the cap itself is exercised below.
    for (let index = 0; index < 12; index += 1) {
      lock = (await saveDraft(site.id, page.id, doc(`Version ${index}`), lock, actor)).lockVersion;
      await publishPage(site.id, page.id, actor);
    }
    expect((await listVersions(page.id)).length).toBe(12);

    expect(await pruneVersions(page.id, 5)).toBe(7);
    const remaining = await listVersions(page.id);
    expect(remaining.length).toBe(5);
    // Newest first: the live pointer is still present.
    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(remaining.map((version) => version.id)).toContain(row.currentPublishedVersionId);

    // The sweeper leaves a page under the default cap untouched.
    const result = await runDailyCleanup(actor);
    expect(result.versionsPruned).toBe(0);
    expect((await listVersions(page.id)).length).toBe(5);
  });

  it("forgets a removed hostname after a quarter", async () => {
    const site = await createSite({ name: "Domains", slug: `domains-${Date.now()}`, createdBy: actor.user.id });
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
    const site = await createSite({ name: "Domains 2", slug: `domains-two-${Date.now()}`, createdBy: actor.user.id });
    const hostname = `recent-${Date.now()}.example`;
    await db.insert(domains).values({ siteId: site.id, hostname, status: "removed", removedAt: daysAgo(1) });
    await runDailyCleanup(actor);
    const rows = await db.select().from(domains).where(eq(domains.hostname, hostname));
    expect(rows).toHaveLength(1);
  });
});
