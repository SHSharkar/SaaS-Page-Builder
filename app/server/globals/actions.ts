"use server";

import type { PageDocument } from "@/lib/documents";
import type { GlobalKind } from "@/lib/enums";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { publishSiteGlobal } from "./index";

export async function publishGlobalAction(input: {
  siteId: string;
  kind: GlobalKind;
  document: PageDocument;
}): Promise<{ ok: boolean; contentId: string }> {
  const actor = await requireAccountCapability("globals.manage");
  const updated = await publishSiteGlobal({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    kind: input.kind,
    document: input.document,
  });
  await publishAccountChange(actor.account.id, "globals.published", [
    updated.id,
  ]);
  return { ok: true, contentId: updated.id };
}
