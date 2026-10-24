"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { domains, users } from "@/lib/db/schema";
import { requireActor, requireRole, requireStepUp } from "@/lib/auth/session";
import { createSite, getSite, renameSite, setSiteStatus, updateSiteTheme, listSiteDomains } from "@/lib/sites";
import { addCustomDomain, makePrimaryDomain, removeDomain, retryDomainVerification, verifyDomain } from "@/lib/domains";
import { recordAudit } from "@/lib/audit";
import { invalidateSite } from "@/lib/cache";
import { enqueue } from "@/lib/queue";

export type ActionState = { ok: boolean; error?: string; message?: string; id?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function createSiteAction(formData: FormData): Promise<void> {
  const actor = await requireRole("admin");
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
    const actor = await requireRole("editor");
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
    const actor = await requireRole("admin");
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
    const actor = await requireRole("admin");
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
    const actor = await requireRole("editor");
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
    const actor = await requireRole("editor");
    await retryDomainVerification(input.domainId, actor);
    await enqueue("domain.verify", { domainId: input.domainId }, { dedupeKey: `domain.verify:${input.domainId}` });
    return { ok: true, message: "Queued a fresh verification attempt." };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDomainAction(input: { siteId: string; domainId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
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
    const actor = await requireRole("admin");
    await makePrimaryDomain(input.siteId, input.domainId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/domains`);
    return { ok: true, message: "Primary address updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSiteAction(input: { siteId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await requireStepUp(actor);
    const site = await getSite(input.siteId);
    if (!site) throw new Error("Site not found.");
    const hostnames = (await listSiteDomains(input.siteId)).map((domain) => domain.hostname);
    await setSiteStatus(input.siteId, "deleted");
    await db.update(domains).set({ status: "removed", removedAt: new Date() }).where(eq(domains.siteId, input.siteId));
    invalidateSite(input.siteId, hostnames);
    await recordAudit({
      action: "site_deleted",
      summary: `Deleted the site “${site.name}” (soft delete, restorable within the window)`,
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

export async function listAssignableStaff() {
  await ensureDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .orderBy(users.name);
}
