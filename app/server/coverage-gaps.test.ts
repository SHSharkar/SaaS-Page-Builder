import { describe, expect, it } from "vitest";
import { emptyDocument } from "@/lib/documents";
import { authClient } from "@/app/lib/auth-client";
import {
  createWorkspaceAccount,
  exportAccountSnapshot,
} from "@/app/server/accounts";
import {
  listPlatformErasureLogs,
  listWorkerHeartbeats,
} from "@/app/server/admin";
import {
  AuthorizationError,
  requireAccountCapability,
  requireAccountPageCapability,
  requirePlatformPageCapability,
  requirePublicActionRateLimit,
} from "@/app/server/auth/guards";
import {
  analyzeHtmlDocument,
  applyReviewedImport,
  listSiteImports,
} from "@/app/server/imports";
import {
  checkTlsDomainAllowed,
  connectCustomDomain,
  isPrimaryPlatformHost,
  listSiteDomains,
  verificationRecordName,
  verifyCustomDomain,
  verifyDomainOwnership,
} from "@/app/server/domains";
import {
  listSiteMedia,
  registerSiteMediaAsset,
  retireMediaAsset,
  sniffImageMimeType,
} from "@/app/server/media";
import {
  assertSafeOutboundUrl,
  isBlockedIpAddress,
} from "@/app/server/network/outbound-url";
import {
  getPlatformSettingString,
  setPlatformSetting,
} from "@/app/server/platform-config";
import { resolvePublishedPage } from "@/app/server/public-site";
import {
  resolveDurableScanShare,
  resolveExpiringShortLink,
} from "@/app/server/short-links";
import { sealGuestContact } from "@/app/server/privacy";
import {
  requestContactErasureAction,
  revealContactForPlatformAction,
} from "@/app/server/privacy/actions";
import { subscribeAccountEvents } from "@/app/server/realtime/listener";
import {
  publishAccountChange,
  serializeRealtimePayload,
} from "@/app/server/realtime/publish";
import {
  createSitePage,
  publishSitePage,
  rollbackPageToVersion,
} from "@/app/server/pages";
import { createSiteAction } from "@/app/server/sites/actions";
import { createPresignedDownloadUrl } from "@/app/server/storage/r2";
import { createTestWorkspaceFixture } from "@/app/server/test-support";
import { claimWebhookEventOnce } from "@/app/server/webhooks";

