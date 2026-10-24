import "server-only";
import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import type { AccountRole } from "@/lib/enums";
import { computeLookupHash } from "@/app/server/crypto";
import {
  accountInvitations,
  type AccountInvitationRow,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";

export async function listWorkspaceInvitations(
  accountId: string,
): Promise<AccountInvitationRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(accountInvitations)
      .orderBy(desc(accountInvitations.createdAt)),
  );
}

export async function inviteWorkspaceMember(input: {
  accountId: string;
  actorUserId: string;
  email: string;
  role: AccountRole;
}): Promise<{ invitation: AccountInvitationRow; rawToken: string }> {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail.includes("@")) {
    throw new Error("Enter a valid email address");
  }
  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = computeLookupHash("invitation", rawToken);
  const expiresAt = new Date(Date.now() + 7 * 86_400 * 1_000);

  const invitation = await withAccount(input.accountId, async (tx) => {
    const [created] = await tx
      .insert(accountInvitations)
      .values({
        accountId: input.accountId,
        email: cleanEmail,
        role: input.role,
        tokenHash,
        status: "pending",
        invitedBy: input.actorUserId,
        expiresAt,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create invitation");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "team.invited",
      targetType: "account_invitation",
      targetId: created.id,
      summary: `Invited teammate as ${input.role}`,
    });
    return created;
  });

  return { invitation, rawToken };
}
