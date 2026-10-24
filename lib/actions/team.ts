"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { staffInvites, users } from "@/lib/db/schema";
import { requireRole, requireStepUp, countActiveAdmins } from "@/lib/auth/session";
import { issueInviteToken } from "@/lib/actions/auth";
import { recordAudit } from "@/lib/audit";

export type ActionState = { ok: boolean; error?: string; message?: string; inviteUrl?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

const ROLES = ["admin", "editor", "viewer"] as const;
type StaffRole = (typeof ROLES)[number];

export async function inviteStaffAction(input: { email: string; role: StaffRole }): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await ensureDb();
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!ROLES.includes(input.role)) throw new Error("Pick a role.");

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) throw new Error("That person already has an account.");

    const { invite, token } = await issueInviteToken(email, input.role, actor.user.id);
    await recordAudit({
      action: "invite_created",
      summary: `Invited ${email} as ${input.role}`,
      actor,
      targetType: "staff_invite",
      targetId: invite.id,
    });
    revalidatePath("/admin/team");
    return {
      ok: true,
      message: `Invitation ready for ${email}. It expires in seven days.`,
      inviteUrl: `/invite/${token}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeInviteAction(inviteId: string): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await ensureDb();
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.id, inviteId)).limit(1);
    if (!invite) throw new Error("Invitation not found.");
    await db
      .update(staffInvites)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(staffInvites.id, inviteId), eq(staffInvites.status, "pending")));
    await recordAudit({
      action: "invite_revoked",
      summary: `Revoked the invitation for ${invite.email}`,
      actor,
      targetType: "staff_invite",
      targetId: invite.id,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: "Invitation revoked" };
  } catch (error) {
    return failure(error);
  }
}

export async function resendInviteAction(inviteId: string): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await ensureDb();
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.id, inviteId)).limit(1);
    if (!invite) throw new Error("Invitation not found.");
    const { token } = await issueInviteToken(invite.email, invite.role, actor.user.id);
    revalidatePath("/admin/team");
    return { ok: true, message: "Fresh invitation link created", inviteUrl: `/invite/${token}` };
  } catch (error) {
    return failure(error);
  }
}

export async function changeRoleAction(input: { userId: string; role: StaffRole }): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await requireStepUp(actor);
    await ensureDb();
    const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) throw new Error("Person not found.");
    if (user.role === input.role) return { ok: true, message: "No change." };

    if (user.role === "admin" && input.role !== "admin") {
      const others = await countActiveAdmins(user.id);
      if (others === 0) throw new Error("The last active admin cannot be demoted.");
    }

    await db.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, user.id));
    await recordAudit({
      action: "user_role_changed",
      summary: `Changed ${user.name}'s role from ${user.role} to ${input.role}`,
      actor,
      targetType: "user",
      targetId: user.id,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${user.name} is now ${input.role}` };
  } catch (error) {
    return failure(error);
  }
}

export async function setUserStatusAction(input: {
  userId: string;
  disabled: boolean;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await requireStepUp(actor);
    await ensureDb();
    const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) throw new Error("Person not found.");
    if (input.disabled && user.role === "admin") {
      const others = await countActiveAdmins(user.id);
      if (others === 0) throw new Error("The last active admin cannot be disabled.");
    }
    await db
      .update(users)
      .set({ status: input.disabled ? "disabled" : "active", updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await recordAudit({
      action: input.disabled ? "user_disabled" : "user_enabled",
      summary: `${input.disabled ? "Disabled" : "Re-enabled"} ${user.name}`,
      actor,
      targetType: "user",
      targetId: user.id,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: input.disabled ? "Access disabled" : "Access restored" };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTwoFactorAction(input: {
  enabled: boolean;
  secret?: string;
  code?: string;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("viewer");
    await ensureDb();
    if (!input.enabled) {
      await db
        .update(users)
        .set({ twoFactorEnabled: false, twoFactorSecret: null, updatedAt: new Date() })
        .where(eq(users.id, actor.user.id));
      return { ok: true, message: "Two-factor turned off." };
    }
    if (!input.secret) throw new Error("A secret is required to enrol.");
    const OTPAuth = await import("otpauth");
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(input.secret), digits: 6, period: 30 });
    if (!input.code || totp.validate({ token: input.code.replace(/\s+/g, ""), window: 1 }) === null) {
      throw new Error("That code did not match. Check the clock on your authenticator app.");
    }
    await db
      .update(users)
      .set({ twoFactorEnabled: true, twoFactorSecret: input.secret, updatedAt: new Date() })
      .where(eq(users.id, actor.user.id));
    return { ok: true, message: "Two-factor enabled for your account." };
  } catch (error) {
    return failure(error);
  }
}
