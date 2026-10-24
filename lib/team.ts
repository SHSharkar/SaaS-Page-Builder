import { asc, desc, eq, gt } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { staffInvites, users } from "@/lib/db/schema";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastSignInAt: Date | null;
  createdAt: Date;
};

export async function listStaff(): Promise<StaffMember[]> {
  await ensureDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      twoFactorEnabled: users.twoFactorEnabled,
      lastSignInAt: users.lastSignInAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));
}

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
  expired: boolean;
};

export async function listInvites(): Promise<PendingInvite[]> {
  await ensureDb();
  const rows = await db
    .select({
      id: staffInvites.id,
      email: staffInvites.email,
      role: staffInvites.role,
      status: staffInvites.status,
      expiresAt: staffInvites.expiresAt,
      createdAt: staffInvites.createdAt,
      invitedByName: users.name,
    })
    .from(staffInvites)
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
