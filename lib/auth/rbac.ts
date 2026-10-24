import "server-only";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  permissions,
  rolePermissions,
  roles,
  sessions,
  staffInvites,
  users,
  type Permission,
  type Role,
  type Session,
} from "@/lib/db/schema";
import { PERMISSIONS, PERMISSION_BY_KEY, PERMISSION_KEYS, SYSTEM_ROLES } from "./permissions";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { slugify } from "@/lib/documents";
import { recordAudit } from "@/lib/audit";

export async function syncRbacCatalog(): Promise<void> {
  for (const spec of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({
        key: spec.key,
        groupKey: spec.group,
        label: spec.label,
        description: spec.description,
        dangerous: Boolean(spec.dangerous),
      })
      .onConflictDoUpdate({
        target: permissions.key,
        set: {
          groupKey: spec.group,
          label: spec.label,
          description: spec.description,
          dangerous: Boolean(spec.dangerous),
        },
      });
  }

  for (const seed of SYSTEM_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.key, seed.key)).limit(1);
    let roleRow: Role;
    const isNew = existing.length === 0;
    if (isNew) {
      const [inserted] = await db
        .insert(roles)
        .values({
          key: seed.key,
          name: seed.name,
          description: seed.description,
          rank: seed.rank,
          isSystem: true,
        })
        .returning();
      roleRow = inserted;
    } else {
      roleRow = existing[0];
      await db
        .update(roles)
        .set({ rank: seed.rank, isSystem: true })
        .where(eq(roles.id, roleRow.id));
    }

    const keys = seed.permissions === "*" ? PERMISSION_KEYS : seed.permissions;
    if (isNew || seed.permissions === "*") {
      if (keys.length) {
        await db
          .insert(rolePermissions)
          .values(keys.map((permissionKey) => ({ roleId: roleRow.id, permissionKey })))
          .onConflictDoNothing();
      }
    }
  }
}

export async function listRoles(): Promise<
  (Role & {
    memberCount: number;
    permissionCount: number;
    permissionKeys: string[];
    pendingInviteCount: number;
  })[]
> {
  await ensureDb();
  const [allRoles, memberRows, grantRows, inviteRows] = await Promise.all([
    db.select().from(roles).orderBy(desc(roles.rank), asc(roles.name)),
    db
      .select({ roleKey: users.role, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.role),
    db.select().from(rolePermissions),
    db
      .select({ roleId: staffInvites.roleId, count: sql<number>`count(*)::int` })
      .from(staffInvites)
      .where(eq(staffInvites.status, "pending"))
      .groupBy(staffInvites.roleId),
  ]);
  const members = new Map(memberRows.map((row) => [row.roleKey, row.count]));
  const invites = new Map(inviteRows.map((row) => [row.roleId, row.count]));
  const grants = new Map<string, string[]>();
  for (const g of grantRows) {
    const arr = grants.get(g.roleId) ?? [];
    arr.push(g.permissionKey);
    grants.set(g.roleId, arr);
  }
  return allRoles.map((role) => {
    const keys = grants.get(role.id) ?? [];
    return {
      ...role,
      memberCount: members.get(role.key) ?? 0,
      permissionCount: keys.length,
      permissionKeys: keys,
      pendingInviteCount: invites.get(role.id) ?? 0,
    };
  });
}

export async function getRole(roleId: string): Promise<Role | null> {
  await ensureDb();
  const [row] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return row ?? null;
}

export async function getRoleByKey(key: string): Promise<Role | null> {
  await ensureDb();
  const [row] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
  return row ?? null;
}

export async function rolePermissionKeys(roleId: string): Promise<string[]> {
  await ensureDb();
  const rows = await db
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.key);
}

