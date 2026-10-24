import Link from "next/link";
import { requireActor, can } from "@/lib/auth/session";
import { listRoles, permissionMatrix, rolePermissionKeys } from "@/lib/auth/rbac";
import { PERMISSION_GROUPS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/admin/ui";
import { RolesPanel } from "@/components/admin/roles-panel";
import { StepUpNotice } from "@/components/admin/step-up-notice";

export const metadata = { title: "Roles and permissions" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const actor = await requireActor();
  if (!can(actor, "role.view")) {
    return (
      <div>
        <PageHeader eyebrow="Access" title="Roles and permissions" />
        <p className="card p-5 text-sm text-slate-600">
          Your roles do not include permission to view roles. Ask an admin, or return to{" "}
          <Link className="underline" href="/admin">
            the overview
          </Link>
          .
        </p>
      </div>
    );
  }

  const [roles, catalogue] = await Promise.all([listRoles(), permissionMatrix()]);
  const grants = await Promise.all(
    roles.map(async (role) => ({ roleId: role.id, keys: await rolePermissionKeys(role.id) })),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Access"
        title="Roles and permissions"
        description="Code defines what each permission means; this screen decides who holds it. Every server action is guarded by a permission key, never by a role name."
        actions={<span className="badge badge-gray">{catalogue.length} permissions</span>}
      />
      <StepUpNotice />
      <RolesPanel
        canManage={can(actor, "role.manage")}
        roles={roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          rank: role.rank,
          isSystem: role.isSystem,
          memberCount: role.memberCount,
          permissionCount: role.permissionCount,
        }))}
        grants={Object.fromEntries(grants.map((row) => [row.roleId, row.keys]))}
        groups={PERMISSION_GROUPS}
        permissions={catalogue.map((permission) => ({
          key: permission.key,
          group: permission.groupKey,
          label: permission.label,
          description: permission.description,
          dangerous: permission.dangerous,
        }))}
        currentRoleKeys={actor.roles.map((role) => role.key)}
      />
    </div>
  );
}
