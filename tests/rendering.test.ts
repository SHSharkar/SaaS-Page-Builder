import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, users } from "@/lib/db/schema";
import { createSite, resolveHost } from "@/lib/sites";
import {
  archivePage,
  createPage,
  publishPage,
  saveDraft,
  unpublishPage,
  newPageDocument,
  updatePageMeta,
} from "@/lib/pages";
import { loadPreviewPage, loadPublicPage } from "@/lib/public-page";
import { buildMetadata } from "@/lib/render";
import { DEFAULT_SEO, DEFAULT_THEME } from "@/lib/documents";
import { cacheKeys, invalidatePageCache } from "@/lib/cache";
import type { Actor } from "@/lib/auth/session";

const HOST = "render-test.example";

let actor: Actor;
let siteId: string;

function doc(text: string) {
  return {
    ...newPageDocument(),
    content: [{ type: "hero", props: { id: `hero-${Math.random().toString(36).slice(2)}`, title: text } }],
  };
}

beforeAll(async () => {
  await ensureDb();
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  actor = { user: admin, sessionId: "test", stepUpValid: true };
  const site = await createSite({ name: "Render Test", slug: `render-test-${Date.now()}`, createdBy: admin.id });
  siteId = site.id;
  await db.insert(domains).values({
    siteId,
    hostname: HOST,
    status: "active",
    verifiedAt: new Date(),
    certificateState: "issued",
  });
});

describe("hostname resolution", () => {
  it("resolves an active domain to its site", async () => {
    const resolution = await resolveHost(HOST);
    expect(resolution?.site.id).toBe(siteId);
    expect(resolution?.canServe).toBe(true);
  });

  it("strips a port and lowercases the host", async () => {
    expect((await resolveHost(`${HOST.toUpperCase()}:443`))?.site.id).toBe(siteId);
  });

  it("follows www to the bare host", async () => {
    expect((await resolveHost(`www.${HOST}`))?.site.id).toBe(siteId);
  });

  it("stops serving a domain whose verification is unfinished", async () => {
    const pendingHost = `pending-${Date.now()}.example`;
    await db.insert(domains).values({ siteId, hostname: pendingHost, status: "pending" });
    const resolution = await resolveHost(pendingHost);
    expect(resolution?.canServe).toBe(false);
  });

  it("falls back to the first active site in the preview environment", async () => {
    // ALLOW_HOST_FALLBACK=true is the single-host reviewer setup.
    const resolution = await resolveHost("nobody.example");
    expect(resolution?.domain).toBeNull();
    expect(resolution?.site).toBeTruthy();
  });

  it("says nothing about a host it does not know in production mode", async () => {
    process.env.ALLOW_HOST_FALLBACK = "false";
    try {
      expect(await resolveHost("nobody.example")).toBeNull();
    } finally {
      process.env.ALLOW_HOST_FALLBACK = "true";
    }
  });
});

