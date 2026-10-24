import { listStaff, listInvites } from "@/lib/team";
import { requireActor, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { TeamPanel } from "@/components/admin/team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const actor = await requireActor();
  const [members, invites] = await Promise.all([listStaff(), listInvites()]);
  const manage = can(actor, "admin");

  return (
    <div>
      <PageHeader
        eyebrow="Access"
        title="Team"
        description="Internal staff only. Roles are enforced server-side on every action; sensitive changes need a fresh identity confirmation."
        actions={<span className="badge badge-gray">{members.length} people</span>}
      />
      <TeamPanel
        canManage={manage}
        currentUserId={actor.user.id}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          status: member.status,
          twoFactorEnabled: member.twoFactorEnabled,
          lastSignInAt: member.lastSignInAt ? member.lastSignInAt.toISOString() : null,
        }))}
        invites={invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
          expired: invite.expired,
          invitedByName: invite.invitedByName,
        }))}
      />
    </div>
  );
}
