"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as OTPAuth from "otpauth";
import { db, ensureDb } from "@/lib/db";
import { sessions, staffInvites, users } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { checkPasswordStrength, hashPassword, hashToken, newToken, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  getActor,
  getPendingTwoFactor,
  markStepUp,
  revokeSession,
  AuthError,
} from "@/lib/auth/session";

export type FormState = { error?: string; ok?: boolean; message?: string };

/** Only same-origin paths are honoured as post-sign-in destinations. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "");
  return raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(0, 300) : null;
}

function normaliseEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!consumeRateLimit(`sign-in:${email}`, 8, 300)) {
    return { error: "Too many attempts. Wait five minutes before trying again." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user && user.status === "active" && verifyPassword(password, user.passwordHash);

  if (!user || !valid) {
    await recordAudit({
      action: "sign_in_failed",
      summary: `Failed sign-in for ${email || "(blank email)"}`,
      actor: null,
      targetType: "user",
      targetId: user?.id,
    });
    // One message for every failure, so the form never reveals which factor broke.
    return { error: "That email and password combination did not work." };
  }

  await createSession(user.id, { pendingTwoFactor: user.twoFactorEnabled });
  if (user.twoFactorEnabled) {
    redirect(next ? `/sign-in/two-factor?next=${encodeURIComponent(next)}` : "/sign-in/two-factor");
  }

  await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
  await recordAudit({
    action: "signed_in",
    summary: `${user.name} signed in`,
    actor: { id: user.id, role: user.role },
    targetType: "user",
    targetId: user.id,
  });
  redirect(next ?? "/admin");
}

export async function verifyTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureDb();
  const pending = await getPendingTwoFactor();
  if (!pending) return { error: "Your sign-in window expired. Start again." };

  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNext(formData.get("next"));
  if (!pending.user.twoFactorSecret) return { error: "Two-factor is not configured for this account." };

  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(pending.user.twoFactorSecret),
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return { error: "That code is not valid. Codes rotate every 30 seconds." };
  }

  await db.delete(sessions).where(eq(sessions.id, pending.session.id));
  await createSession(pending.user.id);
  await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, pending.user.id));
  await recordAudit({
    action: "signed_in",
    summary: `${pending.user.name} completed two-factor sign-in`,
    actor: { id: pending.user.id, role: pending.user.role },
    targetType: "user",
    targetId: pending.user.id,
  });
  redirect(next ?? "/admin");
}

export async function signOutAction(): Promise<void> {
  const actor = await getActor();
  if (actor) {
    await revokeSession(actor.sessionId);
    await recordAudit({
      action: "signed_out",
      summary: `${actor.user.name} signed out`,
      actor,
      targetType: "user",
      targetId: actor.user.id,
    });
  }
  await clearSessionCookie();
  redirect("/sign-in");
}

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

  const [existing] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1);
  if (existing) return { error: "An account already exists for that email. Sign in instead." };

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: invite.email,
      role: invite.role,
      emailVerified: true,
      passwordHash: hashPassword(password),
    })
    .returning();

  await db
    .update(staffInvites)
    .set({ status: "accepted", acceptedBy: user.id, acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(staffInvites.id, invite.id));

  await createSession(user.id);
  await recordAudit({
    action: "invite_accepted",
    summary: `${user.name} accepted an invitation as ${user.role}`,
    actor: { id: user.id, role: user.role },
    targetType: "staff_invite",
    targetId: invite.id,
  });
  redirect("/admin");
}

/** Step-up confirmation for sensitive actions (role changes, domains, deletes). */
export async function stepUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { error: "Sign in first." };
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password, actor.user.passwordHash)) {
    return { error: "That password did not match." };
  }
  await markStepUp(actor.sessionId);
  await recordAudit({
    action: "step_up_granted",
    summary: `${actor.user.name} confirmed their identity`,
    actor,
    targetType: "session",
    targetId: actor.sessionId,
  });
  return { ok: true, message: "Confirmed. You have ten minutes for sensitive changes." };
}

export async function requireStepUpOrThrow(actor: Awaited<ReturnType<typeof getActor>>): Promise<void> {
  if (!actor?.stepUpValid) throw new AuthError("Confirm your identity again before this change.", 428);
}

export async function currentInvite(token: string) {
  await ensureDb();
  const [invite] = await db
    .select()
    .from(staffInvites)
    .where(and(eq(staffInvites.tokenHash, hashToken(token)), eq(staffInvites.status, "pending"), gt(staffInvites.expiresAt, new Date())))
    .limit(1);
  return invite ?? null;
}

export async function issueInviteToken(email: string, role: "admin" | "editor" | "viewer", invitedBy: string) {
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
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy,
    })
    .returning();
  return { invite, token };
}
