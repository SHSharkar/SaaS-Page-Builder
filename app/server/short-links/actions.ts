"use server";

import type { ShortLinkKind } from "@/lib/enums";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { issueShortLink } from "./index";

export async function createPreviewShortLinkAction(input: {
  kind: ShortLinkKind;
  targetPath: string;
}): Promise<{ ok: boolean; path: string }> {
  const actor = await requireAccountCapability("pages.view");
  const issued = await issueShortLink({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    kind: input.kind,
    targetPath: input.targetPath,
  });
  return { ok: true, path: issued.path };
}
