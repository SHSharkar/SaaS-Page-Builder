import { listWorkspaceMembers } from "@/app/server/accounts";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listWorkspaceInvitations } from "@/app/server/team";
import { getTranslations } from "@/app/server/text";
import { InviteMemberFormClient } from "@/components/app-shell/workspace-forms";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function TeamPage() {
  const actor = await requireAccountPageCapability("team.view");
  const members = await listWorkspaceMembers(actor.account.id);
  const invitations = await listWorkspaceInvitations(actor.account.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("team.heading")}
      </Text>
      <div className="grid gap-6 md:grid-cols-2">
        <Surface>
          <Stack gap="md">
            <Text as="h2" variant="subheading">
              {t("nav.team")}
            </Text>
            {members.map((member) => (
              <Surface key={member.memberId} tone="muted">
                <Stack align="between" direction="row" gap="sm">
                  <Stack gap="sm">
                    <Text as="h3" variant="subheading">
                      {member.name}
                    </Text>
                    <Text tone="secondary" variant="caption">
                      {member.email}
                    </Text>
                  </Stack>
                  <Badge tone="accent">{member.role}</Badge>
                </Stack>
              </Surface>
            ))}
            {invitations.map((inv) => (
              <Surface key={inv.id} tone="muted">
                <Stack align="between" direction="row" gap="sm">
                  <Text as="span" variant="body">
                    {inv.email}
                  </Text>
                  <Badge>{inv.status}</Badge>
                </Stack>
              </Surface>
            ))}
          </Stack>
        </Surface>
        <InviteMemberFormClient />
      </div>
    </Stack>
  );
}
