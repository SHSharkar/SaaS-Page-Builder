"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { staffInvites, users } from "@/lib/db/schema";
import { requirePermission, requireStepUp } from "@/lib/auth/session";
import { issueInviteToken, createPasswordReset } from "@/lib/actions/auth";
import {
  countActiveStaffAtRank,
  getRole,
  listRoles,
  rolesForUser,
  setUserRoles,
} from "@/lib/auth/rbac";
import { createAccount, revokeAllSessions } from "@/lib/auth/mutations";
import { checkPasswordStrength } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { listSessions, revokeSessionById } from "@/lib/auth/rbac";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
  resetUrl?: string;
  temporaryPassword?: string;
};

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

const ADMIN_RANK = 100;

async function assertAdminRemains(userId: string, roleIds: string[], action: string) {
  const remaining = await listRoles();
  const keepsAdmin = roleIds.some((roleId) => (remaining.find((role) => role.id === roleId)?.rank ?? 0) >= ADMIN_RANK);
  if (keepsAdmin) return;
  const others = await countActiveStaffAtRank(ADMIN_RANK, userId);
  if (others === 0) {
    throw new Error(`This would leave the platform with no active admin, so ${action} is refused.`);
  }
}

/* ------------------------------------------------------------------ *
 * Invitations
 * ------------------------------------------------------------------ */

export async function inviteStaffAction(input: { email: string; roleId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.invite");
    await ensureDb();
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Pick a role.");

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) throw new Error("That person already has an account.");

    const { invite, token } = await issueInviteToken(email, role.id, actor.user.id);
    await recordAudit({
      action: "invite_created",
      summary: `Invited ${email} to the ${role.name} role`,
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
    const actor = await requirePermission("staff.invite");
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
      targetId: inviteId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return failure(error);
  }
}

export async function resendInviteAction(inviteId: string): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.invite");
    await ensureDb();
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.id, inviteId)).limit(1);
    if (!invite) throw new Error("Invitation not found.");
    const { token } = await issueInviteToken(invite.email, invite.roleId, actor.user.id);
    revalidatePath("/admin/team");
    return { ok: true, message: "A fresh link replaces the old one.", inviteUrl: `/invite/${token}` };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */

export async function createStaffAccountAction(input: {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await ensureDb();
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) throw new Error("Enter the person's full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!input.roleIds.length) throw new Error("Give the account at least one role.");
    const strength = checkPasswordStrength(input.password);
    if (!strength.ok) throw new Error(strength.message);

    const user = await createAccount({
      name,
      email,
      password: input.password,
      roleIds: input.roleIds,
      // The admin knows this password, so the owner must replace it.
      mustChangePassword: true,
      createdBy: actor.user.id,
    });

    await recordAudit({
      action: "account_created",
      summary: `Created the account for ${email}`,
      actor,
      targetType: "user",
      targetId: user.id,
      detail: { roleIds: input.roleIds },
    });
    revalidatePath("/admin/team");
    return {
      ok: true,
      message: `${name} can sign in now and will be asked to choose a new password.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function setMemberRolesAction(input: { userId: string; roleIds: string[] }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    await ensureDb();
    if (!input.roleIds.length) throw new Error("An account needs at least one role.");
    const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new Error("Account not found.");
    await assertAdminRemains(input.userId, input.roleIds, "removing the last admin");

    const before = (await rolesForUser(input.userId)).map((role) => role.name).join(", ") || "no role";
    await setUserRoles(input.userId, input.roleIds, actor.user.id);
    const after = (await rolesForUser(input.userId)).map((role) => role.name).join(", ") || "no role";

    await recordAudit({
      action: "roles_assigned",
      summary: `Roles for ${target.name}: ${before} → ${after}`,
      actor,
      targetType: "user",
      targetId: input.userId,
      detail: { roleIds: input.roleIds },
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} now holds: ${after}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setUserStatusAction(input: { userId: string; disabled: boolean }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    await ensureDb();
    const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new Error("Account not found.");
    if (target.id === actor.user.id) throw new Error("You cannot suspend your own account.");
    if (input.disabled) {
      const others = await countActiveStaffAtRank(ADMIN_RANK, target.id);
      const targetRoles = await rolesForUser(target.id);
      const isAdmin = targetRoles.some((role) => role.rank >= ADMIN_RANK);
      if (isAdmin && others === 0) throw new Error("This is the last active admin, so it cannot be suspended.");
    }

    await db
      .update(users)
      .set({ status: input.disabled ? "disabled" : "active", updatedAt: new Date() })
      .where(eq(users.id, input.userId));
    // Suspension takes effect now, not when the cookie happens to expire.
    if (input.disabled) await revokeAllSessions(input.userId);

    await recordAudit({
      action: input.disabled ? "account_suspended" : "account_reactivated",
      summary: `${input.disabled ? "Suspended" : "Reactivated"} ${target.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} is ${input.disabled ? "suspended" : "active"}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function resetUserPasswordAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    await ensureDb();
    const { user, url } = await createPasswordReset(input.userId, { id: actor.user.id });
    revalidatePath("/admin/team");
    return {
      ok: true,
      message: `Single-use reset link for ${user.email}. It works once and expires in an hour.`,
      resetUrl: url,
    };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

export async function revokeUserSessionAction(input: { sessionId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("session.revoke");
    await ensureDb();
    const rows = await listSessions();
    const target = rows.find((session) => session.id === input.sessionId);
    if (!target) throw new Error("Session not found.");
    await revokeSessionById(input.sessionId);
    await recordAudit({
      action: "session_revoked",
      summary: `Revoked a session for ${target.user.email}`,
      actor,
      targetType: "session",
      targetId: input.sessionId,
    });
    revalidatePath("/admin/team");
    revalidatePath("/account");
    return { ok: true, message: `Signed ${target.user.name} out of that device.` };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeAllUserSessionsAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("session.revoke");
    await ensureDb();
    const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new Error("Account not found.");
    const removed = await revokeAllSessions(input.userId, actor.user.id === input.userId ? actor.session.id : undefined);
    await recordAudit({
      action: "session_revoked",
      summary: `Signed ${target.name} out of ${removed} device(s)`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${removed} session(s) ended.` };
  } catch (error) {
    return failure(error);
  }
}

/** Served to the team screen: every live session, for the session panel. */
export async function listLiveSessions() {
  const actor = await requirePermission("session.view");
  void actor;
  const rows = await listSessions();
  return rows.map((session) => ({
    id: session.id,
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  }));
}
