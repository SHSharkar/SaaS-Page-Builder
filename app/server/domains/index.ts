import "server-only";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { and, asc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { normalizeHostname } from "@/lib/documents";
import { siteDomains, type SiteDomainRow } from "@/app/server/db/schema";
import { getDbPool } from "@/app/server/db/client";
import { withAccount, withPlatform } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { getEnv } from "@/app/server/env";
import { assertTransition } from "@/app/server/lifecycle";
import { isUniqueViolation } from "@/app/server/db/errors";

export const DOMAIN_VERIFICATION_PREFIX = "_spb-verify";

export function verificationRecordName(hostname: string): string {
  return `${DOMAIN_VERIFICATION_PREFIX}.${normalizeHostname(hostname)}`;
}

export type TxtLookup = (name: string) => Promise<string[][]>;

export interface DomainOwnershipResult {
  readonly verified: boolean;
  readonly recordName: string;
  readonly observedValues: readonly string[];
}

export async function verifyDomainOwnership(input: {
  hostname: string;
  token: string;
  lookupTxt?: TxtLookup;
}): Promise<DomainOwnershipResult> {
  const recordName = verificationRecordName(input.hostname);
  const lookup = input.lookupTxt ?? resolveTxt;
  let records: string[][];
  try {
    records = await lookup(recordName);
  } catch {
    return { verified: false, recordName, observedValues: [] };
  }
  const observedValues = records.map((chunks) => chunks.join("").trim());
  return {
    verified: observedValues.includes(input.token.trim()),
    recordName,
    observedValues,
  };
}

export async function verifyCustomDomain(input: {
  accountId: string;
  actorUserId: string | null;
  domainId: string;
  lookupTxt?: TxtLookup;
}): Promise<{ domain: SiteDomainRow; verified: boolean; recordName: string }> {
  const domain = await withAccount(input.accountId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(siteDomains)
      .where(
        and(eq(siteDomains.id, input.domainId), isNull(siteDomains.removedAt)),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Domain not found");
    }
    if (existing.kind !== "custom" || !existing.verificationToken) {
      throw new Error("Only custom domains require DNS verification");
    }
    assertTransition("domain", existing.status, "verifying");
    const [updated] = await tx
      .update(siteDomains)
      .set({ status: "verifying", updatedAt: new Date() })
      .where(eq(siteDomains.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to start domain verification");
    }
    return updated;
  });

  const outcome = await verifyDomainOwnership({
    hostname: domain.hostname,
    token: domain.verificationToken ?? "",
    lookupTxt: input.lookupTxt,
  });

  const settled = await withAccount(input.accountId, async (tx) => {
    const [updated] = await tx
      .update(siteDomains)
      .set({
        status: outcome.verified ? "active" : "failed",
        certificateState: outcome.verified ? "pending" : "none",
        verifiedAt: outcome.verified ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(siteDomains.id, domain.id))
      .returning();
    if (!updated) {
      throw new Error("Domain not found");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: outcome.verified
        ? "domain.verified"
        : "domain.verification_failed",
      targetType: "site_domain",
      targetId: updated.id,
      summary: outcome.verified
        ? `Verified custom domain ${updated.hostname} via DNS TXT record`
        : `DNS TXT record ${outcome.recordName} did not match for ${updated.hostname}`,
    });
    return updated;
  });

  return {
    domain: settled,
    verified: outcome.verified,
    recordName: outcome.recordName,
  };
}

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
      .returning()
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new Error(
            `The hostname ${hostname} is already connected to a workspace`,
          );
        }
        throw error;
      });
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

export interface PendingDomainVerification {
  readonly checked: number;
  readonly verified: number;
}

export async function verifyPendingDomains(options?: {
  limit?: number;
  lookupTxt?: TxtLookup;
}): Promise<PendingDomainVerification> {
  const pending = await withPlatform((tx) =>
    tx
      .select({
        id: siteDomains.id,
        accountId: siteDomains.accountId,
        requestedBy: siteDomains.requestedBy,
      })
      .from(siteDomains)
      .where(
        and(
          eq(siteDomains.kind, "custom"),
          inArray(siteDomains.status, ["pending", "verifying", "failed"]),
          isNotNull(siteDomains.verificationToken),
          isNull(siteDomains.removedAt),
        ),
      )
      .limit(options?.limit ?? 25),
  );

  let verified = 0;
  for (const domain of pending) {
    const outcome = await verifyCustomDomain({
      accountId: domain.accountId,
      actorUserId: domain.requestedBy,
      domainId: domain.id,
      lookupTxt: options?.lookupTxt,
    }).catch(() => null);
    if (outcome?.verified) {
      verified += 1;
    }
  }
  return { checked: pending.length, verified };
}

export async function removeSiteDomain(input: {
  accountId: string;
  actorUserId: string;
  domainId: string;
}): Promise<SiteDomainRow> {
  const removed = await withAccount(input.accountId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(siteDomains)
      .where(
        and(eq(siteDomains.id, input.domainId), isNull(siteDomains.removedAt)),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Domain not found");
    }
    assertTransition("domain", existing.status, "removed");
    const [updated] = await tx
      .update(siteDomains)
      .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
      .where(eq(siteDomains.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to remove domain");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "domain.removed",
      targetType: "site_domain",
      targetId: updated.id,
      summary: `Removed domain ${updated.hostname}`,
    });
    return updated;
  });
  return removed;
}
