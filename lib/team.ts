import { and, asc, count, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { roles, sessions, staffInvites, users } from "@/lib/db/schema";

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
      sessionCount: sql<number>`(select count(*)::int from ${sessions} where ${sessions.userId} = ${users.id} and ${sessions.expiresAt} > now())`,
      passkeyCount: sql<number>`(select count(*)::int from passkey where passkey.user_id = ${users.id})`,
    })
    .from(users)
    .leftJoin(roles, eq(roles.key, users.role))
    .orderBy(asc(users.name));

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
    sessionCount: Number(person.sessionCount ?? 0),
    passkeyCount: Number(person.passkeyCount ?? 0),
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
