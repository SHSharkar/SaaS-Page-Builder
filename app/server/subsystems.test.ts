import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { emptyDocument } from "@/lib/documents";
import { renameWorkspaceAction } from "@/app/server/accounts/actions";
import { listWorkspaceMembers } from "@/app/server/accounts";
import {
  getPlatformOverviewStats,
  listPlatformAccounts,
  listPlatformAuditEntries,
  listPlatformComponents,
  listPlatformDomains,
  listPlatformRecordsSummary,
  listPlatformRoles,
  listPlatformSites,
  listPlatformUsers,
} from "@/app/server/admin";
import { setAccountStatusPlatformAction } from "@/app/server/admin/actions";
import { problemResponse } from "@/app/server/api/problem";
import {
  requireAccountCapability,
  requirePlatformCapability,
} from "@/app/server/auth/guards";
import { hashPassword, verifyPassword } from "@/app/server/auth/password";
import { setTestSessionContext } from "@/app/server/auth/session";
import {
  createTotpSecret,
  generateTotpCode,
  verifyTotpCode,
} from "@/app/server/auth/totp";
import {
  checkTlsDomainAllowed,
  isPrimaryPlatformHost,
  listSiteDomains,
  verifyCustomDomain,
} from "@/app/server/domains";
import {
  connectDomainAction,
  verifyDomainAction,
} from "@/app/server/domains/actions";
import {
  createMailTransport,
  renderShortLinkEmailHtml,
  renderShortLinkEmailText,
} from "@/app/server/email";
import { getEnv } from "@/app/server/env";
import { listSiteGlobals } from "@/app/server/globals";
import { publishGlobalAction } from "@/app/server/globals/actions";
import { listSiteImports } from "@/app/server/imports";
import {
  applyImportAction,
  submitHtmlImportAction,
} from "@/app/server/imports/actions";
import { enqueueRunOnceJob, QUEUE_POLICY_MAP } from "@/app/server/jobs";
import { JOB_KINDS } from "@/lib/enums";
import { assertTransition, canTransition } from "@/app/server/lifecycle";
import {
  checksumBytes,
  inspectImageDimensions,
  listSiteMedia,
  sniffImageMimeType,
} from "@/app/server/media";
import {
  registerMediaAction,
  retireMediaAction,
} from "@/app/server/media/actions";
import {
  assertSafeOutboundUrl,
  isBlockedIpAddress,
} from "@/app/server/network/outbound-url";
import { getWorkspaceOverview } from "@/app/server/overview";
import { getSitePage, listSitePages } from "@/app/server/pages";
import {
  createPageAction,
  publishPageAction,
  rollbackPageAction,
  saveDraftAction,
} from "@/app/server/pages/actions";
import { getPlatformSettingString } from "@/app/server/platform-config";
import { updatePlatformSettingAction } from "@/app/server/platform-config/actions";
import { resolvePublishedPage } from "@/app/server/public-site";
import { serializeRealtimePayload } from "@/app/server/realtime/publish";
import {
  resolveDurableScanShare,
  resolveExpiringShortLink,
} from "@/app/server/short-links";
import { createPreviewShortLinkAction } from "@/app/server/short-links/actions";
import { signUpWorkspaceAction } from "@/app/server/signup/actions";
import { getAccountSite, listAccountSites } from "@/app/server/sites";
import {
  createSiteAction,
  updateSiteStatusAction,
} from "@/app/server/sites/actions";
import { purgeExpiredKeepWindows } from "@/app/server/sweeper";
import { listWorkspaceInvitations } from "@/app/server/team";
import { inviteMemberAction } from "@/app/server/team/actions";
import {
  listAccountTemplates,
  listPlatformTemplates,
} from "@/app/server/templates";
import { saveTemplateAction } from "@/app/server/templates/actions";
import { createTestWorkspaceFixture } from "@/app/server/test-support";
import { getTranslations } from "@/app/server/text";
import {
  createStripeClient,
  verifyHmacWebhookSignature,
  verifyStripeWebhookSignature,
} from "@/app/server/webhooks";

