"use server";

import { headers } from "next/headers";
import {
  requirePlatformCapability,
  requirePublicActionRateLimit,
} from "@/app/server/auth/guards";
import { CLIENT_IP_HEADER, UNKNOWN_CLIENT_IP } from "@/lib/request-headers";
import { eraseGuestByRawContact, superadminRevealGuestContact } from "./index";

function fallbackClientKey(): string {
  return `${UNKNOWN_CLIENT_IP}:${process.pid}`;
}

async function trustedClientKey(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const ip = requestHeaders.get(CLIENT_IP_HEADER)?.trim();
    return ip && ip.length > 0 ? ip : fallbackClientKey();
  } catch {
    return fallbackClientKey();
  }
}

export async function requestContactErasureAction(input: {
  rawContact: string;
}): Promise<{ ok: boolean; erasedCount: number }> {
  await requirePublicActionRateLimit(
    "my-data-erase",
    await trustedClientKey(),
    5,
    300,
  );
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
