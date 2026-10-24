"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { staffInvites, staffResetLinks, users } from "@/lib/db/schema";
import { assertRoleCeiling, requirePermission, requireStepUp } from "@/lib/auth/session";
import { issueInviteToken } from "@/lib/actions/auth";
import { countActiveStaffAtRank, getRole, getRoleByKey, listSessions, revokeSessionById } from "@/lib/auth/rbac";
import {
  assignRole,
  banAccount,
  createAccount,
  removeAccount,
  revokeAllSessions,
  setAdminPassword,
  setMustChangePassword,
  unbanAccount,
} from "@/lib/auth/mutations";
import { checkPasswordStrength } from "@/lib/auth/password";
import { auth } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
  resetUrl?: string;
};

const ADMIN_RANK = 100;

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function targetUser(userId: string) {
  await ensureDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("Account not found.");
  return target;
}

async function assertAdminRemains(userId: string, nextRoleKey: string, action: string) {
  const next = await getRoleByKeyOrThrow(nextRoleKey);
  if (next.rank >= ADMIN_RANK) return;
  const others = await countActiveStaffAtRank(ADMIN_RANK, userId);
  if (others === 0) throw new Error(`This would leave the platform with no active admin, so ${action} is refused.`);
}

async function getRoleByKeyOrThrow(key: string) {
  const role = await getRoleByKey(key);
  if (!role) throw new Error("That role no longer exists.");
  return role;
}