export async function rolesForUser(userId: string): Promise<Role[]> {
  await ensureDb();
  const rows = await db
    .select({ role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .where(eq(users.id, userId))
    .limit(1);
  return rows.map((row) => row.role);
}

export async function permissionKeysForUser(userId: string): Promise<string[]> {
  await ensureDb();
  const rows = await db
    .selectDistinct({ key: rolePermissions.permissionKey })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(users.id, userId));
  return rows.map((row) => row.key);
}

export async function countActiveStaffAtRank(minRank: number, excludingUserId?: string): Promise<number> {
  await ensureDb();
  const conditions = [eq(users.banned, false), gte(roles.rank, minRank)];
  if (excludingUserId) conditions.push(ne(users.id, excludingUserId));
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .where(and(...conditions));
  return row?.count ?? 0;
}

function validatePermissionKeys(keys: string[]): string[] {
  const unique = [...new Set(keys)];
  for (const key of unique) {
    if (!PERMISSION_BY_KEY.has(key)) {
      throw new ValidationError(`Unknown permission "${key}".`);
    }
  }
  return unique;
}

export async function createRole(input: {
  name: string;
  description?: string;
  rank?: number;
  permissionKeys: string[];
  actorId: string | null;
}): Promise<Role> {
  await ensureDb();
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    throw new ValidationError("Role names must be between 2 and 60 characters.");
  }
  const key = slugify(name).replace(/\//g, "-");
  if (!key || key.length < 2 || !/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
    throw new ValidationError("Choose a role name with letters or numbers.");
  }
  const rank = Math.max(0, Math.min(99, Math.round(input.rank ?? 25)));
  const keys = validatePermissionKeys(input.permissionKeys);

  const clash = await getRoleByKey(key);
  if (clash) throw new ConflictError(`A role with the key "${key}" already exists.`);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(roles)
      .values({
        key,
        name,
        description: (input.description ?? "").trim().slice(0, 240),
        rank,
        isSystem: false,
      })
      .returning();
    if (keys.length) {
      await tx
        .insert(rolePermissions)
        .values(keys.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
    return row;
  });

  await recordAudit({
    actorId: input.actorId,
    action: "role_created",
    targetType: "role",
    targetId: created.id,
    summary: `Created role "${created.name}" (${keys.length} permissions)`,
    metadata: { key: created.key, rank, permissions: keys },
  });
  return created;
}

export async function updateRole(
  roleId: string,
  patch: { name?: string; description?: string; rank?: number },
  actorId: string | null = null,
): Promise<Role> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  const nextName = patch.name !== undefined ? patch.name.trim() : role.name;
  if (nextName.length < 2 || nextName.length > 60) {
    throw new ValidationError("Role names must be between 2 and 60 characters.");
  }
  const nextRank =
    role.isSystem || patch.rank === undefined
      ? role.rank
      : Math.max(0, Math.min(99, Math.round(patch.rank)));

  const [updated] = await db
    .update(roles)
    .set({
      name: nextName,
      description:
        patch.description !== undefined ? patch.description.trim().slice(0, 240) : role.description,
      rank: nextRank,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId))
    .returning();

  await recordAudit({
    actorId,
    action: "role_updated",
    targetType: "role",
    targetId: roleId,
    summary: `Updated role "${updated.name}"`,
    metadata: { name: updated.name, rank: updated.rank },
  });
  return updated;
}

export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[],
  actorId: string | null,
): Promise<{ added: string[]; removed: string[] }> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new NotFoundError("Role not found.");
  if (role.key === "admin") {
    throw new ValidationError(
      "The Administrator role always holds every permission so the platform cannot lock itself out.",
    );
  }
  const desired = validatePermissionKeys(permissionKeys);
  const current = new Set(await rolePermissionKeys(roleId));
  const next = new Set(desired);
  const added = desired.filter((key) => !current.has(key));
  const removed = [...current].filter((key) => !next.has(key));

  await db.transaction(async (tx) => {
    if (removed.length) {
      await tx
        .delete(rolePermissions)
        .where(
          and(eq(rolePermissions.roleId, roleId), inArray(rolePermissions.permissionKey, removed)),
        );
    }
    if (added.length) {
      await tx
        .insert(rolePermissions)
        .values(added.map((permissionKey) => ({ roleId, permissionKey })))
        .onConflictDoNothing();
    }
    await tx.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, roleId));
  });

  await recordAudit({
    actorId,
    action: "role_permissions_changed",
    targetType: "role",
    targetId: roleId,
    summary: `Adjusted permissions on "${role.name}" (+${added.length} / -${removed.length})`,
    metadata: { roleKey: role.key, added, removed, total: desired.length },
  });
  return { added, removed };
}

export async function deleteRole(roleId: string, actorId: string | null): Promise<void> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new NotFoundError("Role not found.");
  if (role.isSystem) throw new ValidationError("System roles cannot be deleted.");
  const [holders] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, role.key));
  if ((holders?.count ?? 0) > 0) {
    throw new ConflictError(
      `${holders.count} account(s) still hold "${role.name}". Move them to another role first.`,
    );
  }
  await db.delete(roles).where(eq(roles.id, roleId));
  await recordAudit({
    actorId,
    action: "role_deleted",
    targetType: "role",
    targetId: roleId,
    summary: `Deleted custom role "${role.name}"`,
    metadata: { key: role.key },
  });
}

export async function listSessions(filter?: { userId?: string }): Promise<
  (Session & { userEmail: string; userName: string; user: typeof users.$inferSelect })[]
> {
  await ensureDb();
  const now = new Date();
  const conditions = [gte(sessions.expiresAt, now)];
  if (filter?.userId) conditions.push(eq(sessions.userId, filter.userId));
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(...conditions))
    .orderBy(desc(sessions.createdAt));
  return rows.map((row) => ({
    ...row.session,
    userEmail: row.user.email,
    userName: row.user.name,
    user: row.user,
  }));
}

export async function revokeSessionById(sessionId: string): Promise<boolean> {
  await ensureDb();
  const removed = await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ id: sessions.id });
  return removed.length > 0;
}

export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  await ensureDb();
  const condition = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);
  const removed = await db.delete(sessions).where(condition).returning({ id: sessions.id });
  return removed.length;
}

export async function permissionMatrix(): Promise<Permission[]> {
  await ensureDb();
  return db.select().from(permissions).orderBy(asc(permissions.groupKey), asc(permissions.key));
}
