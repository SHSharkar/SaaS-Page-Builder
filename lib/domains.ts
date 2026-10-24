import { promises as dns } from "node:dns";
import { and, eq, isNull } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, type Domain } from "@/lib/db/schema";
import { assertHostname, normalizeHostname } from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheDelete, cacheKeys } from "@/lib/cache";

export const MAX_DOMAINS_PER_SITE = 10;
export const VERIFICATION_WINDOW_DAYS = 7;
export const VERIFICATION_PREFIX = "_trofeo-pages";

export function verificationRecord(hostname: string, token: string) {
  return { name: `${VERIFICATION_PREFIX}.${hostname}`, value: `trofeo-verify=${token}` };
}

export async function addCustomDomain(siteId: string, rawHostname: string, actor: Actor): Promise<Domain> {
  await ensureDb();
  const hostname = assertHostname(rawHostname);

  const existing = await db
    .select({ id: domains.id, siteId: domains.siteId })
    .from(domains)
    .where(and(eq(domains.hostname, hostname), isNull(domains.removedAt)))
    .limit(1);
  if (existing.length) {
    throw new Error(
      existing[0].siteId === siteId
        ? "That hostname is already connected to this site."
        : "That hostname is connected to another site.",
    );
  }

  const live = await db
    .select({ id: domains.id })
    .from(domains)
    .where(and(eq(domains.siteId, siteId), isNull(domains.removedAt)));
  if (live.length >= MAX_DOMAINS_PER_SITE) {
    throw new Error(`A site can hold at most ${MAX_DOMAINS_PER_SITE} domains.`);
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const [domain] = await db
    .insert(domains)
    .values({
      siteId,
      hostname,
      kind: "custom",
      status: "pending",
      verificationToken: token,
      certificateIssuer: "lets_encrypt",
      certificateState: "none",
      requestedBy: actor.user.id,
    })
    .returning();

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

/**
 * DNS TXT verification. The certificate gate (Caddy's `ask` endpoint) reads
 * this table, so a hostname never receives a certificate before it is active.
 */
export async function verifyDomain(domainId: string, actor: Actor | null): Promise<VerificationOutcome> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new Error("Domain not found.");
  const token = domain.verificationToken ?? "";
  const record = verificationRecord(domain.hostname, token);

  if (domain.status === "active") {
    return { status: "active", checkedRecord: record };
  }

  const expired =
    domain.createdAt.getTime() + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000 < Date.now();

  let found = false;
  let reason: string | undefined;
  try {
    const answers = await dns.resolveTxt(record.name);
    found = answers.some((entry) => entry.join("").includes(`trofeo-verify=${token}`));
    if (!found) reason = `The TXT record exists but does not carry the verification token yet.`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "DNS_ERROR";
    reason =
      code === "ENOTFOUND" || code === "ENODATA"
        ? `No TXT record found at ${record.name} yet. DNS can take a few minutes to propagate.`
        : `DNS lookups are unavailable from this environment (${code}). Recheck from the production resolver.`;
  }

  if (found) {
    const [updated] = await db
      .update(domains)
      .set({
        status: "active",
        verifiedAt: new Date(),
        failureReason: null,
        certificateState: "issued",
        updatedAt: new Date(),
      })
      .where(eq(domains.id, domainId))
      .returning();
    cacheDelete(cacheKeys.domain(domain.hostname));
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
      failureReason: expired ? `Verification window expired after ${VERIFICATION_WINDOW_DAYS} days.` : reason,
      updatedAt: new Date(),
    })
    .where(eq(domains.id, domainId));
  cacheDelete(cacheKeys.domain(domain.hostname));

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

export async function retryDomainVerification(domainId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new Error("Domain not found.");
  await db
    .update(domains)
    .set({ status: "pending", failureReason: null, updatedAt: new Date() })
    .where(eq(domains.id, domainId));
  cacheDelete(cacheKeys.domain(domain.hostname));
}

export async function removeDomain(domainId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain) throw new Error("Domain not found.");
  if (domain.kind === "platform_subdomain") {
    throw new Error("The platform address always serves the site and cannot be removed.");
  }
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

  // Unbinding takes the address dark immediately.
  cacheDelete(cacheKeys.domain(domain.hostname));
  await recordAudit({
    action: "domain_removed",
    summary: `Disconnected ${domain.hostname}`,
    siteId: domain.siteId,
    actor,
    targetType: "domain",
    targetId: domain.id,
  });
}

export async function makePrimaryDomain(siteId: string, domainId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.siteId, siteId)))
    .limit(1);
  if (!domain) throw new Error("Domain not found.");
  if (domain.status !== "active") throw new Error("Verify the domain before making it primary.");
  await db.transaction(async (tx) => {
    await tx.update(domains).set({ isPrimary: false }).where(eq(domains.siteId, siteId));
    await tx.update(domains).set({ isPrimary: true }).where(eq(domains.id, domainId));
  });
  cacheDelete(cacheKeys.domain(domain.hostname));
  await recordAudit({
    action: "domain_verified",
    summary: `Made ${domain.hostname} the primary address`,
    siteId,
    actor,
    targetType: "domain",
    targetId: domainId,
  });
}

/**
 * The certificate gate: issuance happens only for a hostname recorded against
 * an active site (the Caddy ask-endpoint rule, PRD M4).
 */
export async function canIssueCertificate(rawHostname: string): Promise<boolean> {
  await ensureDb();
  const { sites } = await import("@/lib/db/schema");
  const [row] = await db
    .select({ domainId: domains.id })
    .from(domains)
    .innerJoin(sites, eq(sites.id, domains.siteId))
    .where(
      and(
        eq(domains.hostname, normalizeHostname(rawHostname)),
        isNull(domains.removedAt),
        eq(sites.status, "active"),
      ),
    )
    .limit(1);
  return !!row;
}
