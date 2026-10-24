/**
 * Server-side account writes that Better Auth does not expose for an
 * invite-only deployment: creating the account row, the credential row and the
 * role assignments in one place, and revoking sessions when an account is
 * suspended.
 */
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { accounts, sessions, userRoles, users } from "@/lib/db/schema";
import { hashPassword } from "./password";
import { setUserRoles } from "./rbac";

export type CreateAccountInput = {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
  mustChangePassword?: boolean;
  createdBy?: string | null;
};

export async function createAccount(input: CreateAccountInput) {
  await ensureDb();
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("That email already has an account.");

  const [user] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      emailVerified: true,
      status: "active",
      mustChangePassword: input.mustChangePassword ?? true,
    })
    .returning();

  // The credential row is Better Auth's own shape: providerId "credential"
  // with the account id equal to the user id is how the library looks it up.
  await db.insert(accounts).values({
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: hashPassword(input.password),
  });

  if (input.roleIds.length) await setUserRoles(user.id, input.roleIds, input.createdBy ?? null);
  return user;
}

export async function setPassword(userId: string, password: string, options: { mustChange?: boolean } = {}) {
  await ensureDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  const passwordHash = hashPassword(password);
  if (account) {
    await db.update(accounts).set({ password: passwordHash, updatedAt: new Date() }).where(eq(accounts.id, account.id));
  } else {
    await db.insert(accounts).values({
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }
  await db
    .update(users)
    .set({ mustChangePassword: options.mustChange ?? false, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Ends every session for a user; used on suspension and password reset. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  await ensureDb();
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  const targets = rows.filter((row) => row.id !== exceptSessionId);
  for (const row of targets) await db.delete(sessions).where(eq(sessions.id, row.id));
  return targets.length;
}

export async function credentialAccount(userId: string) {
  await ensureDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  return account ?? null;
}

export async function rolesOf(userId: string) {
  await ensureDb();
  return db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
}
