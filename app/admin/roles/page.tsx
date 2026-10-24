import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { permissionsByGroup } from "@/lib/auth/permissions";
import { listRoles } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import { RolesDesigner } from "@/components/admin/roles-client";

export default async function RolesPage() {
  const actor = await requireView("role.view", "/admin/roles");
  const [roles, groups, steppedUp] = await Promise.all([
    listRoles(),
    Promise.resolve(permissionsByGroup()),
    hasRecentStepUp(actor),
  ]);
  const canManage = can(actor, "role.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Built-in and custom staff roles. No account can edit or assign a role ranked higher than its own."
      />

      {canManage && !steppedUp ? <StepUpNotice /> : null}

      <RolesDesigner
        roles={roles}
        groups={groups}
        actorRank={actor.rank ?? 0}
        canManage={canManage}
      />
    </div>
  );
}
