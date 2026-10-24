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
import { createAccount, credentialAccount, revokeAllSessions, setPassword } from "@/lib/auth/mutations";
import { getActor, markStepUp } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { AuthError } from "@/lib/auth/session";
import { rolesForUser, setUserRoles } from "@/lib/auth/rbac";
import { verificationToken } from "@/lib/auth/tokens";

export type FormState = {
  error?: string;
  ok?: boolean;
  message?: string;
  url?: string;
  /** Set when the password was right but a TOTP code is still owed. */
  twoFactor?: boolean;
};

/** Only same-origin paths are honoured as post-sign-in destinations. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "");
  return raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(0, 300) : null;
}

function normaliseEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

async function requestHeaders() {
  return headers();
}

/**
 * Sign-in goes through Better Auth, so the session, the cookie and the
 * two-factor challenge are the library's, not ours. A disabled account is
 * refused before the password is even checked.
 */
export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!consumeRateLimit(`sign-in:${email}`, 8, 300)) {
    return { error: "Too many attempts. Wait five minutes before trying again." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || user.status !== "active") {
    await recordAudit({
      action: "sign_in_failed",
      summary: `Failed sign-in for ${email || "(blank email)"}`,
      actor: null,
      targetType: "user",
      targetId: user?.id,
    });
    return { error: "That email and password combination did not work." };
  }

  let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
  try {
    result = await auth.api.signInEmail({ body: { email, password }, headers: await requestHeaders() });
  } catch {
    await recordAudit({
      action: "sign_in_failed",
      summary: `Failed sign-in for ${email}`,
      actor: null,
      targetType: "user",
      targetId: user.id,
    });
    return { error: "That email and password combination did not work." };
  }

  if ((result as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
    return { twoFactor: true, message: "Enter the six-digit code from your authenticator app." };
  }

  await db.update(users).set({ lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  await recordAudit({
    action: "signed_in",
    summary: `${user.name} signed in`,
    actor: { id: user.id, role: roleLabelsForAudit(await rolesForUser(user.id)) },
    targetType: "user",
    targetId: user.id,
  });

  if (user.mustChangePassword) redirect(`/account/password?next=${encodeURIComponent(next ?? "/admin")}`);
  redirect(next ?? "/admin");
}

function roleLabelsForAudit(roles: { name: string }[]): string {
  return roles.map((role) => role.name).join(", ") || "No role";
}

export async function verifyTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNext(formData.get("next"));
  if (!/^\d{6}$/.test(code)) return { error: "Enter the six-digit code." };

  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await requestHeaders() });
  } catch {
    return { error: "That code is not valid. Codes rotate every 30 seconds." };
  }

  const actor = await getActor();
  if (actor) {
    await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, actor.user.id));
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

/** Invitation acceptance: the account and its first role come from the invite row. */
export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
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
    .select()
    .from(staffInvites)
    .where(and(eq(staffInvites.tokenHash, hashToken(token)), eq(staffInvites.status, "pending")))
    .limit(1);
  if (!invite) return { error: "That invitation link is not valid. Ask an admin to resend it." };
  if (invite.expiresAt < new Date()) {
    await db.update(staffInvites).set({ status: "expired" }).where(eq(staffInvites.id, invite.id));
    return { error: "That invitation has expired. Ask an admin to send a fresh one." };
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email)).limit(1);
  if (existing) return { error: "An account already exists for that email. Sign in instead." };

  const user = await createAccount({
    name,
    email: invite.email,
    password,
    roleIds: [invite.roleId],
    mustChangePassword: false,
  });

  await db
    .update(staffInvites)
    .set({ status: "accepted", acceptedBy: user.id, acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(staffInvites.id, invite.id));

  await recordAudit({
    action: "invite_accepted",
    summary: `${user.name} accepted an invitation`,
    actor: { id: user.id, role: "invited" },
    targetType: "staff_invite",
    targetId: invite.id,
  });

  // Better Auth signs the new account in and sets its session cookie.
  await auth.api.signInEmail({ body: { email: invite.email, password }, headers: await requestHeaders() });
  redirect("/admin");
}