describe("public rendering", () => {
  it("serves a published page", async () => {
    const page = await createPage({ siteId, title: "Public", slug: "public", actor });
    await saveDraft(siteId, page.id, doc("Hello"), page.lockVersion, actor);
    await publishPage(siteId, page.id, actor);

    const loaded = await loadPublicPage(HOST, "/public");
    expect(loaded.kind).toBe("page");
    if (loaded.kind === "page") expect(loaded.rendered.page.slug).toBe("public");
  });

  it("returns the same not-found shape for a missing page", async () => {
    const missing = await loadPublicPage(HOST, "/never-existed");
    expect(missing.kind).toBe("not_found");
    expect(missing.kind === "not_found" && missing.reason).toBe("no-page");
  });

  it("returns the same not-found shape for a draft page", async () => {
    const page = await createPage({ siteId, title: "Draft", slug: "still-draft", actor });
    await saveDraft(siteId, page.id, doc("Not live"), page.lockVersion, actor);
    const loaded = await loadPublicPage(HOST, "/still-draft");
    expect(loaded.kind).toBe("not_found");
    expect(loaded.kind === "not_found" && loaded.reason).toBe("not-published");
  });

  it("returns the same not-found shape for an unknown host in production mode", async () => {
    process.env.ALLOW_HOST_FALLBACK = "false";
    try {
      const loaded = await loadPublicPage("nobody.example", "/public");
      expect(loaded.kind).toBe("not_found");
      expect(loaded.kind === "not_found" && loaded.reason).toBe("unknown-host");
    } finally {
      process.env.ALLOW_HOST_FALLBACK = "true";
    }
  });

  it("takes a page down the moment it is unpublished", async () => {
    const page = await createPage({ siteId, title: "Going down", slug: "going-down", actor });
    await saveDraft(siteId, page.id, doc("Live"), page.lockVersion, actor);
    await publishPage(siteId, page.id, actor);
    expect((await loadPublicPage(HOST, "/going-down")).kind).toBe("page");

    await unpublishPage(siteId, page.id, actor);
    expect((await loadPublicPage(HOST, "/going-down")).kind).toBe("not_found");
  });

  it("serves the new snapshot immediately after a republish", async () => {
    const page = await createPage({ siteId, title: "Republish", slug: "republish", actor });
    const first = await saveDraft(siteId, page.id, doc("First"), page.lockVersion, actor);
    const versionOne = await publishPage(siteId, page.id, actor);
    const before = await loadPublicPage(HOST, "/republish");
    expect(before.kind === "page" && before.rendered.versionId).toBe(versionOne.versionId);

    await saveDraft(siteId, page.id, doc("Second"), first.lockVersion, actor);
    const versionTwo = await publishPage(siteId, page.id, actor);
    const after = await loadPublicPage(HOST, "/republish");
    expect(after.kind === "page" && after.rendered.versionId).toBe(versionTwo.versionId);
  });

  it("hides an archived page", async () => {
    const page = await createPage({ siteId, title: "Archived", slug: "archived-public", actor });
    await saveDraft(siteId, page.id, doc("Live"), page.lockVersion, actor);
    await publishPage(siteId, page.id, actor);
    await archivePage(siteId, page.id, actor);
    expect((await loadPublicPage(HOST, "/archived-public")).kind).toBe("not_found");
  });
});

describe("previews", () => {
  it("renders a draft, always noindex", async () => {
    const page = await createPage({ siteId, title: "Preview me", slug: "preview-me", actor });
    await saveDraft(siteId, page.id, doc("Draft only"), page.lockVersion, actor);
    const loaded = await loadPreviewPage(siteId, "/preview-me");
    expect(loaded.kind).toBe("page");
    if (loaded.kind === "page") {
      expect(loaded.rendered.seo.noindex).toBe(true);
      expect(loaded.rendered.versionId).toBe("preview");
    }
  });

  it("cannot be reached without a site id", async () => {
    expect((await loadPreviewPage("00000000-0000-0000-0000-000000000000", "/preview-me")).kind).toBe("not_found");
  });
});

describe("metadata", () => {
  const base = {
    seo: DEFAULT_SEO,
    theme: DEFAULT_THEME,
    siteName: "Trofeo",
    host: HOST,
    path: "public",
  };

  it("falls back to page title plus site name", () => {
    const meta = buildMetadata({ ...base, title: "Bonuses" });
    expect(meta.title.absolute).toBe("Bonuses · Trofeo");
  });

  it("lets a page override the title outright", () => {
    const meta = buildMetadata({ ...base, title: "Bonuses", seo: { ...DEFAULT_SEO, title: "100% up to €500" } });
    expect(meta.title.absolute).toBe("100% up to €500");
  });

  it("marks staff previews noindex", () => {
    expect(buildMetadata({ ...base, title: "X", noindex: true }).robots).toEqual({ index: false, follow: false });
  });

  it("drops the canonical link when the page opts out", () => {
    const meta = buildMetadata({ ...base, title: "X", seo: { ...DEFAULT_SEO, canonicalMode: "none" } });
    expect(meta.alternates?.canonical).toBeUndefined();
  });

  it("builds the canonical from the host and path", () => {
    const meta = buildMetadata({ ...base, title: "X", path: "games/blackjack" });
    expect(meta.alternates?.canonical).toBe(`https://${HOST}/games/blackjack`);
  });
});
