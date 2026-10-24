"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/session";
import { revokeSessionById } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";

export type AccountActionState = { ok: boolean; error?: string; message?: string };

/** Sign yourself out of a single device. Anyone may end their own session. */
export async function revokeOwnSessionAction(input: { sessionId: string }): Promise<AccountActionState> {
  try {
    const actor = await requireActor();
    if (input.sessionId === actor.session.id) {
      throw new Error("That is this device. Use Sign out instead.");
    }
    const rows = await import("@/lib/auth/rbac").then(({ listSessions }) => listSessions({ userId: actor.user.id }));
    if (!rows.some((session) => session.id === input.sessionId)) throw new Error("Session not found.");
    await revokeSessionById(input.sessionId);
    await recordAudit({
      action: "session_revoked",
      summary: `${actor.user.name} signed out a device`,
      actor,
      targetType: "session",
      targetId: input.sessionId,
    });
    revalidatePath("/account");
    return { ok: true, message: "That device is signed out." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
