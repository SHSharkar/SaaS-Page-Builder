"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireStepUp } from "@/lib/auth/session";
import { createRole, deleteRole, getRole, setRolePermissions, updateRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";

export type RoleActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  roleId?: string;
};

function failure(error: unknown): RoleActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function createRoleAction(input: {
  name: string;
  description: string;
  permissionKeys: string[];
}): Promise<RoleActionState> {
  try {
    const actor = await requirePermission("role.manage");
    await requireStepUp(actor);
    const role = await createRole({
      name: input.name,
      description: input.description,
      permissionKeys: input.permissionKeys,
      actorId: actor.user.id,
    });
    await recordAudit({
      action: "role_created",
      summary: `Created the ${role.name} role with ${input.permissionKeys.length} permission(s)`,
      actor,
      targetType: "role",
      targetId: role.id,
      detail: { key: role.key, permissionKeys: input.permissionKeys },
    });
    revalidatePath("/admin/roles");
    return { ok: true, message: `The ${role.name} role is ready to assign.`, roleId: role.id };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRoleAction(input: {
  roleId: string;
  name: string;
  description: string;
  rank: number;
  permissionKeys: string[];
}): Promise<RoleActionState> {
  try {
    const actor = await requirePermission("role.manage");
    await requireStepUp(actor);
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Role not found.");
    // A system role keeps its name and rank (the definition owns those) but its
    // description and, except for Administrator, its permissions are editable.
    const updated = await updateRole(input.roleId, {
      name: role.isSystem ? role.name : input.name,
      description: input.description,
      rank: role.isSystem ? role.rank : input.rank,
    });
    const keys =
      role.isSystem && role.key === "admin" ? input.permissionKeys : input.permissionKeys;
    if (!(role.isSystem && role.key === "admin")) {
      await setRolePermissions(input.roleId, keys, actor.user.id);
    }
    await recordAudit({
      action: "role_updated",
      summary: `Updated the ${updated.name} role (${keys.length} permission(s))`,
      actor,
      targetType: "role",
      targetId: input.roleId,
      detail: { permissionKeys: keys },
    });
    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${input.roleId}`);
    return { ok: true, message: "Role saved.", roleId: input.roleId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRoleAction(input: { roleId: string }): Promise<RoleActionState> {
  try {
    const actor = await requirePermission("role.manage");
    await requireStepUp(actor);
    const role = await getRole(input.roleId);
    if (!role) throw new Error("Role not found.");
    await deleteRole(input.roleId, actor.user.id);
    await recordAudit({
      action: "role_deleted",
      summary: `Deleted the ${role.name} role`,
      actor,
      targetType: "role",
      targetId: input.roleId,
    });
    revalidatePath("/admin/roles");
    return { ok: true, message: `The ${role.name} role is gone.` };
  } catch (error) {
    return failure(error);
  }
}
