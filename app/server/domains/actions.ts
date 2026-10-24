"use server";

import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { connectCustomDomain, markDomainVerified } from "./index";

export async function connectDomainAction(input: {
  siteId: string;
  hostname: string;
}): Promise<{ ok: boolean; domainId: string }> {
  const actor = await requireAccountCapability("domains.manage");
  const domain = await connectCustomDomain({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    hostname: input.hostname,
  });
  await publishAccountChange(actor.account.id, "domain.connected", [domain.id]);
  return { ok: true, domainId: domain.id };
}

export async function verifyDomainAction(input: {
  domainId: string;
}): Promise<{ ok: boolean; domainId: string }> {
  const actor = await requireAccountCapability("domains.manage");
  const domain = await markDomainVerified({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    domainId: input.domainId,
  });
  await publishAccountChange(actor.account.id, "domain.verified", [domain.id]);
  return { ok: true, domainId: domain.id };
}
