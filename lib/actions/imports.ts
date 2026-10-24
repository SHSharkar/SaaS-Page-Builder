"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/cache";
import { applyImportJob, createImportJob, discardImportJob, getImportJob } from "@/lib/importer";
import type { ImportReviewDecision } from "@/lib/documents";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  jobId?: string;
  pageId?: string;
  copiedAssets?: number;
};

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

const DAILY_IMPORTS = 20;

export async function uploadImportAction(input: {
  siteId: string;
  filename: string;
  html: string;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    if (!consumeRateLimit(`import:${actor.user.id}`, DAILY_IMPORTS, 24 * 60 * 60)) {
      throw new Error(`Import limit reached — ${DAILY_IMPORTS} imports per staff member per day.`);
    }
    if (!input.html.trim()) throw new Error("Paste the HTML or choose a file first.");

    const job = await createImportJob({
      siteId: input.siteId,
      filename: input.filename || "pasted.html",
      bytes: Buffer.from(input.html, "utf8"),
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    return {
      ok: true,
      message: `Mapped ${job.mappingResult?.counts.mapped ?? 0} of ${job.mappingResult?.counts.sections ?? 0} sections — review before applying.`,
      jobId: job.id,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function applyImportAction(input: {
  siteId: string;
  jobId: string;
  title: string;
  slug: string;
  decisions: ImportReviewDecision[];
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const job = await getImportJob(input.siteId, input.jobId);
    if (!job) throw new Error("Import job not found.");
    if (!input.decisions.some((decision) => decision.decision !== "removed")) {
      throw new Error("Keep at least one section before applying the import.");
    }

    const result = await applyImportJob({
      siteId: input.siteId,
      jobId: input.jobId,
      decisions: input.decisions,
      title: input.title,
      slug: input.slug,
      actor,
    });

    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return {
      ok: true,
      message: `Draft created${result.copiedAssets ? ` with ${result.copiedAssets} copied image${result.copiedAssets === 1 ? "" : "s"}` : ""}. It is not published.`,
      pageId: result.pageId,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function discardImportAction(input: { siteId: string; jobId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await discardImportJob(input.siteId, input.jobId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    return { ok: true, message: "Import discarded" };
  } catch (error) {
    return failure(error);
  }
}
