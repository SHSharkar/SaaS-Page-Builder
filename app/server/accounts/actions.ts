"use server";

import { eq } from "drizzle-orm";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { accounts } from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { publishAccountChange } from "@/app/server/realtime/publish";

export async function renameWorkspaceAction(input: {
  name: string;
}): Promise<{ ok: boolean; accountId: string }> {
  const actor = await requireAccountCapability("settings.manage");
  const cleanName = input.name.trim();
  if (cleanName.length < 2 || cleanName.length > 120) {
    throw new Error("Workspace name must be between 2 and 120 characters");
  }

  await withPlatform(async (tx) => {
    await tx
      .update(accounts)
      .set({ name: cleanName, updatedAt: new Date() })
      .where(eq(accounts.id, actor.account.id));
    await recordAccountAudit(tx, {
      accountId: actor.account.id,
      actorUserId: actor.user.id,
      action: "account.renamed",
      targetType: "account",
      targetId: actor.account.id,
      summary: `Renamed workspace to "${cleanName}"`,
    });
  });

  await publishAccountChange(actor.account.id, "account.updated", [
    actor.account.id,
  ]);
  return { ok: true, accountId: actor.account.id };
}
