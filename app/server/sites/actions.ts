"use server";

import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { createAccountSite, transitionSiteStatus } from "./index";

export async function createSiteAction(input: {
  name: string;
  slug?: string;
}): Promise<{ ok: boolean; siteId: string }> {
  const actor = await requireAccountCapability("sites.manage");
  const site = await createAccountSite({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    name: input.name,
    slug: input.slug,
  });
  await publishAccountChange(actor.account.id, "site.created", [site.id]);
  return { ok: true, siteId: site.id };
}

export async function updateSiteStatusAction(input: {
  siteId: string;
  nextStatus: "active" | "suspended" | "deleted";
}): Promise<{ ok: boolean; siteId: string }> {
  const actor = await requireAccountCapability("sites.manage");
  const updated = await transitionSiteStatus({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    nextStatus: input.nextStatus,
  });
  await publishAccountChange(actor.account.id, "site.status_changed", [
    updated.id,
  ]);
  return { ok: true, siteId: updated.id };
}
