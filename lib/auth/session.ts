import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { sessions, users, type Role, type Session, type User } from "@/lib/db/schema";
import { auth } from "./server";
import { PERMISSION_BY_KEY, type PermissionKey } from "./permissions";
import { permissionKeysForUser, rolesForUser } from "./rbac";
import { ForbiddenError, StepUpRequiredError, UnauthorizedError } from "@/lib/errors";

export const STEP_UP_MINUTES = 10;
export const ADMIN_RANK = 100;

export interface Actor {
  user: User;
  session: Session;
  roles: Role[];
  role?: Role;
  rank?: number;
  impersonatedBy?: string | null;
  permissions: Set<string>;
  stepUpValid: boolean;
}

function banHasLapsed(user: User): boolean {
  return Boolean(user.banned && user.banExpires && user.banExpires <= new Date());
}

export const getActor = cache(async (): Promise<Actor | null> => {
  await ensureDb();
  const requestHeaders = await headers();
  const resolved = await auth.api.getSession({ headers: requestHeaders });
  if (!resolved) return null;

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, resolved.user.id))
    .limit(1);
  if (!userRow) return null;

  if (userRow.banned && !banHasLapsed(userRow)) {
    await db.delete(sessions).where(eq(sessions.userId, userRow.id));
    return null;
  }

  const [sessionRow] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, resolved.session.id))
    .limit(1);
  if (!sessionRow) return null;

  const [userRoles, grantedKeys] = await Promise.all([
    rolesForUser(userRow.id),
    permissionKeysForUser(userRow.id),
  ]);
  const now = new Date();
  const stepUpValid = Boolean(sessionRow.stepUpUntil && sessionRow.stepUpUntil > now);
  const sortedRoles = [...userRoles].sort((a, b) => b.rank - a.rank);
  const topRole = sortedRoles[0];

  return {
    user: userRow,
    session: sessionRow,
    roles: userRoles,
    role: topRole,
    rank: topRole?.rank ?? 0,
    impersonatedBy: sessionRow.impersonatedBy ?? null,
    permissions: new Set(grantedKeys),
    stepUpValid,
  };
});

export function can(actor: Actor | null, permission: PermissionKey | string): boolean {
  if (!actor || actor.user.banned) return false;
  if (!PERMISSION_BY_KEY.has(permission)) {
    throw new Error(`Unknown permission key: ${permission}`);
  }
  return actor.permissions.has(permission);
}

export function isAdminRank(actor: Actor | null): boolean {
  if (!actor) return false;
  return actor.roles.some((role) => role.rank >= ADMIN_RANK);
}

export function highestRank(actor: Actor): number {
  return actor.roles.reduce((max, role) => Math.max(max, role.rank), 0);
}

export function primaryRole(actor: Actor): Role | null {
  if (!actor.roles.length) return null;
  return [...actor.roles].sort((a, b) => b.rank - a.rank)[0];
}

export function roleLabels(actor: Actor): string {
  return actor.roles.map((role) => role.name).join(", ") || "unassigned";
}

export function hasRecentStepUp(actor: Actor | null | undefined): boolean {
  return Boolean(actor?.stepUpValid);
}

export function assertPermission(
  actor: Actor | null,
  permission: PermissionKey | string,
): asserts actor is Actor {
  if (!actor) throw new UnauthorizedError("Sign in first.");
  if (actor.user.banned) throw new ForbiddenError("This account has been suspended.");
  const spec = PERMISSION_BY_KEY.get(permission);
  if (!spec) throw new Error(`Unknown permission key: ${permission}`);
  if (!actor.permissions.has(permission)) {
    throw new ForbiddenError(`This action needs the "${spec.label}" permission.`);
  }
}

export async function requireActor(options?: {
  allowPasswordPending?: boolean;
  allowPasswordChangeGate?: boolean;
  allowTwoFactorPending?: boolean;
  allowWithoutTwoFactor?: boolean;
}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const allowPw = Boolean(options?.allowPasswordPending || options?.allowPasswordChangeGate);
  if (actor.user.mustChangePassword && !allowPw) {
    redirect("/admin/account/password");
  }
  const allow2fa = Boolean(options?.allowTwoFactorPending || options?.allowWithoutTwoFactor);
  if (!actor.user.twoFactorEnabled && !allow2fa) {
    const { getSettingBoolean } = await import("@/lib/settings");
    const enforced = await getSettingBoolean("security.require_two_factor", false);
    if (enforced) {
      redirect("/admin/account");
    }
  }
  return actor;
}

export async function requirePermission(permission: PermissionKey | string): Promise<Actor> {
  const actor = await getActor();
  assertPermission(actor, permission);
  return actor;
}

export function requireView(actor: Actor, permission: PermissionKey | string): Actor;
export function requireView(
  permission: PermissionKey | string,
  nextUrl?: string,
): Promise<Actor>;
export function requireView(
  first: Actor | PermissionKey | string,
  second?: PermissionKey | string,
): Actor | Promise<Actor> {
  if (typeof first !== "string") {
    const perm = String(second ?? "");
    if (!can(first, perm)) {
      redirect(`/admin?denied=${encodeURIComponent(perm)}`);
    }
    return first;
  }
  return (async () => {
    const actor = await getActor();
    if (!actor) {
      const next = second ? `?next=${encodeURIComponent(second)}` : "";
      redirect(`/sign-in${next}`);
    }
    if (!can(actor, first)) {
      redirect(`/admin?denied=${encodeURIComponent(first)}`);
    }
    return actor;
  })();
}

export async function requireStepUp(actor: Actor): Promise<void> {
  if (!actor.stepUpValid) throw new StepUpRequiredError();
}

export async function markStepUp(sessionOrActor: string | Actor): Promise<Date> {
  await ensureDb();
  const sessionId =
    typeof sessionOrActor === "string" ? sessionOrActor : sessionOrActor.session.id;
  const until = new Date(Date.now() + STEP_UP_MINUTES * 60_000);
  await db
    .update(sessions)
    .set({ stepUpUntil: until, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
  return until;
}

export function assertRoleCeiling(actor: Actor, targetRank: number, action?: string): void {
  if (isAdminRank(actor)) return;
  if (targetRank >= highestRank(actor)) {
    throw new ForbiddenError(
      action
        ? `You cannot ${action} a role ranked at or above your own.`
        : "You cannot grant or modify a role ranked at or above your own.",
    );
  }
}

export async function sweepSessions(): Promise<number> {
  await ensureDb();
  const removed = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return removed.length;
}

export const getCurrentActor = getActor;
