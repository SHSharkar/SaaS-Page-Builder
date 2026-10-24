"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { applyTemplate, retireTemplate, savePageAsTemplate, getTemplate } from "@/lib/templates";
import { getPage } from "@/lib/pages";

export type ActionState = { ok: boolean; error?: string; message?: string; pageId?: string; siteId?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function applyTemplateAction(input: {
  siteId: string;
  templateId: string;
  title: string;
  slug: string;
  values: Record<string, string>;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const template = await getTemplate(input.templateId);
    if (!template) throw new Error("Template not found.");
    const result = await applyTemplate({
      siteId: input.siteId,
      templateId: input.templateId,
      title: input.title || template.name,
      slug: input.slug,
      values: input.values,
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return { ok: true, message: `“${input.title || template.name}” created as a draft.`, pageId: result.pageId, siteId: input.siteId };
  } catch (error) {
    return failure(error);
  }
}

export async function retireTemplateAction(input: { templateId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await retireTemplate(input.templateId, actor);
    revalidatePath("/admin/templates");
    return { ok: true, message: "Template retired. Pages already created from it are untouched." };
  } catch (error) {
    return failure(error);
  }
}

export async function savePageAsTemplateAction(input: {
  siteId: string;
  pageId: string;
  name: string;
  description: string;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const page = await getPage(input.siteId, input.pageId);
    if (!page) throw new Error("Page not found.");
    const template = await savePageAsTemplate({
      siteId: input.siteId,
      document: page.draftDocument,
      name: input.name || page.title,
      description: input.description,
      actor,
    });
    revalidatePath("/admin/templates");
    return { ok: true, message: `Saved “${template.name}” to the staff templates.` };
  } catch (error) {
    return failure(error);
  }
}
