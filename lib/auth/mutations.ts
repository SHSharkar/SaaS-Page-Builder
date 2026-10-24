import "server-only";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { accounts, sessions, users, type User } from "@/lib/db/schema";
import { auth, registerResetIntercept } from "./server";
import { hashPassword } from "./password";
import { getRoleByKey } from "./rbac";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export async function provisionAccount(input: {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  mustChangePassword: boolean;
  headers?: Headers;
}): Promise<User> {
  await ensureDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const role = await getRoleByKey(input.roleKey);
  if (!role) throw new ValidationError(`Unknown role "${input.roleKey}".`);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new ConflictError("An account already uses that email.");

  const created = await auth.api.createUser({
    body: {
      email,
      password: input.password,
      name,
      role: role.key as "admin",
      data: { emailVerified: true },
    },
  });

  const [updated] = await db
    .update(users)
    .set({
      emailVerified: true,
      mustChangePassword: input.mustChangePassword,
      passwordChangedAt: input.mustChangePassword ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, created.user.id))
    .returning();
  if (!updated) throw new NotFoundError("Account vanished right after creation.");
  return updated;
}

async function callerIsSystemAdmin(headers: Headers): Promise<boolean> {
  const session = await auth.api.getSession({ headers });
  return session?.user?.role === "admin";
}

export async function assignRole(
  userId: string,
  roleKey: string,
  headers: Headers,
): Promise<void> {
  await ensureDb();
  const role = await getRoleByKey(roleKey);
  if (!role) throw new ValidationError("Unknown role.");
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.setRole({
      headers,
      body: { userId, role: role.key as "admin" },
    });
    return;
  }
  await db
    .update(users)
    .set({ role: role.key, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function banAccount(
  userId: string,
  reason: string | undefined,
  headers: Headers,
  expiresInSeconds?: number,
): Promise<void> {
  await ensureDb();
  const cleanReason = reason?.trim().slice(0, 240) || undefined;
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.banUser({
      headers,
      body: {
        userId,
        banReason: cleanReason,
        banExpiresIn: expiresInSeconds,
      },
    });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        banned: true,
        banReason: cleanReason ?? null,
        banExpires: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1_000) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

export async function unbanAccount(userId: string, headers: Headers): Promise<void> {
  await ensureDb();
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.unbanUser({ headers, body: { userId } });
    return;
  }
  await db
    .update(users)
    .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function endUserSessions(userId: string, headers: Headers): Promise<void> {
  await ensureDb();
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.revokeUserSessions({ headers, body: { userId } });
    return;
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteAccount(userId: string, headers: Headers): Promise<void> {
  await ensureDb();
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.removeUser({ headers, body: { userId } });
    return;
  }
  await db.delete(users).where(eq(users.id, userId));
}

export async function issuePasswordResetUrl(email: string): Promise<string | null> {
  let capturedUrl: string | null = null;
  const dispose = registerResetIntercept(email, (url) => {
    capturedUrl = url;
  });
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
    });
  } finally {
    dispose();
  }
  return capturedUrl;
}

export async function setAdminPassword(
  userId: string,
  newPassword: string,
  headers: Headers,
): Promise<void> {
  await ensureDb();
  if (await callerIsSystemAdmin(headers)) {
    await auth.api.setUserPassword({
      headers,
      body: { userId, newPassword },
    });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(accounts)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
}

export async function setMustChangePassword(userId: string, required: boolean): Promise<void> {
  await ensureDb();
  await db
    .update(users)
    .set({
      mustChangePassword: required,
      ...(required ? {} : { passwordChangedAt: new Date() }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function touchLastSignIn(userId: string): Promise<void> {
  await ensureDb();
  await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, userId));
}

export const createAccount = provisionAccount;
export const removeAccount = deleteAccount;
export const revokeAllSessions = endUserSessions;
