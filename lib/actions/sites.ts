"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, userRoles, users } from "@/lib/db/schema";
import { requireActor, requirePermission, requireStepUp } from "@/lib/auth/session";
import { listRoles } from "@/lib/auth/rbac";
import {
  createSite,
  getSite,
  getSiteRow,
  purgeSite,
  renameSite,
  restoreSite,
  setSiteStatus,
  updateSiteTheme,
  listSiteDomains,
} from "@/lib/sites";
import { KEEP, daysFromNow } from "@/lib/lifecycle";
import { addCustomDomain, makePrimaryDomain, removeDomain, retryDomainVerification, verifyDomain } from "@/lib/domains";
import { recordAudit } from "@/lib/audit";
import { invalidateSite } from "@/lib/cache";
import { enqueue } from "@/lib/queue";

export type ActionState = { ok: boolean; error?: string; message?: string; id?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function createSiteAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("site.create");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const accent = String(formData.get("accent") ?? "#c8a24a");
  if (!name) throw new Error("Give the site a name.");

  const site = await createSite({
    name,
    slug: slug || name,
    createdBy: actor.user.id,
    theme: { accent, accentContrast: "#0b1120" },
  });

  await recordAudit({
    action: "site_created",
    summary: `Created the site “${site.name}” at ${site.slug}`,
    siteId: site.id,
    actor,
    targetType: "site",
    targetId: site.id,
  });

  redirect(`/admin/sites/${site.id}`);
}