/** Step-up confirmation for sensitive actions (role changes, domains, deletes). */
export async function stepUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const password = String(formData.get("password") ?? "");
  const account = await credentialAccount(actor.user.id);
  if (!account?.password || !verifyPassword(password, account.password)) {
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

export async function requireStepUpOrThrow(actor: Awaited<ReturnType<typeof getActor>>): Promise<void> {
  if (!actor?.stepUpValid) throw new AuthError("Confirm your identity again before this change.", 428);
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

/** Issues a single-use invitation for a role row (system or custom). */
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

/* ------------------------------------------------------------------ *
 * Self-service password and two-factor
 * ------------------------------------------------------------------ */

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const current = String(formData.get("current") ?? "");
  const nextPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (nextPassword !== confirm) return { error: "The two passwords do not match." };
  const strength = checkPasswordStrength(nextPassword);
  if (!strength.ok) return { error: strength.message };

  const account = await credentialAccount(actor.user.id);
  if (!account?.password || !verifyPassword(current, account.password)) {
    return { error: "Your current password did not match." };
  }

  await setPassword(actor.user.id, nextPassword, { mustChange: false });
  // Every other device is signed out; this session stays.
  await revokeAllSessions(actor.user.id, actor.session.id);
  await recordAudit({
    action: "password_changed",
    summary: `${actor.user.name} changed their password`,
    actor,
    targetType: "user",
    targetId: actor.user.id,
  });
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

/** Starts TOTP enrolment; returns the otpauth URI to render as a QR code. */
export async function startTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const password = String(formData.get("password") ?? "");
  const account = await credentialAccount(actor.user.id);
  if (!account?.password || !verifyPassword(password, account.password)) {
    return { error: "Your password did not match." };
  }
  try {
    const result = await auth.api.enableTwoFactor({
      body: { password, method: "totp" },
      headers: await requestHeaders(),
    });
    const totpURI = "totpURI" in result ? result.totpURI : null;
    return {
      ok: true,
      message: "Scan the code, then confirm with a six-digit code.",
      url: totpURI ?? undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Two-factor could not be started." };
  }
}

export async function confirmTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await requestHeaders() });
  } catch {
    return { error: "That code is not valid. Try the current one." };
  }
  await recordAudit({
    action: "two_factor_enabled",
    summary: `${actor.user.name} turned on two-factor authentication`,
    actor,
    targetType: "user",
    targetId: actor.user.id,
  });
  return { ok: true, message: "Two-factor is on. Keep your backup codes somewhere safe." };
}

export async function disableTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const password = String(formData.get("password") ?? "");
  const account = await credentialAccount(actor.user.id);
  if (!account?.password || !verifyPassword(password, account.password)) {
    return { error: "Your password did not match." };
  }
  try {
    await auth.api.disableTwoFactor({ body: { password }, headers: await requestHeaders() });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Two-factor could not be turned off." };
  }
  await recordAudit({
    action: "two_factor_disabled",
    summary: `${actor.user.name} turned off two-factor authentication`,
    actor,
    targetType: "user",
    targetId: actor.user.id,
  });
  return { ok: true, message: "Two-factor is off." };
}

/* ------------------------------------------------------------------ *
 * Password reset
 * ------------------------------------------------------------------ */

/** Admin-side: mint a single-use reset link for an account. */
export async function createPasswordReset(userId: string, requestedBy: { id: string } | null) {
  await ensureDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Account not found.");
  const { token, record } = await verificationToken(`reset:${user.id}`, 60);
  void record;
  await recordAudit({
    action: "password_reset_requested",
    summary: `Password reset link created for ${user.email}`,
    actor: requestedBy ? { id: requestedBy.id, role: "admin" } : null,
    targetType: "user",
    targetId: user.id,
  });
  return { user, url: `/reset/${token}` };
}

export async function completePasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two passwords do not match." };
  const strength = checkPasswordStrength(password);
  if (!strength.ok) return { error: strength.message };

  const userId = await consumeResetToken(token);
  if (!userId) return { error: "That reset link is invalid or has expired. Ask an admin for another." };

  await setPassword(userId, password, { mustChange: false });
  await revokeAllSessions(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  await recordAudit({
    action: "password_changed",
    summary: `${user?.name ?? "A user"} completed a password reset`,
    actor: user ? { id: user.id, role: "self" } : null,
    targetType: "user",
    targetId: userId,
  });
  return { ok: true, message: "Password updated. Sign in with the new one." };
}

async function consumeResetToken(token: string): Promise<string | null> {
  const { consumeVerificationToken } = await import("@/lib/auth/tokens");
  return consumeVerificationToken(`reset:`, token);
}

/** Exposed for the accounts screen: assigns roles with the last-admin guard. */
export async function assignRolesWithGuard(userId: string, roleIds: string[], actorId: string | null) {
  await setUserRoles(userId, roleIds, actorId);
}
