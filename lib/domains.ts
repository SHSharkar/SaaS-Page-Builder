import "server-only";
import { promises as dns } from "node:dns";
import { and, eq, isNull } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, sites, type Domain } from "@/lib/db/schema";
import { assertHostname, normalizeHostname } from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { invalidateDomain } from "@/lib/cache";
import { assertTransition } from "@/lib/lifecycle";
import { getSettingNumber } from "@/lib/settings";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { enqueue } from "@/lib/queue";

export const MAX_DOMAINS_PER_SITE = 10;
export const VERIFICATION_WINDOW_DAYS = 7;
export const VERIFICATION_PREFIX = "_trofeo-pages";

export function verificationRecord(hostname: string, token: string) {
  return { name: `${VERIFICATION_PREFIX}.${hostname}`, value: `trofeo-verify=${token}` };
}

export async function addCustomDomain(
  siteId: string,
  rawHostname: string,
  actor: Actor,
): Promise<Domain> {
  await ensureDb();
  const hostname = assertHostname(rawHostname);

  const existing = await db
    .select({ id: domains.id, siteId: domains.siteId })
    .from(domains)
    .where(and(eq(domains.hostname, hostname), isNull(domains.removedAt)))
    .limit(1);
  if (existing.length) {
    throw new ConflictError(
      existing[0].siteId === siteId
        ? "That hostname is already connected to this site."
        : "That hostname is connected to another site.",
    );
  }

  const maxDomains = await getSettingNumber("limits.domains_per_site", MAX_DOMAINS_PER_SITE);
  const live = await db
    .select({ id: domains.id })
    .from(domains)
    .where(and(eq(domains.siteId, siteId), isNull(domains.removedAt)));
  if (live.length >= maxDomains) {
    throw new ValidationError(`A site can hold at most ${maxDomains} domains.`);
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + VERIFICATION_WINDOW_DAYS * 86_400_000);

  const [domain] = await db
    .insert(domains)
    .values({
      siteId,
      hostname,
      kind: "custom",
      status: "pending",
      verificationToken: token,
      expiresAt,
      certificateIssuer: "lets_encrypt",
      certificateState: "none",
      requestedBy: actor.user.id,
    })
    .returning();

  await enqueue(
    "domain.verify",
    { domainId: domain.id },
    {
      dedupeKey: `domain:verify:${domain.id}`,
      runAt: new Date(Date.now() + 60_000),
    },
  );

  await recordAudit({
    action: "domain_added",
    summary: `Started connecting ${hostname}`,
    siteId,
    actor,
    targetType: "domain",
    targetId: domain.id,
  });

  return domain;
}

export type VerificationOutcome = {
  status: Domain["status"];
  reason?: string;
  checkedRecord: { name: string; value: string };
};

export async function verifyDomain(
  domainId: string,
  actor: Actor | null,
): Promise<VerificationOutcome> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new NotFoundError("Domain not found.");
  const token = domain.verificationToken ?? "";
  const record = verificationRecord(domain.hostname, token);

  if (domain.status === "active") {
    return { status: "active", checkedRecord: record };
  }
  if (domain.status === "removed") {
    assertTransition(
      "domain",
      domain.status,
      "active",
      "This hostname was disconnected; connect it again before verifying.",
    );
  }

  assertTransition("domain", domain.status, "verifying");
  const now = new Date();
  if (domain.status === "pending") {
    await db
      .update(domains)
      .set({ status: "verifying", updatedAt: now })
      .where(eq(domains.id, domainId));
  }

  const windowCutoff =
    domain.expiresAt?.getTime() ??
    domain.createdAt.getTime() + VERIFICATION_WINDOW_DAYS * 86_400_000;
  const expired = windowCutoff < now.getTime();

  let found = false;
  let reason: string | undefined;
  try {
    const answers = await dns.resolveTxt(record.name);
    found = answers.some((entry) => entry.join("").includes(`trofeo-verify=${token}`));
    if (!found) {
      reason = "The TXT record exists but does not carry the verification token yet.";
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "DNS_ERROR";
    reason =
      code === "ENOTFOUND" || code === "ENODATA"
        ? `No TXT record found at ${record.name} yet. DNS can take a few minutes to propagate.`
        : `DNS lookups are unavailable from this environment (${code}). Recheck from the production resolver.`;
  }

  if (found) {
    assertTransition("domain", "verifying", "active");
    const [updated] = await db
      .update(domains)
      .set({
        status: "active",
        verifiedAt: now,
        lastCheckedAt: now,
        checkAttempts: domain.checkAttempts + 1,
        failureReason: null,
        certificateState: "issued",
        updatedAt: now,
      })
      .where(eq(domains.id, domainId))
      .returning();
    await invalidateDomain(domain.hostname);
    await recordAudit({
      action: "domain_verified",
      summary: `${domain.hostname} verified and certified`,
      siteId: domain.siteId,
      actor,
      targetType: "domain",
      targetId: domain.id,
    });
    return { status: updated.status, checkedRecord: record };
  }

  const nextStatus: Domain["status"] = expired ? "failed" : "verifying";
  await db
    .update(domains)
    .set({
      status: nextStatus,
      lastCheckedAt: now,
      checkAttempts: domain.checkAttempts + 1,
      failureReason: expired
        ? `Verification window expired after ${VERIFICATION_WINDOW_DAYS} days.`
        : reason,
      updatedAt: now,
    })
    .where(eq(domains.id, domainId));
  await invalidateDomain(domain.hostname);

  if (nextStatus === "failed") {
    await recordAudit({
      action: "domain_failed",
      summary: `Verification failed for ${domain.hostname}`,
      siteId: domain.siteId,
      actor,
      targetType: "domain",
      targetId: domain.id,
      detail: { reason },
    });
  }

  return { status: nextStatus, reason, checkedRecord: record };
}

