import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq, lt } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { sessions, users, type Role, type SessionRecord, type User } from "@/lib/db/schema";
import { auth } from "./server";
import { permissionDefinition, permissionKeysForUser, rolesForUser } from "./rbac";

const STEP_UP_MINUTES = 10;

export const ADMIN_RANK = 100;

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
  roles: Role[];
  permissions: Set<string>;
  stepUpValid: boolean;
};

export function roleLabels(actor: Actor): string {
  return actor.roles.length ? actor.roles.map((role) => role.name).join(", ") : "No role";
}

export function primaryRole(actor: Actor): Role | null {
  return actor.roles[0] ?? null;
}

export function isAdminRank(actor: Actor | null): boolean {
  return !!actor?.roles.some((role) => role.rank >= ADMIN_RANK);
}

export const getActor = cache(async (): Promise<Actor | null> => {
  await ensureDb();
  const requestHeaders = await headers();
  const result = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);
  if (!result?.user) return null;

  const [user] = await db.select().from(users).where(eq(users.id, result.user.id)).limit(1);
  if (!user) return null;
  if (user.banned && (!user.banExpires || user.banExpires > new Date())) return null;

  const [session] = await db.select().from(sessions).where(eq(sessions.id, result.session.id)).limit(1);
  if (!session) return null;

  return {
    user,
    session,
    roles: await rolesForUser(user.id),
    permissions: new Set(await permissionKeysForUser(user.id)),
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

export async function requireView(permission: string): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.permissions.has(permission)) {
    const label = permissionDefinition(permission)?.label ?? permission;
    redirect(`/admin?denied=${encodeURIComponent(label)}`);
  }
  return actor;
}

export async function requireStepUp(actor: Actor): Promise<void> {
  if (!actor.stepUpValid) {
    throw new AuthError("Confirm your password again to continue.", 428);
  }
}

export async function markStepUp(actor: Actor): Promise<void> {
  await db
    .update(sessions)
    .set({ stepUpUntil: new Date(Date.now() + STEP_UP_MINUTES * 60_000), updatedAt: new Date() })
    .where(eq(sessions.id, actor.session.id));
}

export function actorRank(actor: Actor): number {
  return actor.roles.reduce((top, role) => Math.max(top, role.rank), 0);
}

export function assertRoleCeiling(actor: Actor, targetRank: number, action: string): void {
  const rank = actorRank(actor);
  if (rank >= ADMIN_RANK) return;
  if (targetRank >= rank) {
    throw new AuthError(`Your role cannot ${action} a role at or above its own rank.`, 403);
  }
}

export async function sweepSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return result.rowCount ?? 0;
}