export async function inviteStaffAction(input: { email: string; roleId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.invite");
    await ensureDb();
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Pick a role.");
    assertRoleCeiling(actor, role.rank, "invite someone to");

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

export async function createStaffAccountAction(input: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await ensureDb();
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) throw new Error("Enter the person's full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Pick a role.");
    assertRoleCeiling(actor, role.rank, "create an account at");
    const strength = checkPasswordStrength(input.password);
    if (!strength.ok) throw new Error(strength.message);

    const user = await createAccount({
      name,
      email,
      password: input.password,
      roleKey: role.key,
      mustChangePassword: true,
      headers: await headers(),
    });

    await recordAudit({
      action: "account_created",
      summary: `Created the account for ${email} on the ${role.name} role`,
      actor,
      targetType: "user",
      targetId: user.id,
      detail: { role: role.key },
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${name} can sign in now and will be asked to choose a new password.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setMemberRoleAction(input: { userId: string; roleId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Pick a role.");
    const current = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, role.rank, "assign");
    assertRoleCeiling(actor, current.rank, "change the role of someone at");
    if (target.id === actor.user.id && role.rank < current.rank) {
      throw new Error("You cannot lower your own role.");
    }
    await assertAdminRemains(input.userId, role.key, "removing the last admin");

    if (role.key === target.role) {
      return { ok: true, message: `${target.name} already holds ${role.name}.` };
    }

    await assignRole(input.userId, role.key, await headers());
    await recordAudit({
      action: "roles_assigned",
      summary: `Role for ${target.name}: ${current.name} → ${role.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
      detail: { role: role.key, previousRole: current.key },
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} now holds ${role.name}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function banMemberAction(input: { userId: string; reason: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    if (target.id === actor.user.id) throw new Error("You cannot ban your own account.");
    const targetRole = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, targetRole.rank, "ban someone holding");
    if (targetRole.rank >= ADMIN_RANK) {
      const others = await countActiveStaffAtRank(ADMIN_RANK, target.id);
      if (others === 0) throw new Error("This is the last active admin, so it cannot be banned.");
    }

    await banAccount(input.userId, input.reason.trim() || "Suspended by an administrator", await headers());
    await recordAudit({
      action: "account_suspended",
      summary: `Banned ${target.name}${input.reason.trim() ? `: ${input.reason.trim()}` : ""}`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} is banned and signed out everywhere.` };
  } catch (error) {
    return failure(error);
  }
}

export async function unbanMemberAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    await unbanAccount(input.userId, await headers());
    await recordAudit({
      action: "account_reactivated",
      summary: `Lifted the ban on ${target.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} can sign in again.` };
  } catch (error) {
    return failure(error);
  }
}

export async function resetUserPasswordAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    const targetRole = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, targetRole.rank, "reset the password of someone holding");

    await auth.api.requestPasswordReset({
      body: { email: target.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
    const [link] = await db
      .select()
      .from(staffResetLinks)
      .where(eq(staffResetLinks.userId, target.id))
      .orderBy(desc(staffResetLinks.createdAt))
      .limit(1);
    if (!link) throw new Error("The reset link could not be created.");

    await recordAudit({
      action: "password_reset_requested",
      summary: `Issued a single-use reset link for ${target.email}`,
      actor,
      targetType: "user",
      targetId: target.id,
    });
    revalidatePath("/admin/team");
    return {
      ok: true,
      message: `Single-use reset link for ${target.email}. It works once and expires in an hour.`,
      resetUrl: link.url,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function setTemporaryPasswordAction(input: {
  userId: string;
  password: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    const targetRole = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, targetRole.rank, "set a password for someone holding");
    const strength = checkPasswordStrength(input.password);
    if (!strength.ok) throw new Error(strength.message);

    await setAdminPassword(input.userId, input.password, await headers());
    await setMustChangePassword(input.userId, true);
    await revokeAllSessions(input.userId, await headers());
    await recordAudit({
      action: "password_changed",
      summary: `Set a temporary password for ${target.name}; every session was ended`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} must choose a new password at the next sign-in.` };
  } catch (error) {
    return failure(error);
  }
}

export async function impersonateMemberAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    if (target.id === actor.user.id) throw new Error("You are already signed in as yourself.");
    const targetRole = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, targetRole.rank, "view the account of someone holding");
    if (target.banned) throw new Error("Lift the ban before viewing the platform as this person.");

    await auth.api.impersonateUser({ body: { userId: input.userId }, headers: await headers() });
    await recordAudit({
      action: "signed_in",
      summary: `Started an impersonation session for ${target.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
      detail: { impersonation: true },
    });
  } catch (error) {
    return failure(error);
  }
  redirect("/admin");
}

export async function stopImpersonatingAction(): Promise<void> {
  await auth.api.stopImpersonating({ headers: await headers() }).catch(() => null);
  redirect("/admin/team");
}

export async function removeMemberAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("staff.manage");
    await requireStepUp(actor);
    const target = await targetUser(input.userId);
    if (target.id === actor.user.id) throw new Error("You cannot delete your own account.");
    const targetRole = await getRoleByKeyOrThrow(target.role);
    assertRoleCeiling(actor, targetRole.rank, "delete someone holding");
    if (targetRole.rank >= ADMIN_RANK) {
      const others = await countActiveStaffAtRank(ADMIN_RANK, target.id);
      if (others === 0) throw new Error("This is the last active admin, so it cannot be deleted.");
    }
    await removeAccount(input.userId, await headers());
    await recordAudit({
      action: "account_removed",
      summary: `Deleted the account for ${target.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} no longer has an account.` };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeUserSessionAction(input: { sessionId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("session.revoke");
    await ensureDb();
    const rows = await listSessions();
    const target = rows.find((session) => session.id === input.sessionId);
    if (!target) throw new Error("Session not found.");
    if (target.user.id === actor.user.id && target.id === actor.session.id) {
      throw new Error("That is this device. Use Sign out instead.");
    }
    await revokeSessionById(input.sessionId);
    await recordAudit({
      action: "session_revoked",
      summary: `Revoked a session for ${target.user.email}`,
      actor,
      targetType: "session",
      targetId: input.sessionId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `Signed ${target.user.name} out of that device.` };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeAllUserSessionsAction(input: { userId: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("session.revoke");
    const target = await targetUser(input.userId);
    await revokeAllSessions(input.userId, await headers());
    await recordAudit({
      action: "session_revoked",
      summary: `Ended every session for ${target.name}`,
      actor,
      targetType: "user",
      targetId: input.userId,
    });
    revalidatePath("/admin/team");
    return { ok: true, message: `${target.name} is signed out on every device.` };
  } catch (error) {
    return failure(error);
  }
}

export async function listLiveSessions() {
  await requirePermission("session.view");
  const rows = await listSessions();
  return rows.map((session) => ({
    id: session.id,
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  }));
}
