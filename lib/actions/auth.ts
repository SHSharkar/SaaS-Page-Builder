"use server";

import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureDb } from "@/lib/db";
import { roles, staffInvites, users } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { checkPasswordStrength, hashToken, newToken } from "@/lib/auth/password";
import { auth } from "@/lib/auth/server";
import { provisionAccount, touchLastSignIn } from "@/lib/auth/mutations";
import { getActor, markStepUp, roleLabels } from "@/lib/auth/session";

export type FormState = {
  error?: string;
  ok?: boolean;
  message?: string;
  url?: string;
  resetUrl?: string;
};

function safeNext(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "");
  return raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(0, 300) : null;
}

async function requestHeaders() {
  return headers();
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const limit = await consumeRateLimit("sign-in", email || "blank", 8, 300);
  if (!limit.allowed) {
    return { error: "Too many sign-in attempts. Wait five minutes before trying again." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || (user.banned && (!user.banExpires || user.banExpires > new Date()))) {
    await recordAudit({
      action: "sign_in_failed",
      summary: `Failed sign-in for ${email || "(blank email)"}`,
      actor: null,
      targetType: "user",
      targetId: user?.id,
    });
    return { error: "That email and password combination did not work." };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await requestHeaders(),
    });
    if ((result as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
      redirect(`/sign-in/two-factor${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    await recordAudit({
      action: "sign_in_failed",
      summary: `Failed sign-in for ${email}`,
      actor: null,
      targetType: "user",
      targetId: user.id,
    });
    return { error: "That email and password combination did not work." };
  }

  await touchLastSignIn(user.id);
  await recordAudit({
    action: "signed_in",
    summary: `${user.name} signed in`,
    actor: { id: user.id, role: user.role },
    targetType: "user",
    targetId: user.id,
  });

  if (user.mustChangePassword) {
    redirect(`/account/password?next=${encodeURIComponent(next ?? "/admin")}`);
  }
  redirect(next ?? "/admin");
}

export async function verifyTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await ensureDb();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNext(formData.get("next"));
  if (!code) return { error: "Enter your 6-digit code or backup code." };

  try {
    if (/^\d{6}$/.test(code)) {
      await auth.api.verifyTOTP({ body: { code }, headers: await requestHeaders() });
    } else {
      await auth.api.verifyBackupCode({ body: { code }, headers: await requestHeaders() });
    }
  } catch {
    return { error: "That code is not valid. Authenticator codes rotate every 30 seconds." };
  }

  const actor = await getActor();
  if (actor) {
    await touchLastSignIn(actor.user.id);
    await recordAudit({
      action: "signed_in",
      summary: `${actor.user.name} completed two-factor sign-in`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
  }
  redirect(next ?? "/admin");
}

export async function signOutAction(): Promise<void> {
  const actor = await getActor();
  if (actor) {
    await recordAudit({
      action: "signed_out",
      summary: `${actor.user.name} signed out`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
  }
  await auth.api.signOut({ headers: await requestHeaders() }).catch(() => null);
  redirect("/sign-in");
}

export async function acceptInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await ensureDb();
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (name.length < 2) return { error: "Enter your full name." };
  if (password !== confirm) return { error: "The two passwords do not match." };
  const strength = checkPasswordStrength(password);
  if (!strength.ok) return { error: strength.message };

  const [invite] = await db
    .select({
      id: staffInvites.id,
      email: staffInvites.email,
      roleId: staffInvites.roleId,
      roleKey: roles.key,
      expiresAt: staffInvites.expiresAt,
      status: staffInvites.status,
    })
    .from(staffInvites)
    .innerJoin(roles, eq(roles.id, staffInvites.roleId))
    .where(and(eq(staffInvites.tokenHash, hashToken(token)), eq(staffInvites.status, "pending")))
    .limit(1);

  if (!invite) {
    return { error: "That invitation link is not valid. Ask an administrator to resend it." };
  }
  if (invite.expiresAt < new Date()) {
    await db
      .update(staffInvites)
      .set({ status: "expired" })
      .where(eq(staffInvites.id, invite.id));
    return { error: "That invitation has expired. Ask an administrator to send a fresh one." };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);
  if (existing) {
    return { error: "An account already exists for that email. Sign in instead." };
  }

  const user = await provisionAccount({
    name,
    email: invite.email,
    password,
    roleKey: invite.roleKey,
    mustChangePassword: false,
  });

  await db
    .update(staffInvites)
    .set({
      status: "accepted",
      acceptedUserId: user.id,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(staffInvites.id, invite.id));

  await recordAudit({
    action: "invite_accepted",
    summary: `${user.name} accepted an invitation as ${invite.roleKey}`,
    actor: { id: user.id, role: invite.roleKey },
    targetType: "staff_invite",
    targetId: invite.id,
  });

  await auth.api.signInEmail({
    body: { email: invite.email, password },
    headers: await requestHeaders(),
  });
  redirect("/admin");
}

export async function stepUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const password = String(formData.get("password") ?? "");
  try {
    await auth.api.verifyPassword({ body: { password }, headers: await requestHeaders() });
  } catch {
    return { error: "That password did not match." };
  }
  await markStepUp(actor);
  await recordAudit({
    action: "step_up_granted",
    summary: `${actor.user.name} confirmed their identity`,
    actor,
    targetType: "session",
    targetId: actor.session.id,
  });
  return { ok: true, message: "Confirmed. You have ten minutes for sensitive changes." };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const currentPassword = String(formData.get("current") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (newPassword !== confirm) return { error: "The two passwords do not match." };
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { error: strength.message };

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await requestHeaders(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/invalid password/i.test(message)) {
      return { error: "Your current password did not match." };
    }
    return { error: "The password could not be changed." };
  }

  await db
    .update(users)
    .set({ mustChangePassword: false, passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, actor.user.id));
  await recordAudit({
    action: "password_changed",
    summary: `${actor.user.name} changed their password`,
    actor,
    targetType: "user",
    targetId: actor.user.id,
  });
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

export async function requestPasswordResetAction(input: { email: string }): Promise<FormState> {
  await ensureDb();
  const email = input.email.trim().toLowerCase();
  const limit = await consumeRateLimit("reset", email || "blank", 5, 600);
  if (!limit.allowed) {
    return { error: "Too many reset requests. Try again later." };
  }
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      headers: await requestHeaders(),
    });
  } catch {
    return { error: "The reset could not be started." };
  }
  await recordAudit({
    action: "password_reset_requested",
    summary: `A password reset link was requested for ${email}`,
    actor: null,
    targetType: "user",
  });
  return {
    ok: true,
    message: "If an account exists for that email, a single-use reset link has been created.",
  };
}

export async function completePasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await ensureDb();
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (newPassword !== confirm) return { error: "The two passwords do not match." };
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { error: strength.message };
  if (!token) return { error: "That reset link is incomplete. Ask an administrator for another." };

  try {
    await auth.api.resetPassword({ body: { token, newPassword } });
  } catch {
    return { error: "That reset link is invalid or has expired. Ask an administrator for another." };
  }

  await recordAudit({
    action: "password_changed",
    summary: "A password was reset with a single-use link",
    actor: null,
    targetType: "user",
  });
  return { ok: true, message: "Password updated. Sign in with the new one." };
}

export async function currentInvite(token: string) {
  await ensureDb();
  const [invite] = await db
    .select({
      id: staffInvites.id,
      email: staffInvites.email,
      roleId: staffInvites.roleId,
      roleName: roles.name,
      expiresAt: staffInvites.expiresAt,
    })
    .from(staffInvites)
    .innerJoin(roles, eq(roles.id, staffInvites.roleId))
    .where(
      and(
        eq(staffInvites.tokenHash, hashToken(token)),
        eq(staffInvites.status, "pending"),
        gt(staffInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ?? null;
}

export async function issueInviteToken(email: string, roleId: string, invitedBy: string) {
  await ensureDb();
  const token = newToken(24);
  await db
    .update(staffInvites)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(staffInvites.email, email), eq(staffInvites.status, "pending")));
  const [invite] = await db
    .insert(staffInvites)
    .values({
      email,
      roleId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy,
    })
    .returning();
  return { invite, token };
}

export async function describeActor() {
  const actor = await getActor();
  return actor ? `${actor.user.name} (${roleLabels(actor)})` : "signed out";
}

export const inspectInviteToken = currentInvite;
