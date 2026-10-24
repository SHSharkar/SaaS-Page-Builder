/**
 * Authorization, from the database.
 *
 * The permission catalogue is code (`lib/auth/permissions.ts`); the roles that
 * grant those permissions, and who holds them, are rows. Every guard in the app
 * calls `requirePermission`, so an admin can shape access in `/admin/roles`
 * without a deploy, and no module compares a role name to a string.
 */
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  permissions,
  rolePermissions,
  roles,
  sessions,
  staffInvites,
  userRoles,
  users,
  type Permission,
  type Role,
  type SessionRecord,
} from "@/lib/db/schema";
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  isKnownPermission,
  permissionsForRole,
  type PermissionDef,
} from "./permissions";

export type RoleWithCounts = Role & { memberCount: number; permissionCount: number };

/**
 * Makes the database match the catalogue. Idempotent: missing permissions are
 * inserted, changed labels are updated, and the three system roles keep exactly
 * the permissions their definition names (a custom role is never touched).
 */
export async function syncRbacCatalog(): Promise<void> {
  await ensureDb();

  for (const [index, definition] of PERMISSIONS.entries()) {
    const existing = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, definition.key))
      .limit(1);
    const values = {
      key: definition.key,
      groupKey: definition.group,
      label: definition.label,
      description: definition.description,
      dangerous: definition.dangerous ?? false,
      sortOrder: index,
    };
    if (existing.length) {
      await db.update(permissions).set(values).where(eq(permissions.id, existing[0].id));
    } else {
      await db.insert(permissions).values(values);
    }
  }

  // A permission removed from the catalogue is removed from every role too.
  const known = new Set(PERMISSIONS.map((permission) => permission.key));
  const stored = await db.select({ id: permissions.id, key: permissions.key }).from(permissions);
  for (const row of stored) {
    if (!known.has(row.key)) await db.delete(permissions).where(eq(permissions.id, row.id));
  }

  const catalogue = await db.select().from(permissions);
  const byKey = new Map(catalogue.map((permission) => [permission.key, permission]));

  for (const definition of SYSTEM_ROLES) {
    let [role] = await db.select().from(roles).where(eq(roles.key, definition.key)).limit(1);
    if (!role) {
      [role] = await db
        .insert(roles)
        .values({
          key: definition.key,
          name: definition.name,
          description: definition.description,
          rank: definition.rank,
          isSystem: true,
          permissionsSeeded: false,
        })
        .returning();
    } else if (!role.isSystem || role.name !== definition.name || role.rank !== definition.rank) {
      [role] = await db
        .update(roles)
        .set({ name: definition.name, description: definition.description, rank: definition.rank, isSystem: true })
        .where(eq(roles.id, role.id))
        .returning();
    }

    // Administrator always holds the whole catalogue, including keys added by
    // a later deploy. Editor and Viewer are seeded exactly once, from their
    // definition; after that the matrix in /admin/roles owns them, so an admin
    // can narrow a role without the next boot undoing it.
    if (role.permissionsSeeded && definition.key !== "admin") continue;

    const wanted = permissionsForRole(definition);
    const current = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    const currentIds = new Set(current.map((row) => row.permissionId));
    const wantedIds = new Set(wanted.map((key) => byKey.get(key)?.id).filter(Boolean) as string[]);

    for (const permissionId of wantedIds) {
      if (!currentIds.has(permissionId)) {
        await db.insert(rolePermissions).values({ roleId: role.id, permissionId });
      }
    }
    for (const permissionId of currentIds) {
      if (!wantedIds.has(permissionId)) {
        await db
          .delete(rolePermissions)
          .where(and(eq(rolePermissions.roleId, role.id), eq(rolePermissions.permissionId, permissionId)));
      }
    }

    if (!role.permissionsSeeded) {
      await db.update(roles).set({ permissionsSeeded: true }).where(eq(roles.id, role.id));
      role.permissionsSeeded = true;
    }
  }
}

export async function listRoles(): Promise<RoleWithCounts[]> {
  await ensureDb();
  const rows = await db.select().from(roles).orderBy(sql`${roles.rank} desc`, asc(roles.name));
  const memberCounts = await db
    .select({ roleId: userRoles.roleId, total: count() })
    .from(userRoles)
    .groupBy(userRoles.roleId);
  const permissionCounts = await db
    .select({ roleId: rolePermissions.roleId, total: count() })
    .from(rolePermissions)
    .groupBy(rolePermissions.roleId);
  const members = new Map(memberCounts.map((row) => [row.roleId, Number(row.total)]));
  const grants = new Map(permissionCounts.map((row) => [row.roleId, Number(row.total)]));
  return rows.map((role) => ({
    ...role,
    memberCount: members.get(role.id) ?? 0,
    permissionCount: grants.get(role.id) ?? 0,
  }));
}

export async function getRole(roleId: string): Promise<Role | null> {
  await ensureDb();
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return role ?? null;
}

export async function getRoleByKey(key: string): Promise<Role | null> {
  await ensureDb();
  const [role] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
  return role ?? null;
}

export async function rolePermissionKeys(roleId: string): Promise<string[]> {
  await ensureDb();
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.key).sort();
}

