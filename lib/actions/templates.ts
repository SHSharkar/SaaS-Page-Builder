"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  applyTemplatePlaceholders,
  deleteTemplate,
  getTemplate,
  instantiateTemplate,
  savePageAsTemplate,
} from "@/lib/templates";
import { createPage, getPage } from "@/lib/pages";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  pageId?: string;
  siteId?: string;
};

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
    const actor = await requirePermission("template.apply");
    const template = await getTemplate(input.templateId);
    if (!template) throw new Error("Template not found.");
    const rawDoc = await instantiateTemplate(input.templateId);
    const document = applyTemplatePlaceholders(rawDoc, input.values);
    const pageTitle = (input.title || template.name).trim();
    const created = await createPage({
      siteId: input.siteId,
      title: pageTitle,
      slug: input.slug,
      document,
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return {
      ok: true,
      message: `"${pageTitle}" created as a draft.`,
      pageId: created.id,
      siteId: input.siteId,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function retireTemplateAction(input: {
  siteId: string;
  templateId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("template.manage");
    await deleteTemplate(input.siteId, input.templateId, actor);
    revalidatePath("/admin/templates");
    return {
      ok: true,
      message: "Template deleted. Existing pages created from it are untouched.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function savePageAsTemplateAction(input: {
  siteId: string;
  pageId: string;
  name: string;
  description: string;
  sharedAcrossSites?: boolean;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("template.create");
    const page = await getPage(input.siteId, input.pageId);
    if (!page) throw new Error("Page not found.");
    const template = await savePageAsTemplate({
      siteId: input.siteId,
      pageId: input.pageId,
      name: input.name || page.title,
      description: input.description,
      category: "Saved",
      sharedAcrossSites: Boolean(input.sharedAcrossSites),
      actor,
    });
    revalidatePath("/admin/templates");
    return { ok: true, message: `Saved "${template.name}" to reusable templates.` };
  } catch (error) {
    return failure(error);
  }
}
