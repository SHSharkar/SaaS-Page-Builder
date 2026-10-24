"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  applyImportJob,
  createImportJob,
  discardImportJob,
  getImportJob,
  type SegmentDecisionInput,
} from "@/lib/importer";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  jobId?: string;
  pageId?: string;
};

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function uploadImportAction(input: {
  siteId: string;
  filename: string;
  html: string;
  fetchRemoteImages?: boolean;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("import.create");
    if (!input.html.trim()) throw new Error("Paste HTML markup or choose a file first.");

    const job = await createImportJob({
      siteId: input.siteId,
      filename: input.filename || "pasted.html",
      html: input.html,
      fetchRemoteImages: input.fetchRemoteImages,
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    const total = (job.report?.mappedCount ?? 0) + (job.report?.unmappedCount ?? 0);
    return {
      ok: true,
      message: `Mapped ${job.report?.mappedCount ?? 0} of ${total} sections. Review before applying.`,
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
  decisions: SegmentDecisionInput[];
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("import.apply");
    const job = await getImportJob(input.siteId, input.jobId);
    if (!job) throw new Error("Import job not found.");
    if (!input.decisions.some((decision) => decision.decision !== "skip")) {
      throw new Error("Keep at least one section before applying the import.");
    }

    const result = await applyImportJob({
      siteId: input.siteId,
      jobId: input.jobId,
      decisions: input.decisions,
      pageTitle: input.title,
      pageSlug: input.slug,
      actor,
    });

    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return {
      ok: true,
      message: `Draft created with ${result.blockCount} block${result.blockCount === 1 ? "" : "s"}. It stays unpublished until you publish it.`,
      pageId: result.pageId,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function discardImportAction(input: {
  siteId: string;
  jobId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("import.apply");
    await discardImportJob(input.siteId, input.jobId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/imports`);
    return { ok: true, message: "Import discarded." };
  } catch (error) {
    return failure(error);
  }
}

export const startImportAction = uploadImportAction;
