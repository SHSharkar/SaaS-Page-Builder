import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { createSite } from "@/lib/sites";
import {
  archivePage,
  createPage,
  listPagesWithCounts,
  listVersions,
  newPageDocument,
  publishPage,
  restorePage,
  rollbackToVersion,
  saveDraft,
  setHomepage,
  unpublishPage,
  updatePageMeta,
} from "@/lib/pages";
import { LifecycleError } from "@/lib/errors";
import type { Actor } from "@/lib/auth/session";
import { adminActor } from "./support/actor";

let actor: Actor;
let siteId: string;

function documentWith(text: string) {
  return {
    ...newPageDocument(),
    content: [
      {
        type: "hero",
        props: { id: `hero-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...(text ? { headline: text } : {}) },
      },
    ],
  };
}

beforeAll(async () => {
  await ensureDb();
  actor = await adminActor();
  const site = await createSite({
    name: "Pages Test",
    slug: `pages-test-${Date.now()}`,
    createdBy: actor.user.id,
  });
  siteId = site.id;
});

describe("draft saves", () => {
  it("increments the lock version on every save", async () => {
    const page = await createPage({ siteId, title: "Concurrency", slug: "concurrency", actor });
    const first = await saveDraft(siteId, page.id, documentWith("One"), page.lockVersion, actor);
    expect(first.lockVersion).toBe(page.lockVersion + 1);
    const second = await saveDraft(siteId, page.id, documentWith("Two"), first.lockVersion, actor);
    expect(second.lockVersion).toBe(first.lockVersion + 1);
  });

  it("refuses a save built on a stale version", async () => {
    const page = await createPage({ siteId, title: "Stale", slug: "stale", actor });
    const saved = await saveDraft(siteId, page.id, documentWith("New"), page.lockVersion, actor);
    await expect(
      saveDraft(siteId, page.id, documentWith("Old"), page.lockVersion, actor),
    ).rejects.toThrow(/Someone else saved/);

    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(row.lockVersion).toBe(saved.lockVersion);
  });

  it("keeps the version counter unchanged when validation fails", async () => {
    const page = await createPage({ siteId, title: "Invalid", slug: "invalid", actor });
    await expect(
      saveDraft(
        siteId,
        page.id,
        { ...newPageDocument(), content: [{ type: "not-a-block", props: {} }] },
        page.lockVersion,
        actor,
      ),
    ).rejects.toThrow();
    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(row.lockVersion).toBe(page.lockVersion);
  });
});

describe("slugs", () => {
  it("keeps two pages off the same slug", async () => {
    await createPage({ siteId, title: "Taken", slug: "taken", actor });
    await expect(createPage({ siteId, title: "Taken again", slug: "taken", actor })).rejects.toThrow(
      /already/,
    );
  });

  it("refuses a rename onto an occupied slug", async () => {
    await createPage({ siteId, title: "Free", slug: "free", actor });
    const taken = await createPage({ siteId, title: "Occupied", slug: "occupied", actor });
    await expect(updatePageMeta(siteId, taken.id, { slug: "taken" }, actor)).rejects.toThrow(
      /already uses/,
    );
  });
});

describe("publishing", () => {
  it("writes an immutable snapshot and leaves the draft alone", async () => {
    const page = await createPage({ siteId, title: "Publish", slug: "publish", actor });
    const saved = await saveDraft(siteId, page.id, documentWith("Live"), page.lockVersion, actor);
    const { version: published } = await publishPage(siteId, page.id, actor);
    expect(published.versionNumber).toBe(1);

    const versions = await listVersions(siteId, page.id);
    expect(versions).toHaveLength(1);

    await saveDraft(siteId, page.id, documentWith("Edited later"), saved.lockVersion, actor);
    const after = await listVersions(siteId, page.id);
    expect(after[0].document).toEqual(versions[0].document);
  });

  it("numbers snapshots in order and rolls back to an older one", async () => {
    const page = await createPage({ siteId, title: "Rollback", slug: "rollback", actor });
    let lock = page.lockVersion;
    lock = (await saveDraft(siteId, page.id, documentWith("First"), lock, actor)).lockVersion;
    await publishPage(siteId, page.id, actor);
    await saveDraft(siteId, page.id, documentWith("Second"), lock, actor);
    await publishPage(siteId, page.id, actor);

    const versions = await listVersions(siteId, page.id);
    expect(versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    await rollbackToVersion(siteId, page.id, versions[1].id, actor, true);
    const updatedVersions = await listVersions(siteId, page.id);
    expect(updatedVersions[0].versionNumber).toBe(3);
    expect(updatedVersions.length).toBe(3);
  });

  it("keeps one homepage per site", async () => {
    const first = await createPage({ siteId, title: "Home A", slug: "home-a", actor });
    await saveDraft(siteId, first.id, documentWith("A"), first.lockVersion, actor);
    await publishPage(siteId, first.id, actor);
    await setHomepage(siteId, first.id, actor);

    const second = await createPage({ siteId, title: "Home B", slug: "home-b", actor });
    await saveDraft(siteId, second.id, documentWith("B"), second.lockVersion, actor);
    await publishPage(siteId, second.id, actor);
    await setHomepage(siteId, second.id, actor);

    const homes = await db
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.isHomepage, true)));
    expect(homes).toHaveLength(1);
    expect(homes[0].id).toBe(second.id);
  });

  it("refuses to publish an archived page", async () => {
    const page = await createPage({ siteId, title: "Archive", slug: "archive-me", actor });
    await saveDraft(siteId, page.id, documentWith("Gone"), page.lockVersion, actor);
    await publishPage(siteId, page.id, actor);
    await archivePage(siteId, page.id, actor);
    await expect(publishPage(siteId, page.id, actor)).rejects.toBeInstanceOf(LifecycleError);
  });

  it("restores an archived page as a draft, not as live", async () => {
    const page = await createPage({ siteId, title: "Restore", slug: "restore-me", actor });
    await saveDraft(siteId, page.id, documentWith("Back"), page.lockVersion, actor);
    await archivePage(siteId, page.id, actor);
    await restorePage(siteId, page.id, actor);
    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(row.status).toBe("draft");

    await restorePage(siteId, page.id, actor);
  });

  it("refuses to unpublish a page that was never live", async () => {
    const page = await createPage({ siteId, title: "Draft only", slug: "draft-only", actor });
    await expect(unpublishPage(siteId, page.id, actor)).rejects.toBeInstanceOf(LifecycleError);
  });

  it("takes a live page down cleanly", async () => {
    const page = await createPage({ siteId, title: "Live", slug: "live-page", actor });
    await saveDraft(siteId, page.id, documentWith("Live"), page.lockVersion, actor);
    await publishPage(siteId, page.id, actor);
    await unpublishPage(siteId, page.id, actor);
    const [row] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(row.status).toBe("draft");
    expect(row.publishedVersionId).toBeTruthy();
  });
});

describe("listing", () => {
  it("returns every live row with its snapshot count", async () => {
    const all = await listPagesWithCounts(siteId);
    expect(all.length).toBeGreaterThan(5);
    const row = all.find((entry) => entry.page.slug === "/rollback");
    expect(row?.versionCount).toBe(3);
  });

  it("keeps an archived page in the list, still flagged", async () => {
    const all = await listPagesWithCounts(siteId);
    const archived = all.filter((entry) => entry.page.status === "archived");
    expect(archived.map((entry) => entry.page.slug)).toContain("/archive-me");
  });
});
