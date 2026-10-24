"use server";

import type { AccountRole } from "@/lib/enums";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { inviteWorkspaceMember } from "./index";

export async function inviteMemberAction(input: {
  email: string;
  role: AccountRole;
}): Promise<{ ok: boolean; invitationId: string }> {
  const actor = await requireAccountCapability("team.manage");
  const { invitation } = await inviteWorkspaceMember({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    email: input.email,
    role: input.role,
  });
  await publishAccountChange(actor.account.id, "team.invited", [invitation.id]);
  return { ok: true, invitationId: invitation.id };
}
