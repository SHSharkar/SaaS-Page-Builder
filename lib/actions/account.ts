"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/lib/auth/session";
import { listSessions, revokeSessionById } from "@/lib/auth/rbac";
import { auth } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";

export type AccountActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  totpUri?: string;
  backupCodes?: string[];
};

export async function revokeOwnSessionAction(input: {
  sessionId: string;
}): Promise<AccountActionState> {
  try {
    const actor = await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
    if (input.sessionId === actor.session.id) {
      throw new Error("That is this device. Use Sign out instead.");
    }
    const rows = await listSessions({ userId: actor.user.id });
    if (!rows.some((session) => session.id === input.sessionId)) {
      throw new Error("Session not found.");
    }
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
  await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
  const rows = await auth.api.listPasskeys({ headers: await headers() }).catch(() => []);
  return rows.map((passkey) => ({
    id: passkey.id,
    name: passkey.name ?? null,
    createdAt: passkey.createdAt.toISOString(),
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
  }));
}

export async function removeOwnPasskeyAction(input: {
  passkeyId: string;
}): Promise<AccountActionState> {
  try {
    const actor = await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
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

export async function beginTwoFactorSetupAction(input: {
  password: string;
}): Promise<AccountActionState> {
  try {
    await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
    const res = await auth.api.enableTwoFactor({
      body: { password: input.password },
      headers: await headers(),
    });
    return {
      ok: true,
      totpUri: "totpURI" in res ? res.totpURI : undefined,
      backupCodes: "backupCodes" in res ? res.backupCodes : undefined,
      message: "Scan the setup key in your authenticator app, then enter a 6-digit code to finish.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not start two-factor setup. Check your password.",
    };
  }
}

export async function confirmTwoFactorSetupAction(input: {
  code: string;
}): Promise<AccountActionState> {
  try {
    const actor = await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
    const clean = input.code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
    }
    await auth.api.verifyTOTP({
      body: { code: clean },
      headers: await headers(),
    });
    await recordAudit({
      action: "two_factor_enabled",
      summary: `${actor.user.name} enabled two-factor authentication`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
    revalidatePath("/account/password");
    return { ok: true, message: "Two-factor authentication is now active." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That code did not verify. Try the next code.",
    };
  }
}

export async function disableTwoFactorAction(input: {
  password: string;
}): Promise<AccountActionState> {
  try {
    const actor = await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
    await auth.api.disableTwoFactor({
      body: { password: input.password },
      headers: await headers(),
    });
    await recordAudit({
      action: "two_factor_disabled",
      summary: `${actor.user.name} turned off two-factor authentication`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
    revalidatePath("/account/password");
    return { ok: true, message: "Two-factor authentication has been turned off." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not turn off two-factor authentication.",
    };
  }
}

export async function listOwnSessions() {
  const actor = await requireActor({ allowPasswordPending: true, allowTwoFactorPending: true });
  const { listSessions } = await import("@/lib/auth/rbac");
  return listSessions({ userId: actor.user.id });
}
