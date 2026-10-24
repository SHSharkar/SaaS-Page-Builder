"use server";

import { requirePlatformCapability } from "@/app/server/auth/guards";
import { setTenantAccountStatus } from "./index";

export async function setAccountStatusPlatformAction(input: {
  accountId: string;
  status: "active" | "suspended";
}): Promise<{ ok: boolean }> {
  const actor = await requirePlatformCapability("platform.accounts.manage");
  await setTenantAccountStatus({
    actorUserId: actor.user.id,
    accountId: input.accountId,
    status: input.status,
  });
  return { ok: true };
}
