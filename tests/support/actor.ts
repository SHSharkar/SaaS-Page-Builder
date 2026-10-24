import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { permissionKeysForUser, rolesForUser } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/auth/session";

export async function actorForEmail(email: string): Promise<Actor> {
  await ensureDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`The seeded account ${email} is missing.`);
  return {
    user,
    session: {
      id: "00000000-0000-0000-0000-000000000000",
      token: "test",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      ipAddress: null,
      userAgent: "vitest",
      stepUpUntil: new Date(Date.now() + 3_600_000),
      impersonatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    roles: await rolesForUser(user.id),
    permissions: new Set(await permissionKeysForUser(user.id)),
    stepUpValid: true,
  };
}

export const adminActor = () => actorForEmail("admin@trofeo.example");
export const editorActor = () => actorForEmail("editor@trofeo.example");
export const viewerActor = () => actorForEmail("viewer@trofeo.example");
