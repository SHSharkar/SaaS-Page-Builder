import { eq } from "drizzle-orm";
import type { HeadersInit } from "undici-types";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "./server";
import { refreshStaffManagers } from "./rbac";

type RequestHeaders = Awaited<ReturnType<typeof import("next/headers").headers>>;
type PluginRole = "admin" | "user" | ("admin" | "user")[] | undefined;

function pluginRole(key: string): "admin" | "user" {
  return key as "admin" | "user";
}

export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  mustChangePassword: boolean;
  headers: HeadersInit | RequestHeaders;
}) {
  const created = await auth.api.createUser({
    body: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: pluginRole(input.roleKey),
      data: { emailVerified: true, mustChangePassword: input.mustChangePassword },
    },
    headers: input.headers as RequestHeaders,
  });
  await refreshStaffManagers();
  return created.user;
}

export async function provisionAccount(input: {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  mustChangePassword: boolean;
}) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      emailVerified: true,
      role: input.roleKey,
      mustChangePassword: input.mustChangePassword,
    },
    { method: "invitation" },
  );
  if (!user) throw new Error("The account could not be created.");
  await context.internalAdapter.linkAccount({
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(input.password),
    userId: user.id,
  });
  await refreshStaffManagers();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return row;
}

export async function assignRole(userId: string, roleKey: string, headers: RequestHeaders) {
  await auth.api.setRole({ body: { userId, role: pluginRole(roleKey) }, headers });
  await refreshStaffManagers();
}

export async function setAdminPassword(userId: string, newPassword: string, headers: RequestHeaders) {
  await auth.api.setUserPassword({ body: { userId, newPassword }, headers });
}

export async function banAccount(userId: string, banReason: string, headers: RequestHeaders) {
  await auth.api.banUser({ body: { userId, banReason }, headers });
  await refreshStaffManagers();
}

export async function unbanAccount(userId: string, headers: RequestHeaders) {
  await auth.api.unbanUser({ body: { userId }, headers });
  await refreshStaffManagers();
}

export async function revokeAllSessions(userId: string, headers: RequestHeaders) {
  await auth.api.revokeUserSessions({ body: { userId }, headers });
}

export async function revokeSessionByToken(token: string, headers: RequestHeaders) {
  await auth.api.revokeUserSession({ body: { sessionToken: token }, headers });
}

export async function removeAccount(userId: string, headers: RequestHeaders) {
  await auth.api.removeUser({ body: { userId }, headers });
  await refreshStaffManagers();
}

export async function impersonateAccount(userId: string, headers: RequestHeaders) {
  return auth.api.impersonateUser({ body: { userId }, headers });
}

export async function listUserSessions(userId: string, headers: RequestHeaders) {
  return auth.api.listUserSessions({ body: { userId }, headers });
}

export async function setMustChangePassword(userId: string, value: boolean) {
  await db.update(users).set({ mustChangePassword: value, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function touchLastSignIn(userId: string) {
  await db.update(users).set({ lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}
