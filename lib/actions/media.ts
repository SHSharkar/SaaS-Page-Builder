"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { deleteMedia, findMediaReferences, uploadMedia } from "@/lib/media";

export type ActionState = { ok: boolean; error?: string; message?: string; references?: string[] };

export async function uploadMediaAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const siteId = String(formData.get("siteId"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file first.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const { asset, deduplicated } = await uploadMedia({
      siteId,
      bytes,
      filename: file.name || "upload",
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

export async function updateAltTextAction(input: { siteId: string; mediaId: string; altText: string }): Promise<ActionState> {
  try {
    await requireRole("editor");
    await ensureDb();
    await db
      .update(mediaAssets)
      .set({ altText: input.altText.slice(0, 200), updatedAt: new Date() })
      .where(eq(mediaAssets.id, input.mediaId));
    revalidatePath(`/admin/sites/${input.siteId}/media`);
    return { ok: true, message: "Alt text saved" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteMediaAction(input: { siteId: string; mediaId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await deleteMedia(input.siteId, input.mediaId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/media`);
    return { ok: true, message: "Image deleted" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkReferencesAction(input: { siteId: string; mediaId: string }): Promise<ActionState> {
  try {
    await requireRole("viewer");
    const references = await findMediaReferences(input.siteId, input.mediaId);
    return {
      ok: references.length === 0,
      message: references.length ? "Still in use" : "Not referenced anywhere",
      references: references.map((reference) => reference.pageTitle),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
