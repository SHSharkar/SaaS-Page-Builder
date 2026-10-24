import "server-only";
import { and, asc, count, desc, eq, gt, lte } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { passkeys, rolePermissions, roles, sessions, staffInvites, users } from "@/lib/db/schema";

export type StaffRoleRef = { id: string; key: string; name: string; rank: number; isSystem: boolean };

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  role: StaffRoleRef | null;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  lastSignInAt: Date | null;
  createdAt: Date;
  sessionCount: number;
  passkeyCount: number;
};

export async function listStaff(): Promise<StaffMember[]> {
  await ensureDb();
  const people = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleKey: users.role,
      banned: users.banned,
      banReason: users.banReason,
      banExpires: users.banExpires,
      mustChangePassword: users.mustChangePassword,
      twoFactorEnabled: users.twoFactorEnabled,
      lastSignInAt: users.lastSignInAt,
      createdAt: users.createdAt,
      roleId: roles.id,
      roleName: roles.name,
      roleRank: roles.rank,
      roleSystem: roles.isSystem,
    })
    .from(users)
    .leftJoin(roles, eq(roles.key, users.role))
    .orderBy(asc(users.name));

  const now = new Date();
  const [sessionRows, passkeyRows] = await Promise.all([
    db
      .select({ userId: sessions.userId, total: count() })
      .from(sessions)
      .where(gt(sessions.expiresAt, now))
      .groupBy(sessions.userId),
    db
      .select({ userId: passkeys.userId, total: count() })
      .from(passkeys)
      .groupBy(passkeys.userId),
  ]);
  const sessionMap = new Map(sessionRows.map((r) => [r.userId, Number(r.total)]));
  const passkeyMap = new Map(passkeyRows.map((r) => [r.userId, Number(r.total)]));

  return people.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    roleKey: person.roleKey,
    role: person.roleId
      ? {
          id: person.roleId,
          key: person.roleKey,
          name: person.roleName ?? person.roleKey,
          rank: person.roleRank ?? 0,
          isSystem: person.roleSystem ?? false,
        }
      : null,
    banned: person.banned,
    banReason: person.banReason,
    banExpires: person.banExpires,
    mustChangePassword: person.mustChangePassword,
    twoFactorEnabled: person.twoFactorEnabled,
    lastSignInAt: person.lastSignInAt,
    createdAt: person.createdAt,
    sessionCount: sessionMap.get(person.id) ?? 0,
    passkeyCount: passkeyMap.get(person.id) ?? 0,
  }));
}

export type PendingInvite = {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
  expired: boolean;
};

export async function listInvites(): Promise<PendingInvite[]> {
  await ensureDb();
  await db
    .update(staffInvites)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(staffInvites.status, "pending"), lte(staffInvites.expiresAt, new Date())));
  const rows = await db
    .select({
      id: staffInvites.id,
      email: staffInvites.email,
      roleId: staffInvites.roleId,
      roleName: roles.name,
      status: staffInvites.status,
      expiresAt: staffInvites.expiresAt,
      createdAt: staffInvites.createdAt,
      invitedByName: users.name,
    })
    .from(staffInvites)
    .innerJoin(roles, eq(roles.id, staffInvites.roleId))
    .leftJoin(users, eq(users.id, staffInvites.invitedBy))
    .orderBy(desc(staffInvites.createdAt));

  return rows.map((row) => ({
    ...row,
    invitedByName: row.invitedByName ?? null,
    expired: row.status === "pending" && row.expiresAt.getTime() < Date.now(),
  }));
}

export async function loadTeamSnapshot() {
  await ensureDb();
  const [allRoles, grantRows, staffRows, inviteRows] = await Promise.all([
    db.select().from(roles).orderBy(desc(roles.rank), asc(roles.name)),
    db.select().from(rolePermissions),
    listStaff(),
    listInvites(),
  ]);

  const permsByRole = new Map<string, string[]>();
  for (const g of grantRows) {
    const arr = permsByRole.get(g.roleId) ?? [];
    arr.push(g.permissionKey);
    permsByRole.set(g.roleId, arr);
  }

  return {
    roles: allRoles.map((r) => ({
      ...r,
      permissionKeys: permsByRole.get(r.id) ?? [],
    })),
    members: staffRows.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      status: (m.banned ? "suspended" : "active") as "active" | "suspended",
      bannedReason: m.banReason,
      roleId: m.role?.id ?? null,
      roleKey: m.roleKey,
      roleName: m.role?.name ?? m.roleKey,
      rank: m.role?.rank ?? 0,
      twoFactorEnabled: m.twoFactorEnabled,
      mustChangePassword: m.mustChangePassword,
      passkeyCount: m.passkeyCount,
      activeSessionCount: m.sessionCount,
      lastSignInAt: m.lastSignInAt,
    })),
    invites: inviteRows,
  };
}

