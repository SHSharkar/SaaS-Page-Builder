"use server";

import type { ImportReviewDecision } from "@/lib/documents";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { applyReviewedImport, submitHtmlImport } from "./index";

export async function submitHtmlImportAction(input: {
  siteId: string;
  sourceFilename: string;
  rawHtml: string;
}): Promise<{ ok: boolean; jobId: string }> {
  const actor = await requireAccountCapability("imports.manage");
  const job = await submitHtmlImport({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    ...input,
  });
  await publishAccountChange(actor.account.id, "import.submitted", [job.id]);
  return { ok: true, jobId: job.id };
}

export async function applyImportAction(input: {
  jobId: string;
  slug: string;
  decisions: ImportReviewDecision[];
}): Promise<{ ok: boolean; pageId: string }> {
  const actor = await requireAccountCapability("imports.manage");
  const { job, pageId } = await applyReviewedImport({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    ...input,
  });
  await publishAccountChange(actor.account.id, "import.applied", [
    job.id,
    pageId,
  ]);
  return { ok: true, pageId };
}
