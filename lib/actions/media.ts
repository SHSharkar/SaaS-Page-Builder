"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { deleteMedia, findMediaReferences, updateMediaAlt, uploadMedia } from "@/lib/media";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  references?: string[];
};

export async function uploadMediaAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("media.upload");
    const siteId = String(formData.get("siteId"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file first.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const { asset, deduplicated } = await uploadMedia({
      siteId,
      bytes,
      filename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      actor,
    });
    revalidatePath(`/admin/sites/${siteId}/media`);
    return {
      ok: true,
      message: deduplicated
        ? "That image was already in the library, so the existing copy is used."
        : `Uploaded ${file.name}`,
      references: [asset.id],
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateAltTextAction(input: {
  siteId: string;
  mediaId: string;
  altText: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("media.update");
    await updateMediaAlt(input.siteId, input.mediaId, input.altText, actor);
    revalidatePath(`/admin/sites/${input.siteId}/media`);
    return { ok: true, message: "Alt text saved." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteMediaAction(input: {
  siteId: string;
  mediaId: string;
  force?: boolean;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("media.delete");
    await deleteMedia(input.siteId, input.mediaId, actor, Boolean(input.force));
    revalidatePath(`/admin/sites/${input.siteId}/media`);
    return { ok: true, message: "Image deleted." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkReferencesAction(input: {
  siteId: string;
  mediaId: string;
}): Promise<ActionState> {
  try {
    await requirePermission("media.view");
    const references = await findMediaReferences(input.siteId, input.mediaId);
    return {
      ok: references.length === 0,
      message: references.length ? "Still in use" : "Not referenced anywhere",
      references: references.map((reference) => reference.label),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const updateMediaAltAction = updateAltTextAction;
export const mediaUsageAction = checkReferencesAction;

