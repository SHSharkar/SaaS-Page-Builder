import { listStaff, listInvites } from "@/lib/team";
import { listRoles } from "@/lib/auth/rbac";
import { requireView, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { TeamPanel } from "@/components/admin/team-panel";
import { StepUpNotice } from "@/components/admin/step-up-notice";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const actor = await requireView("staff.view");
  const [members, invites, roles] = await Promise.all([listStaff(), listInvites(), listRoles()]);
  const manage = can(actor, "staff.manage");

  return (
    <div>
      <PageHeader
        eyebrow="Access"
        title="Team"
        description="Internal staff only. Roles come from the permission matrix, every action re-checks them on the server, and sensitive changes need a fresh identity confirmation."
        actions={<span className="badge badge-gray">{members.length} people</span>}
      />
      <div className="space-y-4">
        {manage ? <StepUpNotice compact /> : null}
        <TeamPanel
          canManage={manage}
          currentUserId={actor.user.id}
          roles={roles.map((role) => ({
            id: role.id,
            name: role.name,
            isSystem: role.isSystem,
            rank: role.rank,
          }))}
          members={members.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            status: member.status,
            mustChangePassword: member.mustChangePassword,
            twoFactorEnabled: member.twoFactorEnabled,
            lastSignInAt: member.lastSignInAt ? member.lastSignInAt.toISOString() : null,
            sessionCount: member.sessionCount,
            roles: member.roles.map((role) => ({
              id: role.id,
              name: role.name,
              isSystem: role.isSystem,
              rank: role.rank,
            })),
          }))}
          invites={invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            roleId: invite.roleId,
            roleName: invite.roleName,
            status: invite.status,
            expiresAt: invite.expiresAt.toISOString(),
            expired: invite.expired,
            invitedByName: invite.invitedByName,
          }))}
        />
      </div>
    </div>
  );
}