export async function retryDomainVerification(domainId: string, _actor: Actor): Promise<void> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new NotFoundError("Domain not found.");
  assertTransition("domain", domain.status, "pending");
  const expiresAt = new Date(Date.now() + VERIFICATION_WINDOW_DAYS * 86_400_000);
  await db
    .update(domains)
    .set({
      status: "pending",
      failureReason: null,
      expiresAt,
      checkAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(domains.id, domainId));
  await invalidateDomain(domain.hostname);
  await enqueue(
    "domain.verify",
    { domainId },
    { dedupeKey: `domain:verify:${domainId}`, runAt: new Date(Date.now() + 15_000) },
  );
}

export async function removeDomain(domainId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new NotFoundError("Domain not found.");
  if (domain.kind === "platform_subdomain") {
    throw new ValidationError("The platform address always serves the site and cannot be removed.");
  }
  assertTransition("domain", domain.status, "removed");
  await db
    .update(domains)
    .set({
      status: "removed",
      removedAt: new Date(),
      isPrimary: false,
      certificateState: "none",
      updatedAt: new Date(),
    })
    .where(eq(domains.id, domainId));

  await invalidateDomain(domain.hostname);
  await recordAudit({
    action: "domain_removed",
    summary: `Disconnected ${domain.hostname}`,
    siteId: domain.siteId,
    actor,
    targetType: "domain",
    targetId: domain.id,
  });
}

export async function makePrimaryDomain(
  siteId: string,
  domainId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.siteId, siteId)))
    .limit(1);
  if (!domain) throw new NotFoundError("Domain not found.");
  if (domain.status !== "active") {
    throw new ValidationError("Verify the domain before making it primary.");
  }
  await db.transaction(async (tx) => {
    await tx.update(domains).set({ isPrimary: false }).where(eq(domains.siteId, siteId));
    await tx.update(domains).set({ isPrimary: true }).where(eq(domains.id, domainId));
  });
  await invalidateDomain(domain.hostname);
  await recordAudit({
    action: "domain_primary_changed",
    summary: `Made ${domain.hostname} the primary address`,
    siteId,
    actor,
    targetType: "domain",
    targetId: domainId,
  });
}

import { listSiteDomains } from "@/lib/sites";
export { listSiteDomains };

export async function primaryHostname(siteId: string): Promise<string | null> {
  const rows = await listSiteDomains(siteId);
  const primary = rows.find((r) => r.isPrimary) ?? rows[0];
  return primary?.hostname ?? null;
}

export async function canIssueCertificate(rawHostname: string): Promise<boolean> {
  await ensureDb();
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return false;
  const [row] = await db
    .select({ domainId: domains.id })
    .from(domains)
    .innerJoin(sites, eq(sites.id, domains.siteId))
    .where(
      and(
        eq(domains.hostname, hostname),
        eq(domains.status, "active"),
        isNull(domains.removedAt),
        eq(sites.status, "active"),
        isNull(sites.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}
