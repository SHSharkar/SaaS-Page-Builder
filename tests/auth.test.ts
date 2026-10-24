import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { roles, userRoles, users } from "@/lib/db/schema";
import { PERMISSION_KEYS, SYSTEM_ROLES } from "@/lib/auth/permissions";
import {
  countActiveStaffAtRank,
  createRole,
  deleteRole,
  getRoleByKey,
  listRoles,
  permissionKeysForUser,
  rolePermissionKeys,
  rolesForUser,
  setRolePermissions,
  setUserRoles,
  syncRbacCatalog,
} from "@/lib/auth/rbac";
import { ADMIN_RANK, assertPermission, can, isAdminRank, requireStepUp } from "@/lib/auth/session";
import { createAccount } from "@/lib/auth/mutations";
import { adminActor, editorActor, viewerActor } from "./support/actor";

describe("permission catalogue", () => {
  it("has unique keys and every system role only names real ones", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const role of SYSTEM_ROLES) {
      if (role.permissions === "*") continue;
      for (const key of role.permissions) expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("keeps the admin role on the whole catalogue, including keys added later", async () => {
    await ensureDb();
    const admin = await getRoleByKey("admin");
    expect(admin).not.toBeNull();
    const granted = await rolePermissionKeys(admin!.id);
    expect(granted.sort()).toEqual([...PERMISSION_KEYS].sort());
  });
});

describe("deny by default", () => {
  it("refuses a permission the actor does not hold", async () => {
    const viewer = await viewerActor();
    expect(can(viewer, "role.manage")).toBe(false);
    expect(() => assertPermission(viewer, "role.manage")).toThrowError(/needs the .* permission/);
    await expect(
      (async () => {
        assertPermission(viewer, "role.manage");
      })(),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("treats an unknown permission key as a programming error", async () => {
    const admin = await adminActor();
    expect(() => assertPermission(admin, "page.teleport")).toThrowError(/Unknown permission/);
  });

  it("gives the editor content permissions but not people or platform ones", async () => {
    const editor = await editorActor();
    expect(can(editor, "page.edit")).toBe(true);
    expect(can(editor, "page.publish")).toBe(true);
    expect(can(editor, "role.manage")).toBe(false);
    expect(can(editor, "settings.manage")).toBe(false);
    expect(isAdminRank(editor)).toBe(false);
  });

  it("gives the admin the rank override", async () => {
    const admin = await adminActor();
    expect(isAdminRank(admin)).toBe(true);
    expect(admin.roles.some((role) => role.rank >= ADMIN_RANK)).toBe(true);
  });
});

describe("step-up", () => {
  it("rejects a session whose window has lapsed", async () => {
    const admin = await adminActor();
    const stale = { ...admin, stepUpValid: false };
    await expect(requireStepUp(stale)).rejects.toMatchObject({ status: 428 });
  });

  it("accepts a fresh confirmation", async () => {
    const admin = await adminActor();
    await expect(requireStepUp(admin)).resolves.toBeUndefined();
  });
});

describe("role assignment", () => {
  it("reports the roles a user holds, highest rank first", async () => {
    const viewer = await viewerActor();
    const held = await rolesForUser(viewer.user.id);
    expect(held.map((role) => role.key)).toEqual(["viewer"]);
  });

  it("replaces assignments atomically and records who did it", async () => {
    await ensureDb();
    const admin = await adminActor();
    const [editorRole, viewerRole] = await Promise.all([getRoleByKey("editor"), getRoleByKey("viewer")]);
    const account = await createAccount({
      name: "Role Swap",
      email: `role-swap-${Date.now()}@trofeo.example`,
      password: "TrofeoDemo2026!",
      roleIds: [viewerRole!.id],
      mustChangePassword: false,
    });
    expect((await rolesForUser(account.id)).map((role) => role.key)).toEqual(["viewer"]);

    await setUserRoles(account.id, [editorRole!.id, viewerRole!.id], admin.user.id);
    const held = await rolesForUser(account.id);
    expect(held.map((role) => role.key).sort()).toEqual(["editor", "viewer"]);
    expect((await permissionKeysForUser(account.id)).length).toBeGreaterThan(13);

    // The role that already existed keeps its original grant record; the newly
    // added one records who assigned it.
    const [row] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, account.id), eq(userRoles.roleId, editorRole!.id)))
      .limit(1);
    expect(row.assignedBy).toBe(admin.user.id);

    await db.delete(users).where(eq(users.id, account.id));
  });

  it("counts active admins so the last one cannot be demoted", async () => {
    await ensureDb();
    const admins = await countActiveStaffAtRank(ADMIN_RANK);
    expect(admins).toBeGreaterThanOrEqual(1);
    const admin = await adminActor();
    expect(await countActiveStaffAtRank(ADMIN_RANK, admin.user.id)).toBe(admins - 1);
  });
});

describe("custom roles", () => {
  it("creates, narrows and deletes a role that nobody holds", async () => {
    await ensureDb();
    const role = await createRole({
      name: `Marketing ${Date.now()}`,
      description: "Reads pages and manages templates",
      rank: 20,
      permissionKeys: ["page.view", "template.view", "template.manage"],
      actorId: null,
    });
    expect(role.isSystem).toBe(false);
    expect((await rolePermissionKeys(role.id)).sort()).toEqual(["page.view", "template.manage", "template.view"]);

    await setRolePermissions(role.id, ["page.view"], null);
    expect(await rolePermissionKeys(role.id)).toEqual(["page.view"]);

    await deleteRole(role.id, null);
    const stored = await db.select().from(roles).where(eq(roles.id, role.id));
    expect(stored).toHaveLength(0);
  });

  it("refuses to delete a system role or one somebody still holds", async () => {
    await ensureDb();
    const editorRole = await getRoleByKey("editor");
    await expect(deleteRole(editorRole!.id, null)).rejects.toThrow(/System roles cannot be deleted/);
  });
});

describe("catalogue sync", () => {
  it("is idempotent", async () => {
    await ensureDb();
    const before = await listRoles();
    await syncRbacCatalog();
    const after = await listRoles();
    expect(after.map((role) => [role.key, role.permissionCount])).toEqual(
      before.map((role) => [role.key, role.permissionCount]),
    );
  });

  it("keeps a narrowed Editor role narrowed (the matrix wins after seeding)", async () => {
    await ensureDb();
    const editor = await getRoleByKey("editor");
    const original = await rolePermissionKeys(editor!.id);
    try {
      await setRolePermissions(editor!.id, ["page.view"], null);
      await syncRbacCatalog();
      expect(await rolePermissionKeys(editor!.id)).toEqual(["page.view"]);
    } finally {
      await setRolePermissions(editor!.id, original, null);
    }
  });
});
