import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { loadTeamSnapshot } from "@/lib/team";
import { listLiveSessions } from "@/lib/actions/team";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import {
  InviteForm,
  InvitesList,
  LiveSessionsPanel,
  MembersList,
} from "@/components/admin/team-client";

export default async function TeamPage() {
  const actor = await requireView("staff.view", "/admin/team");
  const [snapshot, liveSessions, steppedUp] = await Promise.all([
    loadTeamSnapshot(),
    listLiveSessions(),
    hasRecentStepUp(actor),
  ]);

  const canInvite = can(actor, "staff.invite");
  const canManage = can(actor, "staff.manage");

  const roleOptions = snapshot.roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    rank: role.rank,
    isSystem: role.isSystem,
    permissionCount: role.permissionKeys.length,
  }));

  const members = snapshot.members.map((member) => ({
    ...member,
    lastSignInAt: member.lastSignInAt?.toISOString() ?? null,
  }));

  const invites = snapshot.invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    roleName: invite.roleName,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff access"
        title="Team & invitations"
        description="Invite colleagues with single-use 7-day tokens, assign roles, issue 1-hour password reset links, and manage active sessions."
      />

      {canManage && !steppedUp ? <StepUpNotice /> : null}

      {canInvite ? (
        <Panel
          title="Add a team member"
          description="Invitation tokens are hashed at rest and expire automatically after seven days."
        >
          <InviteForm roles={roleOptions} actorRank={actor.rank ?? 0} />
        </Panel>
      ) : null}

      <Panel
        title={`Staff accounts (${members.length})`}
        description="The platform refuses any change that would leave zero active administrators."
      >
        <MembersList
          members={members}
          roles={roleOptions}
          canManage={canManage}
          actorId={actor.user.id}
          actorRank={actor.rank ?? 0}
        />
      </Panel>

      <Panel
        title={`Invitations (${invites.length})`}
        description="Pending, accepted, expired, and revoked invitation links."
      >
        <InvitesList invites={invites} canManage={canInvite} />
      </Panel>

      <Panel
        title={`Live browser sessions (${liveSessions.length})`}
        description="Active sessions across every staff account."
      >
        <LiveSessionsPanel
          sessions={liveSessions}
          currentSessionId={actor.session.id}
          canManage={canManage}
        />
      </Panel>
    </div>
  );
}