export async function updateSiteAction(input: {
  siteId: string;
  name: string;
  theme: Record<string, string>;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("site.update");
    const site = await getSite(input.siteId);
    if (!site) throw new Error("Site not found.");
    if (input.name.trim() && input.name !== site.name) {
      await renameSite(input.siteId, input.name);
      await recordAudit({
        action: "site_updated",
        summary: `Renamed the site to “${input.name.trim()}”`,
        siteId: input.siteId,
        actor,
        targetType: "site",
        targetId: input.siteId,
      });
    }
    await updateSiteTheme(input.siteId, input.theme as never);
    invalidateSite(input.siteId);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Site appearance saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function suspendSiteAction(input: { siteId: string; suspend: boolean }): Promise<ActionState> {
  try {
    const actor = await requirePermission("site.suspend");
    await requireStepUp(actor);
    const site = await getSite(input.siteId);
    if (!site) throw new Error("Site not found.");
    const hostnames = (await listSiteDomains(input.siteId)).map((domain) => domain.hostname);
    await setSiteStatus(input.siteId, input.suspend ? "suspended" : "active");
    // Serving stops (or resumes) immediately: clear every cache key for the site.
    invalidateSite(input.siteId, hostnames);
    await recordAudit({
      action: input.suspend ? "site_suspended" : "site_updated",
      summary: input.suspend ? `Suspended “${site.name}”` : `Resumed “${site.name}”`,
      siteId: input.siteId,
      actor,
      targetType: "site",
      targetId: input.siteId,
    });
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: input.suspend ? "Site suspended" : "Site resumed" };
  } catch (error) {
    return failure(error);
  }
}

export async function addDomainAction(input: { siteId: string; hostname: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("domain.manage");
    await requireStepUp(actor);
    const domain = await addCustomDomain(input.siteId, input.hostname, actor);
    await enqueue("domain.verify", { domainId: domain.id }, { dedupeKey: `domain.verify:${domain.id}` });
    revalidatePath(`/admin/sites/${input.siteId}/domains`);
    return { ok: true, message: `Added ${domain.hostname}. Add the DNS record, then verify.`, id: domain.id };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyDomainAction(input: { siteId: string; domainId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("domain.manage");
    const outcome = await verifyDomain(input.domainId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/domains`);
    if (outcome.status === "active") return { ok: true, message: "Verified. The certificate gate now allows this host." };
    return {
      ok: false,
      error: outcome.reason ?? "Not verified yet. DNS can take a few minutes.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function retryDomainAction(input: { siteId: string; domainId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("domain.manage");
    await retryDomainVerification(input.domainId, actor);
    await enqueue("domain.verify", { domainId: input.domainId }, { dedupeKey: `domain.verify:${input.domainId}` });
    return { ok: true, message: "Queued a fresh verification attempt." };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDomainAction(input: { siteId: string; domainId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("domain.manage");
    await requireStepUp(actor);
    await removeDomain(input.domainId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/domains`);
    return { ok: true, message: "Hostname disconnected — it stops serving now." };
  } catch (error) {
    return failure(error);
  }
}

export async function makePrimaryDomainAction(input: { siteId: string; domainId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("domain.manage");
    await makePrimaryDomain(input.siteId, input.domainId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/domains`);
    return { ok: true, message: "Primary address updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSiteAction(input: { siteId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("site.delete");
    await requireStepUp(actor);
    const site = await getSite(input.siteId);
    if (!site) throw new Error("Site not found.");
    const hostnames = (await listSiteDomains(input.siteId)).map((domain) => domain.hostname);
    await setSiteStatus(input.siteId, "deleted");
    await db.update(domains).set({ status: "removed", removedAt: new Date() }).where(eq(domains.siteId, input.siteId));
    invalidateSite(input.siteId, hostnames);
    // Two-stage: serving stops now, rows stay for the restore window, and the
    // queued purge is a no-op if the site is restored first.
    await enqueue(
      "site.purge",
      { siteId: input.siteId },
      { runAt: daysFromNow(KEEP.siteRestoreDays), dedupeKey: `site.purge:${input.siteId}` },
    );
    await recordAudit({
      action: "site_deleted",
      summary: `Deleted the site “${site.name}” — restorable for ${KEEP.siteRestoreDays} days`,
      siteId: input.siteId,
      actor,
      targetType: "site",
      targetId: input.siteId,
    });
    redirect("/admin/sites");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return failure(error);
  }
}

export async function restoreSiteAction(input: { siteId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("site.restore");
    await requireStepUp(actor);
    const site = await getSiteRow(input.siteId);
    if (!site) throw new Error("Site not found.");
    const restored = await restoreSite(input.siteId);
    await db
      .update(domains)
      .set({ status: "active", removedAt: null, updatedAt: new Date() })
      .where(and(eq(domains.siteId, input.siteId), eq(domains.status, "removed"), eq(domains.kind, "platform_subdomain")));
    await recordAudit({
      action: "site_restored",
      summary: `Restored “${restored.name}” from deletion`,
      siteId: input.siteId,
      actor,
      targetType: "site",
      targetId: input.siteId,
    });
    revalidatePath("/admin/sites");
    return { ok: true, message: `“${restored.name}” is active again. Publish or republish its pages to serve them.` };
  } catch (error) {
    return failure(error);
  }
}

export async function purgeSiteAction(input: { siteId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("site.purge");
    await requireStepUp(actor);
    const site = await getSiteRow(input.siteId);
    if (!site) throw new Error("Site not found.");
    if (site.status !== "deleted") throw new Error("Suspend or delete the site before purging it.");
    await purgeSite(input.siteId);
    await recordAudit({
      action: "site_purged",
      summary: `Purged “${site.name}” and every row that belonged to it`,
      actor,
      targetType: "site",
      targetId: input.siteId,
    });
    revalidatePath("/admin/sites");
    return { ok: true, message: "Site purged. Its hostnames are free to reuse." };
  } catch (error) {
    return failure(error);
  }
}

/** Soft-deleted sites awaiting restore or purge, newest first. */
export async function listDeletedSitesForAdmin() {
  const { listDeletedSites } = await import("@/lib/sites");
  return (await listDeletedSites()).sort((a, b) => (b.site.deletedAt?.getTime() ?? 0) - (a.site.deletedAt?.getTime() ?? 0));
}

export async function listAssignableStaff() {
  await ensureDb();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, status: users.status })
    .from(users)
    .orderBy(users.name);
  const roles = await listRoles();
  const assignments = await db
    .select({ userId: userRoles.userId, roleId: userRoles.roleId })
    .from(userRoles);
  return rows.map((row) => ({
    ...row,
    roles: roles
      .filter((role) => assignments.some((entry) => entry.userId === row.id && entry.roleId === role.id))
      .map((role) => role.name),
  }));
}
