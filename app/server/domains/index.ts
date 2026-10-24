import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { normalizeHostname } from "@/lib/documents";
import { siteDomains, type SiteDomainRow } from "@/app/server/db/schema";
import { getDbPool } from "@/app/server/db/client";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { getEnv } from "@/app/server/env";

export function isPrimaryPlatformHost(rawHost: string): boolean {
  const normalized = normalizeHostname(rawHost);
  const primary = normalizeHostname(getEnv().PRIMARY_DOMAIN);
  if (normalized === primary) {
    return true;
  }
  if (
    getEnv().NODE_ENV !== "production" &&
    (normalized === "localhost" ||
      normalized === "127.0.0.1" ||
      normalized.endsWith(".e2b.app"))
  ) {
    return true;
  }
  return false;
}

export async function listSiteDomains(
  accountId: string,
  siteId?: string,
): Promise<SiteDomainRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(siteDomains)
      .where(
        siteId
          ? and(eq(siteDomains.siteId, siteId), isNull(siteDomains.removedAt))
          : isNull(siteDomains.removedAt),
      )
      .orderBy(asc(siteDomains.hostname)),
  );
}

export async function connectCustomDomain(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  hostname: string;
}): Promise<SiteDomainRow> {
  const hostname = normalizeHostname(input.hostname);
  if (!hostname || !hostname.includes(".")) {
    throw new Error("Enter a valid custom domain hostname");
  }
  const token = `spb-verify=${randomBytes(18).toString("hex")}`;

  return withAccount(input.accountId, async (tx) => {
    const [created] = await tx
      .insert(siteDomains)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        hostname,
        kind: "custom",
        isPrimary: false,
        status: "pending",
        verificationToken: token,
        certificateState: "none",
        requestedBy: input.actorUserId,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to connect custom domain");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "domain.connected",
      targetType: "site_domain",
      targetId: created.id,
      summary: `Connected custom domain ${hostname}`,
    });
    return created;
  });
}

export async function markDomainVerified(input: {
  accountId: string;
  actorUserId: string;
  domainId: string;
}): Promise<SiteDomainRow> {
  return withAccount(input.accountId, async (tx) => {
    const [updated] = await tx
      .update(siteDomains)
      .set({
        status: "active",
        certificateState: "issued",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(siteDomains.id, input.domainId))
      .returning();
    if (!updated) {
      throw new Error("Domain not found");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "domain.verified",
      targetType: "site_domain",
      targetId: updated.id,
      summary: `Verified custom domain ${updated.hostname}`,
    });
    return updated;
  });
}

export async function checkTlsDomainAllowed(
  hostname: string,
): Promise<boolean> {
  const clean = normalizeHostname(hostname);
  if (!clean) {
    return false;
  }
  const res = await getDbPool().query<{ ok: boolean }>(
    "SELECT verify_active_tls_domain($1) AS ok",
    [clean],
  );
  return Boolean(res.rows[0]?.ok);
}
