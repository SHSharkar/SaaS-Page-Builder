"use server";

import {
  requirePlatformCapability,
  requirePublicActionRateLimit,
} from "@/app/server/auth/guards";
import { eraseGuestByRawContact, superadminRevealGuestContact } from "./index";

export async function requestContactErasureAction(input: {
  rawContact: string;
  clientKey: string;
}): Promise<{ ok: boolean; erasedCount: number }> {
  await requirePublicActionRateLimit("my-data-erase", input.clientKey, 5, 300);
  const res = await eraseGuestByRawContact(input.rawContact);
  return { ok: true, erasedCount: res.erasedCount };
}

export async function revealContactForPlatformAction(input: {
  contactId: string;
  reason: string;
}): Promise<{ ok: boolean; contact: string }> {
  const actor = await requirePlatformCapability("platform.privacy.reveal");
  const contact = await superadminRevealGuestContact({
    contactId: input.contactId,
    actorUserId: actor.user.id,
    reason: input.reason,
  });
  return { ok: true, contact };
}