describe("app/server subsystems", () => {
  it("creates sites, saves drafts, publishes snapshots, rolls back, and resolves public pages", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    const createdSite = await createSiteAction({
      name: "Acme Product",
      slug: `acme-${crypto.randomUUID().slice(0, 6)}`,
    });
    expect(createdSite.ok).toBe(true);

    const site = await getAccountSite(ctx.account.id, createdSite.siteId);
    expect(site?.name).toBe("Acme Product");
    expect(
      (await listAccountSites(ctx.account.id)).length,
    ).toBeGreaterThanOrEqual(1);

    const createdPage = await createPageAction({
      siteId: createdSite.siteId,
      title: "Pricing",
      slug: "/pricing",
    });

    const pageRow = await getSitePage(
      ctx.account.id,
      createdSite.siteId,
      createdPage.pageId,
    );
    expect(pageRow?.slug).toBe("/pricing");

    const draft = emptyDocument("Pricing");
    draft.content.push({
      id: "hero_1",
      type: "hero-banner",
      props: {
        headline: "Transparent pricing",
        ctaLabel: "Join",
        ctaHref: "https://example.com/join",
      },
    });

    const saved = await saveDraftAction({
      siteId: createdSite.siteId,
      pageId: createdPage.pageId,
      expectedLockVersion: pageRow?.lockVersion ?? 0,
      title: "Pricing Plans",
      document: draft,
    });
    expect(saved.lockVersion).toBe(1);

    await expect(
      saveDraftAction({
        siteId: createdSite.siteId,
        pageId: createdPage.pageId,
        expectedLockVersion: 0,
        title: "Stale",
        document: draft,
      }),
    ).rejects.toThrow("Optimistic lock conflict");

    const pub1 = await publishPageAction({
      siteId: createdSite.siteId,
      pageId: createdPage.pageId,
      note: "Initial launch",
    });
    expect(pub1.versionNumber).toBe(1);

    const pub2 = await publishPageAction({
      siteId: createdSite.siteId,
      pageId: createdPage.pageId,
      note: "Second release",
    });
    expect(pub2.versionNumber).toBe(2);

    const rolled = await rollbackPageAction({
      siteId: createdSite.siteId,
      pageId: createdPage.pageId,
      versionId: pub1.versionId,
    });
    expect(rolled.ok).toBe(true);

    const globalDoc = emptyDocument("Navigation");
    await publishGlobalAction({
      siteId: createdSite.siteId,
      kind: "navigation",
      document: globalDoc,
    });
    expect(
      (await listSiteGlobals(ctx.account.id, createdSite.siteId)).length,
    ).toBe(3);

    const publicSnapshot = await resolvePublishedPage({
      siteSlug: site?.slug,
      pageSlug: "/pricing",
    });
    expect(publicSnapshot?.pageTitle).toBe("Pricing Plans");
    expect(
      (await listSitePages(ctx.account.id, createdSite.siteId)).length,
    ).toBe(2);

    const overview = await getWorkspaceOverview(ctx.account.id);
    expect(overview.publishedPages).toBeGreaterThanOrEqual(1);
  });

  it("handles custom domains, TLS check, media, HTML imports, templates, short links, and team", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    const { siteId } = await createSiteAction({
      name: "Campaign Hub",
      slug: `hub-${crypto.randomUUID().slice(0, 6)}`,
    });
    const site = await getAccountSite(ctx.account.id, siteId);

    const customHost = `promo-${crypto.randomUUID().slice(0, 6)}.example.com`;
    const dom = await connectDomainAction({ siteId, hostname: customHost });
    expect(await checkTlsDomainAllowed(customHost)).toBe(false);
    const unproven = await verifyDomainAction({ domainId: dom.domainId });
    expect(unproven.verified).toBe(false);
    expect(unproven.recordName).toBe(`_spb-verify.${customHost}`);
    expect(await checkTlsDomainAllowed(customHost)).toBe(false);
    const [pending] = (await listSiteDomains(ctx.account.id, siteId)).filter(
      (row) => row.hostname === customHost,
    );
    const proven = await verifyCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      domainId: dom.domainId,
      lookupTxt: async () => [[pending?.verificationToken ?? ""]],
    });
    expect(proven.verified).toBe(true);
    expect(await checkTlsDomainAllowed(customHost)).toBe(true);
    expect((await listSiteDomains(ctx.account.id, siteId)).length).toBe(2);

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(sniffImageMimeType(pngBytes)).toBe("image/png");
    const hash = checksumBytes(pngBytes);
    const media = await registerMediaAction({
      siteId,
      originalName: "banner.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.byteLength,
      checksum: hash,
    });
    expect((await listSiteMedia(ctx.account.id, siteId)).length).toBe(1);
    await retireMediaAction({ mediaId: media.mediaId });

    const imp = await submitHtmlImportAction({
      siteId,
      sourceFilename: "landing.html",
      rawHtml:
        "<html><head><title>Imported</title></head><body><section><h1>Launch</h1><p>Fast pages.</p></section></body></html>",
    });
    expect((await listSiteImports(ctx.account.id, siteId)).length).toBe(1);
    const applied = await applyImportAction({
      jobId: imp.jobId,
      slug: "/imported",
      decisions: [{ segmentId: "seg_1", action: "accept" }],
    });
    expect(applied.pageId).toBeTruthy();

    await saveTemplateAction({
      siteId,
      name: "Launch Starter",
      document: emptyDocument("Starter"),
    });
    expect(
      (await listAccountTemplates(ctx.account.id)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(await listPlatformTemplates())).toBe(true);

    const link = await createPreviewShortLinkAction({
      kind: "preview",
      targetPath: `/s/${site?.slug}`,
    });
    const code = link.path.replace("/go/", "");
    const resolvedLink = await resolveExpiringShortLink(code, "127.0.0.1");
    expect(resolvedLink?.targetPath).toBe(`/s/${site?.slug}`);

    const scanResolved = await resolveDurableScanShare(site?.scanCode ?? "");
    expect(scanResolved?.siteId).toBe(siteId);

    await inviteMemberAction({
      email: "teammate@example.test",
      role: "editor",
    });
    expect((await listWorkspaceInvitations(ctx.account.id)).length).toBe(1);
    expect((await listWorkspaceMembers(ctx.account.id)).length).toBe(1);

    await renameWorkspaceAction({ name: "Renamed Workspace" });
    await updateSiteStatusAction({ siteId, nextStatus: "suspended" });
    await updateSiteStatusAction({ siteId, nextStatus: "active" });
  });

  it("verifies platform admin, settings encryption, security guards, and utilities", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    await updatePlatformSettingAction({
      key: "smtp.api_token",
      value: "super-secret-smtp-value",
      isSecret: true,
      description: "Encrypted relay token",
    });
    expect(await getPlatformSettingString("smtp.api_token")).toBe(
      "super-secret-smtp-value",
    );

    const stats = await getPlatformOverviewStats();
    expect(stats.accounts).toBeGreaterThanOrEqual(1);
    expect((await listPlatformAccounts()).length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(await listPlatformSites())).toBe(true);
    expect(Array.isArray(await listPlatformDomains())).toBe(true);
    expect(Array.isArray(await listPlatformUsers())).toBe(true);
    expect(Array.isArray(await listPlatformRoles())).toBe(true);
    expect(Array.isArray(await listPlatformComponents())).toBe(true);
    expect(Array.isArray(await listPlatformAuditEntries())).toBe(true);
    expect(
      (await listPlatformRecordsSummary()).settings.length,
    ).toBeGreaterThanOrEqual(1);

    await setAccountStatusPlatformAction({
      accountId: ctx.account.id,
      status: "suspended",
    });
    await setAccountStatusPlatformAction({
      accountId: ctx.account.id,
      status: "active",
    });

    const pwHash = await hashPassword("StrongPassphrase!2026");
    expect(await verifyPassword(pwHash, "StrongPassphrase!2026")).toBe(true);

    const signedUp = await signUpWorkspaceAction({
      name: "New Owner",
      email: `signup-${crypto.randomUUID().slice(0, 8)}@example.test`,
      password: "StrongPassphrase!2026",
      workspaceName: "Fresh Org",
      clientKey: crypto.randomUUID(),
    });
    expect(signedUp.ok).toBe(true);

    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true);
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
    await expect(
      assertSafeOutboundUrl("http://127.0.0.1:8080/internal"),
    ).rejects.toThrow();
    expect(isPrimaryPlatformHost("localhost:3000")).toBe(true);

    const secret = createTotpSecret();
    const code = generateTotpCode(secret, "operator@example.test");
    expect(verifyTotpCode(secret, "operator@example.test", code)).toBe(true);

    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const dims = await inspectImageDimensions(onePixelPng);
    expect(dims.width).toBe(1);
    expect(dims.height).toBe(1);

    expect(createStripeClient()).toBeTruthy();
    expect(typeof enqueueRunOnceJob).toBe("function");
    expect(
      await renderShortLinkEmailHtml({
        heading: "Welcome",
        shortUrl: "https://app.example/go/abc",
      }),
    ).toContain("https://app.example/go/abc");

    expect(canTransition("site", "active", "suspended")).toBe(true);
    expect(() => assertTransition("domain", "removed", "active")).toThrow();

    expect(Object.keys(QUEUE_POLICY_MAP)).toHaveLength(JOB_KINDS.length);
    const swept = await purgeExpiredKeepWindows();
    expect(swept.purgedSites).toBeGreaterThanOrEqual(0);

    expect(createMailTransport()).toBeTruthy();
    expect(
      renderShortLinkEmailText({
        heading: "Welcome",
        shortUrl: "https://app.example/go/abc",
      }),
    ).toContain("https://app.example/go/abc");

    const body = '{"id":"evt_1"}';
    const sig = createHmac("sha256", getEnv().INTERNAL_TLS_CHECK_TOKEN)
      .update(body, "utf8")
      .digest("hex");
    expect(
      verifyHmacWebhookSignature({ rawBody: body, signatureHeader: sig }),
    ).toBe(true);
    expect(
      verifyHmacWebhookSignature({ rawBody: body, signatureHeader: "bad" }),
    ).toBe(false);

    const stripeSecret = getEnv().STRIPE_WEBHOOK_SECRET;
    const timestamp = 1_800_000_000;
    const stripeSig = createHmac("sha256", stripeSecret)
      .update(`${timestamp}.${body}`, "utf8")
      .digest("hex");
    const header = `t=${timestamp},v1=${stripeSig}`;
    expect(
      verifyStripeWebhookSignature({
        rawBody: body,
        secret: stripeSecret,
        signatureHeader: header,
        nowSeconds: timestamp,
      }),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature({
        rawBody: body,
        secret: stripeSecret,
        signatureHeader: header,
        nowSeconds: timestamp + 3_600,
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        rawBody: body,
        secret: stripeSecret,
        signatureHeader: `t=${timestamp},v1=deadbeef`,
        nowSeconds: timestamp,
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        rawBody: body,
        secret: stripeSecret,
        signatureHeader: null,
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        rawBody: body,
        secret: stripeSecret,
        signatureHeader: "malformed",
      }),
    ).toBe(false);

    const prob = problemResponse({
      title: "Forbidden",
      status: 403,
      detail: "Denied",
    });
    expect(prob.status).toBe(403);
    expect(getTranslations("en-GB")("app.brand")).toBe("SaaS Page Builder");
    expect(
      serializeRealtimePayload({
        accountId: ctx.account.id,
        topic: "site.updated",
        ids: [ctx.account.id],
      }),
    ).toContain("site.updated");

    setTestSessionContext(null);
    await expect(requireAccountCapability("sites.view")).rejects.toThrow(
      "Authentication required",
    );
    await expect(
      requirePlatformCapability("platform.console.view"),
    ).rejects.toThrow("Authentication required");
  });
});
