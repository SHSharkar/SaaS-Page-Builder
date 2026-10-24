"use server";

import type { PageDocument } from "@/lib/documents";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { createAccountTemplate } from "./index";

export async function saveTemplateAction(input: {
  siteId: string;
  name: string;
  category?: string;
  document: PageDocument;
}): Promise<{ ok: boolean; templateId: string }> {
  const actor = await requireAccountCapability("templates.manage");
  const created = await createAccountTemplate({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    ...input,
  });
  await publishAccountChange(actor.account.id, "template.created", [
    created.id,
  ]);
  return { ok: true, templateId: created.id };
}
