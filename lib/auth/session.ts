import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { hashToken, newToken } from "./password";

export const SESSION_COOKIE = "trofeo_session";
const SESSION_DAYS = 7;
const STEP_UP_MINUTES = 10;
const PENDING_2FA_MINUTES = 10;

export type Role = User["role"];
export type Actor = { user: User; sessionId: string; stepUpValid: boolean };

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

async function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function createSession(
  userId: string,
  options: { pendingTwoFactor?: boolean } = {},
): Promise<string> {
  const token = newToken();
  const h = await headers().catch(() => null);
  const expiresAt = new Date(
    Date.now() + (options.pendingTwoFactor ? PENDING_2FA_MINUTES : SESSION_DAYS * 24 * 60) * 60_000,
  );
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    pendingTwoFactor: options.pendingTwoFactor ?? false,
    ipAddress: h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h?.get("user-agent")?.slice(0, 250) ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, { ...(await cookieOptions()), expires: expiresAt });
  return token;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Resolves the actor from the session cookie, server-side, on every request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureDb();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(sessions.pendingTwoFactor, false),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    user: row.user,
    sessionId: row.session.id,
    stepUpValid: !!row.session.stepUpUntil && row.session.stepUpUntil > new Date(),
  };
});

/** The pending second-factor state, resolved from the same cookie. */
export const getPendingTwoFactor = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureDb();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        eq(sessions.pendingTwoFactor, true),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return actor;
}

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function can(actor: Actor, minimum: Role): boolean {
  return RANK[actor.user.role] >= RANK[minimum];
}

export async function requireRole(minimum: Role): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor, minimum)) {
    throw new AuthError(`This action needs the ${minimum} role.`, 403);
  }
  return actor;
}

/** Sensitive acts (role changes, domain binding, deletes) demand fresh proof. */
export async function requireStepUp(actor: Actor): Promise<void> {
  if (!actor.stepUpValid) {
    throw new AuthError("Confirm your identity again to continue.", 428);
  }
}

export async function markStepUp(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ stepUpUntil: new Date(Date.now() + STEP_UP_MINUTES * 60_000) })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function sweepSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return result.rowCount ?? 0;
}

export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.role, "admin"),
        eq(users.status, "active"),
        excludeUserId ? sql`${users.id} <> ${excludeUserId}` : sql`true`,
      ),
    );
  return rows[0]?.count ?? 0;
}
