import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  permissions,
  rolePermissions,
  roles,
  sessions,
  staffInvites,
  users,
  type Role,
} from "@/lib/db/schema";
import { PERMISSIONS, SYSTEM_ROLES, isKnownPermission, permissionsForRole } from "./permissions";
import { staffManagerIds } from "./server";

export type RoleWithCounts = Role & { memberCount: number; permissionCount: number };

export async function syncRbacCatalog(): Promise<void> {
  await ensureDb();

  for (const [index, definition] of PERMISSIONS.entries()) {
    const values = {
      key: definition.key,
      groupKey: definition.group,
      label: definition.label,
      description: definition.description,
      dangerous: definition.dangerous ?? false,
      sortOrder: index,
    };
    const [existing] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, definition.key))
      .limit(1);
    if (existing) {
      await db.update(permissions).set(values).where(eq(permissions.id, existing.id));
    } else {
      await db.insert(permissions).values(values);
    }
  }

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
    }
  }

  await refreshStaffManagers();
}

export async function refreshStaffManagers(): Promise<void> {
  await ensureDb();
  const rows = await db
    .selectDistinct({ userId: users.id })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.banned, false), inArray(permissions.key, ["staff.manage", "role.manage"])));
  staffManagerIds.length = 0;
  staffManagerIds.push(...rows.map((row) => row.userId));
}

export async function listRoles(): Promise<RoleWithCounts[]> {
  await ensureDb();
  const rows = await db.select().from(roles).orderBy(sql`${roles.rank} desc`, asc(roles.name));
  const memberCounts = await db.select({ role: users.role, total: count() }).from(users).groupBy(users.role);
  const permissionCounts = await db
    .select({ roleId: rolePermissions.roleId, total: count() })
    .from(rolePermissions)
    .groupBy(rolePermissions.roleId);
  const members = new Map(memberCounts.map((row) => [row.role, Number(row.total)]));
  const grants = new Map(permissionCounts.map((row) => [row.roleId, Number(row.total)]));
  return rows.map((role) => ({
    ...role,
    memberCount: members.get(role.key) ?? 0,
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

export async function permissionMatrix() {
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
      await db.insert(rolePermissions).values({ roleId, permissionId: permission.id, grantedBy: actorId });
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
  await refreshStaffManagers();
  return wanted.map((permission) => permission.key).sort();
}

export async function deleteRole(roleId: string, actorId: string | null): Promise<void> {
  await ensureDb();
  const role = await getRole(roleId);
  if (!role) throw new Error("Role not found.");
  if (role.isSystem) throw new Error("System roles cannot be deleted. Edit their permissions instead.");
  const members = await db.select({ id: users.id }).from(users).where(eq(users.role, role.key));
  if (members.length) throw new Error("Move the people on this role to another role first.");
  const invites = await db
    .select({ id: staffInvites.id })
    .from(staffInvites)
    .where(and(eq(staffInvites.roleId, roleId), eq(staffInvites.status, "pending")));
  if (invites.length) throw new Error("Revoke the pending invitations that use this role first.");
  await db.delete(roles).where(eq(roles.id, roleId));
  void actorId;
  await refreshStaffManagers();
}

export async function rolesForUser(userId: string): Promise<Role[]> {
  await ensureDb();
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return [];
  const role = await getRoleByKey(user.role);
  return role ? [role] : [];
}

export async function permissionKeysForUser(userId: string): Promise<string[]> {
  await ensureDb();
  return db
    .select({ key: permissions.key })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(users.id, userId))
    .then((rows) => rows.map((row) => row.key));
}

export async function countActiveStaffAtRank(rank: number, excludeUserId?: string): Promise<number> {
  await ensureDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .where(and(eq(users.banned, false), sql`${roles.rank} >= ${rank}`));
  return rows.filter((row) => row.id !== excludeUserId).length;
}

export function permissionDefinition(key: string) {
  return PERMISSIONS.find((permission) => permission.key === key);
}

export type SessionRow = {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  impersonatedBy: string | null;
  user: { id: string; name: string; email: string; role: string };
};

export async function listSessions(options: { userId?: string; exclude?: string } = {}): Promise<SessionRow[]> {
  await ensureDb();
  const filters = [sql`${sessions.expiresAt} > now()`];
  if (options.userId) filters.push(eq(sessions.userId, options.userId));
  if (options.exclude) filters.push(ne(sessions.id, options.exclude));
  const rows = await db
    .select({
      id: sessions.id,
      token: sessions.token,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      impersonatedBy: sessions.impersonatedBy,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(...filters))
    .orderBy(desc(sessions.createdAt));
  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    impersonatedBy: row.impersonatedBy,
    user: { id: row.userId, name: row.name, email: row.email, role: row.role },
  }));
}

export async function revokeSessionById(sessionId: string): Promise<boolean> {
  await ensureDb();
  const result = await db.delete(sessions).where(eq(sessions.id, sessionId));
  return (result.rowCount ?? 0) > 0;
}
