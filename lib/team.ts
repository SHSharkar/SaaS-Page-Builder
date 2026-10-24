import { and, asc, count, desc, eq, gt, lte } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { roles, sessions, staffInvites, userRoles, users } from "@/lib/db/schema";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  lastSignInAt: Date | null;
  createdAt: Date;
  roles: { id: string; key: string; name: string; rank: number; isSystem: boolean }[];
  sessionCount: number;
};

export async function listStaff(): Promise<StaffMember[]> {
  await ensureDb();
  const people = await db.select().from(users).orderBy(asc(users.name));
  const assignments = await db
    .select({ userId: userRoles.userId, role: roles })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(desc(roles.rank));
  const sessionCounts = await db
    .select({ userId: sessions.userId, total: count() })
    .from(sessions)
    .groupBy(sessions.userId);

  const byUser = new Map<string, StaffMember["roles"]>();
  for (const row of assignments) {
    const list = byUser.get(row.userId) ?? [];
    list.push({
      id: row.role.id,
      key: row.role.key,
      name: row.role.name,
      rank: row.role.rank,
      isSystem: row.role.isSystem,
    });
    byUser.set(row.userId, list);
  }
  const sessionsByUser = new Map(sessionCounts.map((row) => [row.userId, Number(row.total)]));

  return people.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    status: person.status,
    mustChangePassword: person.mustChangePassword,
    twoFactorEnabled: person.twoFactorEnabled,
    lastSignInAt: person.lastSignInAt,
    createdAt: person.createdAt,
    roles: byUser.get(person.id) ?? [],
    sessionCount: sessionsByUser.get(person.id) ?? 0,
  }));
}

export async function getStaffMember(userId: string): Promise<StaffMember | null> {
  const all = await listStaff();
  return all.find((member) => member.id === userId) ?? null;
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
  // Expiry is decided by the clock, not by whichever job happened to run last:
  // the list (and the accept form) flips stale pending rows on read.
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

export async function countPendingInvites(): Promise<number> {
  await ensureDb();
  const rows = await db
    .select({ id: staffInvites.id })
    .from(staffInvites)
    .where(gt(staffInvites.expiresAt, new Date()));
  return rows.length;
}
