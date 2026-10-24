import "server-only";
import {
  generateShortCode,
  goShortPath,
  isValidScanSegment,
  isValidShortCode,
} from "@/lib/short-paths";
import type { ShortLinkKind } from "@/lib/enums";
import { computeLookupHash } from "@/app/server/crypto";
import { getDbPool } from "@/app/server/db/client";
import { shortLinks } from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { consumeSlidingBudget } from "@/app/server/redis/client";

const EXPIRY_SECONDS_BY_KIND: Readonly<Record<ShortLinkKind, number>> = {
  invitation: 7 * 86_400,
  preview: 3_600,
  export: 1_800,
  password_reset: 1_800,
  my_data: 3_600,
};

export async function issueShortLink(input: {
  accountId: string;
  actorUserId: string | null;
  kind: ShortLinkKind;
  targetPath: string;
}): Promise<{ code: string; path: string; expiresAt: Date }> {
  const code = generateShortCode();
  const codeHash = computeLookupHash("short-link", code);
  const expiresAt = new Date(
    Date.now() + EXPIRY_SECONDS_BY_KIND[input.kind] * 1_000,
  );

  await withAccount(input.accountId, async (tx) => {
    await tx.insert(shortLinks).values({
      accountId: input.accountId,
      codeHash,
      kind: input.kind,
      targetPath: input.targetPath,
      createdBy: input.actorUserId,
      expiresAt,
    });
  });

  return {
    code,
    path: goShortPath(code),
    expiresAt,
  };
}

export const SHORT_LINK_MISS_LIMIT = 30;
export const SHORT_LINK_MISS_WINDOW_SECONDS = 300;

async function chargeShortLinkMiss(clientIp: string): Promise<boolean> {
  const budget = await consumeSlidingBudget(
    `shortlink:miss:${clientIp}`,
    SHORT_LINK_MISS_LIMIT,
    SHORT_LINK_MISS_WINDOW_SECONDS,
  );
  return budget.allowed;
}

export async function resolveExpiringShortLink(
  code: string,
  clientIp: string,
): Promise<{ targetPath: string; kind: string } | null> {
  if (!isValidShortCode(code)) {
    await chargeShortLinkMiss(clientIp);
    return null;
  }
  const codeHash = computeLookupHash("short-link", code);
  const res = await getDbPool().query<{
    id: string;
    kind: string;
    target_path: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>("SELECT * FROM resolve_short_link_by_hash($1)", [codeHash]);

  const row = res.rows[0];
  if (!row) {
    await chargeShortLinkMiss(clientIp);
    return null;
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await chargeShortLinkMiss(clientIp);
    return null;
  }
  return {
    targetPath: row.target_path,
    kind: row.kind,
  };
}

export async function resolveDurableScanShare(segment: string): Promise<{
  siteId: string;
  siteSlug: string;
  siteName: string;
  scanCode: string;
} | null> {
  if (!isValidScanSegment(segment)) {
    return null;
  }
  const res = await getDbPool().query<{
    site_id: string;
    site_slug: string;
    site_name: string;
    scan_code: string;
  }>("SELECT * FROM resolve_scan_share_site($1)", [segment]);
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return {
    siteId: row.site_id,
    siteSlug: row.site_slug,
    siteName: row.site_name,
    scanCode: row.scan_code,
  };
}
