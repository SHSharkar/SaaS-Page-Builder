import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { auditEntries, sites, users, type AuditEntry } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import type { AuditAction } from "@/lib/enums";

export type AuditInput = {
  action: AuditAction | string;
  summary: string;
  siteId?: string | null;
  actor?: Actor | { id: string; role: string } | null;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await ensureDb();
  const actorId =
    input.actor && "user" in input.actor
      ? input.actor.user.id
      : input.actor?.id ?? input.actorId ?? null;

  const actorRole =
    input.actor && "user" in input.actor
      ? input.actor.roles.map((role) => role.name).join(", ") || null
      : input.actor?.role ?? null;

  await db.insert(auditEntries).values({
    action: input.action as AuditAction,
    summary: input.summary,
    siteId: input.siteId ?? null,
    actorUserId: actorId,
    actorRoleSnapshot: actorRole,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    detail: input.detail ?? input.metadata ?? null,
  });
}

export type AuditRow = AuditEntry & {
  actorName: string | null;
  actorEmail: string | null;
  siteName: string | null;
};

export async function listAudit(
  options: { siteId?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  await ensureDb();
  const limit = Math.min(options.limit ?? 50, 200);
  const query = db
    .select({
      entry: auditEntries,
      actorName: users.name,
      siteName: sites.name,
    })
    .from(auditEntries)
    .leftJoin(users, eq(users.id, auditEntries.actorUserId))
    .leftJoin(sites, eq(sites.id, auditEntries.siteId))
    .$dynamic();

  const rows = await (options.siteId ? query.where(eq(auditEntries.siteId, options.siteId)) : query)
    .orderBy(desc(auditEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.entry,
    actorName: row.actorName,
    actorEmail: row.entry.actorEmailSnapshot,
    siteName: row.siteName,
  }));
}
