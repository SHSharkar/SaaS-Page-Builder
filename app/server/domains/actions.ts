"use server";

import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { connectCustomDomain, verifyCustomDomain } from "./index";

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

export async function verifyDomainAction(input: { domainId: string }): Promise<{
  ok: boolean;
  domainId: string;
  verified: boolean;
  recordName: string;
}> {
  const actor = await requireAccountCapability("domains.manage");
  const result = await verifyCustomDomain({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    domainId: input.domainId,
  });
  await publishAccountChange(actor.account.id, "domain.verified", [
    result.domain.id,
  ]);
  return {
    ok: true,
    domainId: result.domain.id,
    verified: result.verified,
    recordName: result.recordName,
  };
}
