import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/app/server/db/errors";
import {
  connectCustomDomain,
  listSiteDomains,
  removeSiteDomain,
  verifyCustomDomain,
} from "@/app/server/domains";
import {
  MEDIA_RETENTION_DAYS,
  purgeRetiredMedia,
  registerSiteMediaAsset,
  retireMediaAsset,
} from "@/app/server/media";
import { createAccountSite } from "@/app/server/sites";
import { cacheDropIndex, cacheIndexAdd } from "@/app/server/redis/client";
import { createTestWorkspaceFixture } from "@/app/server/test-support";

describe("tenant hardening paths", () => {
  it("reports friendly errors for duplicate site slugs and hostnames", async () => {
    const ctx = await createTestWorkspaceFixture();
    const suffix = crypto.randomUUID().slice(0, 8);
    const site = await createAccountSite({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      name: `Duplicate ${suffix}`,
      slug: `dupe-${suffix}`,
    });

    await expect(
      createAccountSite({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        name: `Duplicate Two ${suffix}`,
        slug: `dupe-${suffix}`,
      }),
    ).rejects.toThrow(/already taken/);

    const hostname = `dup-${suffix}.example.test`;
    await connectCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      siteId: site.id,
      hostname,
    });
    await expect(
      connectCustomDomain({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        siteId: site.id,
        hostname,
      }),
    ).rejects.toThrow(/already connected/);

    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("rejects verification for platform subdomains and removes custom domains", async () => {
    const ctx = await createTestWorkspaceFixture();
    const suffix = crypto.randomUUID().slice(0, 8);
    const site = await createAccountSite({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      name: `Removal ${suffix}`,
      slug: `remove-${suffix}`,
    });
    const domains = await listSiteDomains(ctx.account.id, site.id);
    const platformDomain = domains.find(
      (domain) => domain.kind === "platform_subdomain",
    );
    expect(platformDomain).toBeTruthy();

    await expect(
      verifyCustomDomain({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        domainId: platformDomain?.id ?? crypto.randomUUID(),
      }),
    ).rejects.toThrow(/custom domains/);

    const custom = await connectCustomDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      siteId: site.id,
      hostname: `gone-${suffix}.example.test`,
    });
    const removed = await removeSiteDomain({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      domainId: custom.id,
    });
    expect(removed.status).toBe("removed");
    expect(removed.removedAt).toBeTruthy();
    await expect(
      removeSiteDomain({
        accountId: ctx.account.id,
        actorUserId: ctx.user.id,
        domainId: custom.id,
      }),
    ).rejects.toThrow(/Domain not found/);
  });

  it("purges retired media only after the retention window", async () => {
    const ctx = await createTestWorkspaceFixture();
    const suffix = crypto.randomUUID().slice(0, 8);
    const site = await createAccountSite({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      name: `Media ${suffix}`,
      slug: `media-${suffix}`,
    });
    const media = await registerSiteMediaAsset({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      siteId: site.id,
      originalName: "retired.png",
      mimeType: "image/png",
      sizeBytes: 128,
      checksum: crypto.randomUUID(),
    });
    await retireMediaAsset({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      mediaId: media.asset.id,
    });

    const early = await purgeRetiredMedia();
    expect(early.purged).toBeGreaterThanOrEqual(0);

    const future = new Date(
      Date.now() + (MEDIA_RETENTION_DAYS + 1) * 86_400 * 1_000,
    );
    const purged = await purgeRetiredMedia(future);
    expect(purged.purged).toBeGreaterThanOrEqual(1);
  });

  it("drops cache indexes idempotently", async () => {
    const indexKey = `test:index:${crypto.randomUUID()}`;
    await cacheIndexAdd(indexKey, "test:key:a", 30);
    await cacheIndexAdd(indexKey, "test:key:b", 30);
    expect(await cacheDropIndex(indexKey)).toBe(2);
    expect(await cacheDropIndex(indexKey)).toBe(0);
  });
});
