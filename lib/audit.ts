import { desc, eq, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { auditLog, users, type AuditEntry } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";

type AuditAction = AuditEntry["action"];

export type AuditInput = {
  action: AuditAction;
  summary: string;
  siteId?: string | null;
  actor?: Actor | { id: string; role: string } | null;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
};

/** Append-only: the application never updates or deletes these rows. */
export async function recordAudit(input: AuditInput): Promise<void> {
  await ensureDb();
  const actorId =
    input.actor && "user" in input.actor ? input.actor.user.id : (input.actor?.id ?? null);
  // The snapshot is display history, so it records the role names as they were
  // at the time of the action rather than a foreign key that may change later.
  const actorRole =
    input.actor && "user" in input.actor
      ? input.actor.roles.map((role) => role.name).join(", ") || null
      : (input.actor?.role ?? null);
  await db.insert(auditLog).values({
    action: input.action,
    summary: input.summary,
    siteId: input.siteId ?? null,
    actorUserId: actorId,
    actorRoleSnapshot: actorRole,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    detail: input.detail ?? null,
  });
}

export type AuditRow = AuditEntry & { actorName: string | null; siteName: string | null };

export async function listAudit(options: { siteId?: string; limit?: number } = {}): Promise<AuditRow[]> {
  await ensureDb();
  const limit = Math.min(options.limit ?? 50, 200);
  const query = db
    .select({
      entry: auditLog,
      actorName: users.name,
      siteName: sql<string | null>`(select name from site where site.id = ${auditLog.siteId})`,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .$dynamic();

  const rows = await (options.siteId ? query.where(eq(auditLog.siteId, options.siteId)) : query)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row.entry, actorName: row.actorName, siteName: row.siteName }));
}
