"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/lib/auth/session";
import { listSessions, revokeSessionById } from "@/lib/auth/rbac";
import { auth } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";

export type AccountActionState = { ok: boolean; error?: string; message?: string };

export async function revokeOwnSessionAction(input: { sessionId: string }): Promise<AccountActionState> {
  try {
    const actor = await requireActor();
    if (input.sessionId === actor.session.id) {
      throw new Error("That is this device. Use Sign out instead.");
    }
    const rows = await listSessions({ userId: actor.user.id });
    if (!rows.some((session) => session.id === input.sessionId)) throw new Error("Session not found.");
    await revokeSessionById(input.sessionId);
    await recordAudit({
      action: "session_revoked",
      summary: `${actor.user.name} signed out a device`,
      actor,
      targetType: "session",
      targetId: input.sessionId,
    });
    revalidatePath("/account/password");
    return { ok: true, message: "That device is signed out." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function listOwnPasskeys() {
  await requireActor();
  const rows = await auth.api.listPasskeys({ headers: await headers() }).catch(() => []);
  return rows.map((passkey) => ({
    id: passkey.id,
    name: passkey.name ?? null,
    createdAt: passkey.createdAt.toISOString(),
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
  }));
}

export async function removeOwnPasskeyAction(input: { passkeyId: string }): Promise<AccountActionState> {
  try {
    const actor = await requireActor();
    await auth.api.deletePasskey({ body: { id: input.passkeyId }, headers: await headers() });
    await recordAudit({
      action: "passkey_removed",
      summary: `${actor.user.name} removed a passkey`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
    revalidatePath("/account/password");
    return { ok: true, message: "Passkey removed." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
