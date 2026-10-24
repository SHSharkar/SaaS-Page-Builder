import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq, lt } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { sessions, users, type Role, type SessionRecord, type User } from "@/lib/db/schema";
import { auth } from "./server";
import { permissionKeysForUser, rolesForUser } from "./rbac";
import { permissionDefinition } from "./rbac";

const STEP_UP_MINUTES = 10;

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export type Actor = {
  user: User;
  session: SessionRecord;
  /** Highest rank first; the first role is what the header shows. */
  roles: Role[];
  permissions: Set<string>;
  stepUpValid: boolean;
};

/** The role names, for display only. Authorization never reads this. */
export function roleLabels(actor: Actor): string {
  return actor.roles.length ? actor.roles.map((role) => role.name).join(", ") : "No role";
}

export function primaryRole(actor: Actor): Role | null {
  return actor.roles[0] ?? null;
}

/**
 * Rank is a hierarchy, not a permission: "admins may override the author" rules
 * (retiring someone else's template, for instance) read the rank of the roles
 * the actor holds, so a custom role above 100 behaves like an admin.
 */
export const ADMIN_RANK = 100;

export function isAdminRank(actor: Actor | null): boolean {
  return !!actor?.roles.some((role) => role.rank >= ADMIN_RANK);
}

/**
 * Resolves the actor from Better Auth's session, then loads the roles and
 * permissions that identity holds. Every request re-reads them, so a role
 * change takes effect on the next click rather than on the next sign-in.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  await ensureDb();
  const requestHeaders = await headers();
  const result = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);
  if (!result?.user) return null;

  const [user] = await db.select().from(users).where(eq(users.id, result.user.id)).limit(1);
  if (!user || user.status !== "active") return null;

  const [session] = await db.select().from(sessions).where(eq(sessions.id, result.session.id)).limit(1);
  if (!session) return null;

  const roles = await rolesForUser(user.id);
  const permissions = new Set(await permissionKeysForUser(user.id));

  return {
    user,
    session,
    roles,
    permissions,
    stepUpValid: !!session.stepUpUntil && session.stepUpUntil > new Date(),
  };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return actor;
}

export function can(actor: Actor | null, permission: string): boolean {
  return !!actor?.permissions.has(permission);
}

/**
 * The single authorization door. It is deny-by-default: an actor without the
 * permission gets a 403 that names the capability, and an unknown key is a
 * programming error rather than a silent allow.
 */
export function assertPermission(actor: Actor, permission: string): void {
  const definition = permissionDefinition(permission);
  if (!definition) throw new Error(`Unknown permission "${permission}". Add it to lib/auth/permissions.ts.`);
  if (!actor.permissions.has(permission)) {
    throw new AuthError(`This action needs the "${definition.label}" permission.`, 403);
  }
}

export async function requirePermission(permission: string): Promise<Actor> {
  const actor = await requireActor();
  assertPermission(actor, permission);
  return actor;
}

/**
 * Page-level guard. A screen you cannot view redirects to the dashboard with a
 * named explanation rather than throwing a 500; the data itself never loads.
 */
export async function requireView(permission: string): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.permissions.has(permission)) {
    const label = permissionDefinition(permission)?.label ?? permission;
    redirect(`/admin?denied=${encodeURIComponent(label)}`);
  }
  return actor;
}

/** Sensitive acts (role changes, deletes, hostnames) demand fresh proof. */
export async function requireStepUp(actor: Actor): Promise<void> {
  if (!actor.stepUpValid) {
    throw new AuthError("Confirm your password again to continue.", 428);
  }
}

export async function markStepUp(actor: Actor): Promise<void> {
  await db
    .update(sessions)
    .set({
      stepUpUntil: new Date(Date.now() + STEP_UP_MINUTES * 60_000),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, actor.session.id));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function sweepSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return result.rowCount ?? 0;
}

/** Signs the current request out through Better Auth and clears the cookie. */
export async function signOutCurrentSession(): Promise<void> {
  const requestHeaders = await headers();
  await auth.api.signOut({ headers: requestHeaders }).catch(() => null);
}