describe("privacy, realtime, storage, webhook dedup, and guard coverage", () => {
  it("seals, reveals, and erases guest contacts with audit and erasure tombstones", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    const { siteId } = await createSiteAction({
      name: "Privacy Site",
      slug: `priv-${crypto.randomUUID().slice(0, 6)}`,
    });

    const rawContact = `guest-${crypto.randomUUID().slice(0, 8)}@example.test`;
    const sealed = await sealGuestContact({
      accountId: ctx.account.id,
      rawContact,
      siteId,
    });
    expect(sealed.publicId).toMatch(/^gst_/);

    const revealed = await revealContactForPlatformAction({
      contactId: sealed.id,
      reason: "Support ticket verification",
    });
    expect(revealed.contact).toBe(rawContact);

    const erased = await requestContactErasureAction({ rawContact });
    expect(erased.erasedCount).toBe(1);

    const erasureLogs = await listPlatformErasureLogs();
    expect(erasureLogs.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(await listWorkerHeartbeats())).toBe(true);

    const snapshot = await exportAccountSnapshot(ctx.account.id);
    expect(snapshot.sites.length).toBeGreaterThanOrEqual(1);
  });

  it("delivers PostgreSQL LISTEN/NOTIFY events, deduplicates webhooks, and checks guards", async () => {
    const ctx = await createTestWorkspaceFixture({
      accountRole: "viewer",
      platformRole: "superadmin",
    });

    const received: string[] = [];
    const unsubscribe = await subscribeAccountEvents((payload) => {
      received.push(payload);
    });
    await publishAccountChange(ctx.account.id, "site.updated", [
      ctx.account.id,
    ]);
    await new Promise((resolve) => setTimeout(resolve, 80));
    unsubscribe();
    expect(received.length).toBeGreaterThanOrEqual(1);

    const evtId = `evt_${crypto.randomUUID()}`;
    expect(await claimWebhookEventOnce("stripe", evtId, 60)).toBe(true);
    expect(await claimWebhookEventOnce("stripe", evtId, 60)).toBe(false);

    const pageActor = await requireAccountPageCapability("sites.view");
    expect(pageActor.account.id).toBe(ctx.account.id);
    const platActor = await requirePlatformPageCapability(
      "platform.console.view",
    );
    expect(platActor.user.id).toBe(ctx.user.id);

    await expect(requireAccountCapability("sites.manage")).rejects.toThrow(
      AuthorizationError,
    );

    const rlSubject = crypto.randomUUID();
    await requirePublicActionRateLimit("test-rl", rlSubject, 1, 60);
    await expect(
      requirePublicActionRateLimit("test-rl", rlSubject, 1, 60),
    ).rejects.toThrow("Rate limit exceeded");

    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("fe80::1")).toBe(true);
    expect(isBlockedIpAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("not-an-ip")).toBe(true);
    expect(isBlockedIpAddress("2606:4700:4700::1111")).toBe(false);
    await expect(
      assertSafeOutboundUrl("ftp://example.com/file"),
    ).rejects.toThrow("Outbound URL must use HTTP or HTTPS");
    await expect(
      assertSafeOutboundUrl("https://user:pass@example.com/"),
    ).rejects.toThrow("embedded credentials");
    await expect(
      assertSafeOutboundUrl("http://service.internal/"),
    ).rejects.toThrow("Blocked internal hostname");
    const safeIp = await assertSafeOutboundUrl("https://93.184.216.34/page");
    expect(safeIp.pinnedAddresses).toEqual(["93.184.216.34"]);

    expect(
      await createPresignedDownloadUrl({
        kind: "upload",
        storageKey: "acc/site/banner.png",
      }),
    ).toContain("acc/site/banner.png");
    expect(
      await createPresignedDownloadUrl({
        kind: "backup",
        storageKey: "daily/snap.enc",
      }),
    ).toContain("daily/snap.enc");
    expect(authClient).toBeDefined();
  });

  it("covers edge, error, and workspace-wide branches across imports, media, domains, and config", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    const { siteId } = await createSiteAction({
      name: "Branch Site",
      slug: `branch-${crypto.randomUUID().slice(0, 6)}`,
    });

    const richReport = analyzeHtmlDocument(
      '<html><head><meta name="description" content="Desc"/></head><body><header><h2>Brand</h2></header><section></section><section><h2>Features</h2><p>Fast</p></section><footer><p>Copyright</p></footer></body></html>',
    );
    expect(richReport.segmentCount).toBe(3);
    const emptyReport = analyzeHtmlDocument("<html><body></body></html>");
    expect(emptyReport.warnings.length).toBe(1);
    expect(() => analyzeHtmlDocument("x".repeat(5 * 1024 * 1024 + 32))).toThrow(
      "5 MB",
    );
    expect(Array.isArray(await listSiteImports(ctx.account.id))).toBe(true);
    await expect(
      applyReviewedImport({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        decisions: [],
        jobId: crypto.randomUUID(),
        slug: "/missing",
      }),
    ).rejects.toThrow("Import job not found");

    expect(sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffImageMimeType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe("image/webp");
    expect(sniffImageMimeType(new Uint8Array([0x00]))).toBeNull();
    expect(
      sniffImageMimeType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])),
    ).toBeNull();

    expect(Array.isArray(await listSiteMedia(ctx.account.id))).toBe(true);
    await expect(
      registerSiteMediaAsset({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        checksum: "abc",
        mimeType: "image/png",
        originalName: "bad.png",
        siteId,
        sizeBytes: 0,
      }),
    ).rejects.toThrow("between 1 byte");

    const dupChecksum = `chk_${crypto.randomUUID()}`;
    const firstMedia = await registerSiteMediaAsset({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      checksum: dupChecksum,
      mimeType: "image/png",
      originalName: "---",
      siteId,
      sizeBytes: 128,
    });
    const secondMedia = await registerSiteMediaAsset({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      checksum: dupChecksum,
      mimeType: "image/png",
      originalName: "---",
      siteId,
      sizeBytes: 128,
    });
    expect(secondMedia.asset.id).toBe(firstMedia.asset.id);
    await expect(
      retireMediaAsset({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        mediaId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Media asset not found");

    expect(isPrimaryPlatformHost("3000-sandbox.e2b.app")).toBe(true);
    expect(isPrimaryPlatformHost("customer-brand.org")).toBe(false);
    expect(Array.isArray(await listSiteDomains(ctx.account.id))).toBe(true);
    expect(await checkTlsDomainAllowed("")).toBe(false);
    await expect(
      connectCustomDomain({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        hostname: "localhost",
        siteId,
      }),
    ).rejects.toThrow("valid custom domain");
    await expect(
      verifyCustomDomain({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        domainId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Domain not found");

    const connected = await connectCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      hostname: `verify-${crypto.randomUUID().slice(0, 8)}.example.test`,
      siteId,
    });
    expect(verificationRecordName(connected.hostname)).toBe(
      `_spb-verify.${connected.hostname}`,
    );

    const failedVerification = await verifyCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      domainId: connected.id,
      lookupTxt: async () => [["unrelated-value"]],
    });
    expect(failedVerification.verified).toBe(false);
    expect(failedVerification.domain.status).toBe("failed");

    const verified = await verifyCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      domainId: connected.id,
      lookupTxt: async () => [[connected.verificationToken ?? ""]],
    });
    expect(verified.verified).toBe(true);
    expect(verified.domain.status).toBe("active");
    expect(verified.domain.certificateState).toBe("pending");

    const unreachable = await verifyDomainOwnership({
      hostname: "unreachable.example.test",
      token: "spb-verify=none",
      lookupTxt: async () => {
        throw new Error("ENOTFOUND");
      },
    });
    expect(unreachable.verified).toBe(false);
    expect(unreachable.observedValues).toEqual([]);

    await setPlatformSetting({
      isSecret: false,
      key: "platform.banner_text",
      value: "Hello operators",
    });
    expect(await getPlatformSettingString("platform.banner_text")).toBe(
      "Hello operators",
    );
    expect(
      await getPlatformSettingString(`missing.${crypto.randomUUID()}`),
    ).toBeNull();

    expect(
      await resolvePublishedPage({
        hostname: "unmapped-host.example.org",
        pageSlug: "/",
      }),
    ).toBeNull();
    expect(
      await resolveExpiringShortLink("missing_code_1234567890", "127.0.0.1"),
    ).toBeNull();
    expect(await resolveDurableScanShare("missing-scan")).toBeNull();

    await expect(
      createWorkspaceAccount({ name: "x", ownerUserId: ctx.user.id }),
    ).rejects.toThrow("at least 2");
    await expect(
      sealGuestContact({ accountId: ctx.account.id, rawContact: "x", siteId }),
    ).rejects.toThrow("too short");
    expect(() =>
      serializeRealtimePayload({
        accountId: "not-a-uuid",
        ids: [],
        topic: "site.updated",
      }),
    ).toThrow("UUID");
    expect(() =>
      serializeRealtimePayload({
        accountId: ctx.account.id,
        ids: [],
        topic: "BAD TOPIC!",
      }),
    ).toThrow("ASCII");
    expect(() =>
      serializeRealtimePayload({
        accountId: ctx.account.id,
        ids: ["bad id with spaces!"],
        topic: "site.updated",
      }),
    ).toThrow("opaque");

    await expect(
      createSitePage({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        document: emptyDocument("Bad"),
        siteId,
        slug: "/",
        title: "",
      }),
    ).rejects.toThrow();
    await expect(
      publishSitePage({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        pageId: crypto.randomUUID(),
        siteId,
      }),
    ).rejects.toThrow();
    await expect(
      rollbackPageToVersion({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        pageId: crypto.randomUUID(),
        siteId,
        versionId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Target version not found");
  });
});
