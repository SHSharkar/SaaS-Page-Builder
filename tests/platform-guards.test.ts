import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, platformSettings } from "@/lib/db/schema";
import { createSite, setSiteStatus } from "@/lib/sites";
import { createPage, newPageDocument, savePageDraft } from "@/lib/pages";
import { applyImportJob, createImportJob } from "@/lib/importer";
import { sanitizeRichHtml } from "@/lib/documents";
import { isPrivateIpAddress, isSafeRemoteUrl } from "@/lib/media/ssrf";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getSecretSetting, updateSetting } from "@/lib/settings";
import { ForbiddenError, RateLimitError } from "@/lib/errors";
import { methodNotAllowed, problemFromError } from "@/lib/problem";
import { GET as tlsCheckGet, POST as tlsCheckPost } from "@/app/api/internal/tls-check/route";
import type { Actor } from "@/lib/auth/session";
import { adminActor, editorActor } from "./support/actor";

let admin: Actor;
let editor: Actor;
let siteId: string;

beforeAll(async () => {
  await ensureDb();
  admin = await adminActor();
  editor = await editorActor();
  const site = await createSite({
    name: "Platform Guards",
    slug: `guards-${Date.now()}`,
    createdBy: admin.user.id,
  });
  siteId = site.id;
});

describe("on-demand TLS check endpoint", () => {
  it("approves only verified active hostnames on active sites", async () => {
    const activeHost = `tls-active-${Date.now()}.example`;
    const pendingHost = `tls-pending-${Date.now()}.example`;

    await db.insert(domains).values([
      {
        siteId,
        hostname: activeHost,
        status: "active",
        verifiedAt: new Date(),
        certificateState: "issued",
      },
      {
        siteId,
        hostname: pendingHost,
        status: "pending",
      },
    ]);

    const okRes = await tlsCheckGet(
      new Request(`http://localhost/api/internal/tls-check?domain=${activeHost}`),
    );
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("x-request-id")).toBeTruthy();

    const pendingRes = await tlsCheckGet(
      new Request(`http://localhost/api/internal/tls-check?domain=${pendingHost}`),
    );
    expect(pendingRes.status).toBe(403);
    expect(pendingRes.headers.get("content-type")).toContain("application/problem+json");

    const missingRes = await tlsCheckGet(
      new Request("http://localhost/api/internal/tls-check"),
    );
    expect(missingRes.status).toBe(400);

    await setSiteStatus(siteId, "suspended");
    try {
      const suspendedRes = await tlsCheckGet(
        new Request(`http://localhost/api/internal/tls-check?domain=${activeHost}`),
      );
      expect(suspendedRes.status).toBe(403);
    } finally {
      await setSiteStatus(siteId, "active");
    }
  });

  it("returns 405 with an Allow header for unsupported methods", async () => {
    const res = await tlsCheckPost(
      new Request("http://localhost/api/internal/tls-check", { method: "POST" }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});

describe("SSRF guard", () => {
  it("identifies loopback, private, link-local, and metadata IP ranges", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("10.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("169.254.169.254")).toBe(true);
    expect(isPrivateIpAddress("192.168.1.20")).toBe(true);
    expect(isPrivateIpAddress("::1")).toBe(true);
    expect(isPrivateIpAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("93.184.216.34")).toBe(false);
  });

  it("rejects non-HTTP schemes, embedded credentials, localhost, and private literals", () => {
    expect(isSafeRemoteUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeRemoteUrl("http://localhost:3000/secret")).toBe(false);
    expect(isSafeRemoteUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeRemoteUrl("https://user:pass@example.com/img.png")).toBe(false);
    expect(isSafeRemoteUrl("https://cdn.example.com/banner.webp")).toBe(true);
  });
});

describe("HTML sanitization, importer, and admin-only block gate", () => {
  it("strips scripts, event attributes, and javascript URLs from rich HTML", () => {
    const dirty =
      '<p onclick="evil()">Bonus <script>alert(1)</script><a href="javascript:steal()">Claim</a></p>';
    const sanitized = sanitizeRichHtml(dirty);
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("Bonus");
  });

  it("blocks editors from saving raw-html blocks while allowing admins", async () => {
    const page = await createPage({
      siteId,
      title: "Admin Gate",
      slug: `admin-gate-${Date.now()}`,
      actor: admin,
    });
    const rawDoc = {
      ...newPageDocument(),
      content: [
        {
          type: "raw-html",
          props: { id: "raw-1", html: "<section><p>Trusted markup</p></section>" },
        },
      ],
    };

    await expect(
      savePageDraft({
        siteId,
        pageId: page.id,
        expectedLockVersion: page.lockVersion,
        document: rawDoc,
        actor: editor,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const saved = await savePageDraft({
      siteId,
      pageId: page.id,
      expectedLockVersion: page.lockVersion,
      document: rawDoc,
      actor: admin,
    });
    expect(saved.lockVersion).toBe(page.lockVersion + 1);
  });

  it("analyzes HTML, strips executable tags, and forbids editors from applying raw_html segments", async () => {
    const html = `<!doctype html>
      <html>
        <head><title>Promo Landing</title><meta name="description" content="Top offers" /></head>
        <body>
          <script>window.pwned = true;</script>
          <section class="hero"><h1>Welcome Bonus</h1><p>Claim 100 spins</p><a href="https://example.com/play">Play now</a></section>
          <aside class="custom-widget"><div data-custom="1">Custom layout fragment</div></aside>
        </body>
      </html>`;

    const job = await createImportJob({
      siteId,
      filename: "promo.html",
      html,
      actor: editor,
    });
    expect(job.status).toBe("review");
    expect(job.report?.strippedCount).toBeGreaterThanOrEqual(1);
    expect(job.report?.segments.length).toBeGreaterThanOrEqual(1);

    const rawOnlyDecisions = job.report!.segments.map((seg, idx) => ({
      id: seg.id,
      decision: (idx === 0 ? "raw_html" : "skip") as "raw_html" | "skip",
    }));
    await expect(
      applyImportJob({
        siteId,
        jobId: job.id,
        decisions: rawOnlyDecisions,
        pageTitle: "Editor Blocked",
        pageSlug: `blocked-${Date.now()}`,
        actor: editor,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const applied = await applyImportJob({
      siteId,
      jobId: job.id,
      decisions: rawOnlyDecisions,
      pageTitle: "Admin Allowed",
      pageSlug: `allowed-${Date.now()}`,
      actor: admin,
    });
    expect(applied.blockCount).toBe(1);
  });
});

describe("AES-256-GCM settings encryption and RFC 9457 Problem Details", () => {
  it("encrypts secrets at rest with tamper detection", async () => {
    const ciphertext = encryptSecret("sk-live-secret-value");
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(ciphertext).not.toContain("sk-live-secret-value");
    expect(decryptSecret(ciphertext)).toBe("sk-live-secret-value");

    const tampered = `${ciphertext.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();

    const key = `test.secret.${Date.now()}`;
    await updateSetting(key, "super-secret-api-token", admin, true);

    const [stored] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key));
    expect(stored.value).toBeNull();
    expect(stored.encryptedValue?.startsWith("v1:")).toBe(true);
    expect(await getSecretSetting(key)).toBe("super-secret-api-token");
  });

  it("formats rate limits and method errors as RFC 9457 application/problem+json", async () => {
    const rateRes = problemFromError(new RateLimitError("Slow down", 42), "req-123");
    expect(rateRes.status).toBe(429);
    expect(rateRes.headers.get("retry-after")).toBe("42");
    expect(rateRes.headers.get("x-request-id")).toBe("req-123");
    expect(rateRes.headers.get("content-type")).toContain("application/problem+json");
    const body = (await rateRes.json()) as { status: number; title: string; detail: string };
    expect(body.status).toBe(429);
    expect(body.detail).toBe("Slow down");

    const notAllowed = methodNotAllowed(["GET", "POST"], "req-456");
    expect(notAllowed.status).toBe(405);
    expect(notAllowed.headers.get("allow")).toBe("GET, POST");
  });
});