export async function permissionMatrix(): Promise<Permission[]> {
  await ensureDb();
  return db.select().from(permissions).orderBy(asc(permissions.sortOrder));
}

export function slugifyRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createRole(input: {
  key?: string;
  name: string;
  description?: string;
  rank?: number;
  permissionKeys?: string[];
  actorId: string | null;
}): Promise<Role> {
  await ensureDb();
  const name = input.name.trim();
  if (!name) throw new Error("Give the role a name.");
  const key = slugifyRoleKey(input.key || name);
  if (!key) throw new Error("The role name needs at least one letter or number.");
  if (SYSTEM_ROLES.some((role) => role.key === key)) throw new Error(`"${key}" is a system role key. Pick another.`);
  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
  if (existing) throw new Error("A role with that key already exists.");

  const [role] = await db
    .insert(roles)
    .values({ key, name, description: input.description?.trim() ?? "", rank: input.rank ?? 0, isSystem: false })
    .returning();
  if (input.permissionKeys?.length) await setRolePermissions(role.id, input.permissionKeys, input.actorId);
  return role;
}

export async function updateRole(
  roleId: string,
  input: { name?: string; description?: string; rank?: number },
): Promise<Role> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new Error("Role not found.");
  const [updated] = await db
    .update(roles)
    .set({
      name: input.name?.trim() || role.name,
      description: input.description !== undefined ? input.description.trim() : role.description,
      rank: input.rank ?? role.rank,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId))
    .returning();
  return updated;
}

export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[],
  actorId: string | null,
): Promise<string[]> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new Error("Role not found.");
  const unique = [...new Set(permissionKeys)].filter((key) => {
    if (!isKnownPermission(key)) throw new Error(`Unknown permission "${key}".`);
    return true;
  });

  const catalogue = await db.select().from(permissions);
  const wanted = catalogue.filter((permission) => unique.includes(permission.key));
  const current = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  const currentIds = new Set(current.map((row) => row.permissionId));

  for (const permission of wanted) {
    if (!currentIds.has(permission.id)) {
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: permission.id, grantedBy: actorId });
    }
  }
  const wantedIds = new Set(wanted.map((permission) => permission.id));
  for (const permissionId of currentIds) {
    if (!wantedIds.has(permissionId)) {
      await db
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
    }
  }
  return wanted.map((permission) => permission.key).sort();
}

export async function deleteRole(roleId: string, actorId: string | null): Promise<void> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new Error("Role not found.");
  if (role.isSystem) throw new Error("System roles cannot be deleted. Edit their permissions instead.");
  const members = await db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, roleId));
  if (members.length) throw new Error("Move the people on this role to another role first.");
  const invites = await db
    .select({ id: staffInvites.id })
    .from(staffInvites)
    .where(and(eq(staffInvites.roleId, roleId), eq(staffInvites.status, "pending")));
  if (invites.length) throw new Error("Revoke the pending invitations that use this role first.");
  await db.delete(roles).where(eq(roles.id, roleId));
  void actorId;
}

export async function rolesForUser(userId: string): Promise<Role[]> {
  await ensureDb();
  const rows = await db
    .select({ role: roles })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
    .orderBy(sql`${roles.rank} desc`, asc(roles.name));
  return rows.map((row) => row.role);
}

export async function permissionKeysForUser(userId: string): Promise<string[]> {
  await ensureDb();
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  return [...new Set(rows.map((row) => row.key))].sort();
}

export async function setUserRoles(userId: string, roleIds: string[], assignedBy: string | null): Promise<void> {
  await ensureDb();
  const unique = [...new Set(roleIds)];
  if (unique.length) {
    const found = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, unique));
    if (found.length !== unique.length) throw new Error("One of those roles no longer exists.");
  }
  const current = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  const currentIds = new Set(current.map((row) => row.roleId));
  for (const roleId of unique) {
    if (!currentIds.has(roleId)) {
      await db.insert(userRoles).values({ userId, roleId, assignedBy });
    }
  }
  for (const roleId of currentIds) {
    if (!unique.includes(roleId)) {
      await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    }
  }
}

/** How many active people hold a role at or above this rank. Used for the last-admin guard. */
export async function countActiveStaffAtRank(rank: number, excludeUserId?: string): Promise<number> {
  await ensureDb();
  const rows = await db
    .select({ userId: users.id, rank: roles.rank })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(eq(users.status, "active"));
  const people = new Set(
    rows.filter((row) => row.rank >= rank && row.userId !== excludeUserId).map((row) => row.userId),
  );
  return people.size;
}

export type GlobalSession = SessionRecord & { user: { id: string; name: string; email: string } };

export async function listSessions(filter: { userId?: string } = {}): Promise<GlobalSession[]> {
  await ensureDb();
  const query = db
    .select({
      session: sessions,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .$dynamic();
  const rows = await (filter.userId ? query.where(eq(sessions.userId, filter.userId)) : query).orderBy(
    sql`${sessions.createdAt} desc`,
  );
  return rows.map((row) => ({
    ...row.session,
    user: { id: row.userId, name: row.name, email: row.email },
  }));
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await ensureDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** The permission descriptor, for labels in error messages and the matrix. */
export function permissionDefinition(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((permission) => permission.key === key);
}
