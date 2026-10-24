import { describe, expect, it } from "vitest";
import { JOB_KINDS } from "@/lib/enums";
import { createSitePage, publishSitePage, schedulePagePublish } from "../pages";
import { createAccountSite } from "../sites";
import {
  invalidatePublicSiteCache,
  resolvePublishedPage,
} from "../public-site";
import { createTestWorkspaceFixture } from "../test-support";
import { JOB_HANDLERS, JOB_SCHEDULES, missingJobHandlers } from "./handlers";

describe("background job handlers", () => {
  it("registers a handler for every declared job kind", () => {
    expect(missingJobHandlers()).toEqual([]);
    expect(Object.keys(JOB_HANDLERS).sort()).toEqual([...JOB_KINDS].sort());
    expect(JOB_SCHEDULES).toHaveLength(JOB_KINDS.length);
    expect(
      JOB_SCHEDULES.every((schedule) => schedule.cron.trim().length > 0),
    ).toBe(true);
  });

  it("publishes due scheduled pages, unpublishes at the stop time, and drops the public cache", async () => {
    const ctx = await createTestWorkspaceFixture();
    const suffix = crypto.randomUUID().slice(0, 8);
    const site = await createAccountSite({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      name: `Jobs Site ${suffix}`,
      slug: `jobs-${suffix}`,
    });

    const page = await createSitePage({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      siteId: site.id,
      title: "Scheduled landing",
      slug: "/scheduled",
    });

    await schedulePagePublish({
      accountId: ctx.account.id,
      siteId: site.id,
      pageId: page.id,
      publishAt: new Date(Date.now() - 60_000),
      unpublishAt: null,
    });

    const publishOutcome = await JOB_HANDLERS["page.scheduled-publish"](
      new Date(),
    );
    expect(publishOutcome.kind).toBe("page.scheduled-publish");
    expect(publishOutcome.handled).toBeGreaterThanOrEqual(1);

    const live = await resolvePublishedPage({
      siteSlug: site.slug,
      pageSlug: "/scheduled",
    });
    expect(live?.pageId).toBe(page.id);

    await publishSitePage({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      siteId: site.id,
      pageId: page.id,
      note: "Publish for cache test",
    });
    const cached = await resolvePublishedPage({
      siteSlug: site.slug,
      pageSlug: "/scheduled",
    });
    expect(cached?.versionId).toBeTruthy();
    const dropped = await invalidatePublicSiteCache(site.id);
    expect(dropped).toBeGreaterThanOrEqual(1);

    await schedulePagePublish({
      accountId: ctx.account.id,
      siteId: site.id,
      pageId: page.id,
      publishAt: null,
      unpublishAt: new Date(Date.now() - 60_000),
    });
    const unpublishOutcome = await JOB_HANDLERS["page.scheduled-unpublish"](
      new Date(),
    );
    expect(unpublishOutcome.kind).toBe("page.scheduled-unpublish");
    expect(unpublishOutcome.handled).toBeGreaterThanOrEqual(1);
    expect(
      await resolvePublishedPage({
        siteSlug: site.slug,
        pageSlug: "/scheduled",
      }),
    ).toBeNull();
  });

  it("runs the sweeper, erasure replay, media sweep, and domain verification handlers", async () => {
    const now = new Date();
    const sweep = await JOB_HANDLERS["sweeper.daily"](now);
    expect(sweep.handled).toBeGreaterThanOrEqual(0);

    const erasure = await JOB_HANDLERS["privacy.erasure"](now);
    expect(erasure.kind).toBe("privacy.erasure");
    expect(erasure.handled).toBeGreaterThanOrEqual(0);

    const media = await JOB_HANDLERS["media.orphan-sweep"](now);
    expect(media.handled).toBeGreaterThanOrEqual(0);

    const domains = await JOB_HANDLERS["domain.verify"](now);
    expect(domains.kind).toBe("domain.verify");
    expect(domains.handled).toBeGreaterThanOrEqual(0);
  });
});
