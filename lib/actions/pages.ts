"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor, requireRole, can } from "@/lib/auth/session";
import {
  createPage,
  publishPage,
  saveDraft,
  unpublishPage,
  archivePage,
  rollbackToVersion,
  setHomepage,
  updatePageMeta,
  schedulePublish,
  getPage,
} from "@/lib/pages";
import { publishGlobals, saveGlobalsDraft, type GlobalKind } from "@/lib/globals";
import { applyTemplate } from "@/lib/templates";
import type { PageSeo } from "@/lib/documents";

export type ActionState = { ok: boolean; error?: string; message?: string; lockVersion?: number; pageId?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function saveDraftAction(input: {
  siteId: string;
  pageId: string;
  document: unknown;
  lockVersion: number;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const result = await saveDraft(input.siteId, input.pageId, input.document, input.lockVersion, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, lockVersion: result.lockVersion, message: "Draft saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveGlobalsDraftAction(input: {
  siteId: string;
  kind: GlobalKind;
  document: unknown;
  lockVersion: number;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const result = await saveGlobalsDraft(input.siteId, input.kind, input.document, input.lockVersion, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, lockVersion: result.lockVersion, message: "Draft saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDefaultSeoAction(input: {
  siteId: string;
  seo: Partial<PageSeo>;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const { getSiteContent } = await import("@/lib/globals");
    const { DEFAULT_ROOT_PROPS, DOCUMENT_SCHEMA_VERSION } = await import("@/lib/documents");
    const content = await getSiteContent(input.siteId, "defaults");
    const document = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      root: { props: { ...DEFAULT_ROOT_PROPS, seo: input.seo } },
      content: [],
    };
    await saveGlobalsDraft(input.siteId, "defaults", document, content?.lockVersion ?? 0, actor);
    await publishGlobals(input.siteId, "defaults", actor);
    revalidatePath(`/admin/sites/${input.siteId}/globals`);
    return { ok: true, message: "Default search tags published to every page" };
  } catch (error) {
    return failure(error);
  }
}

export async function publishAction(input: { siteId: string; pageId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const result = await publishPage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: `Published as version ${result.versionNumber}`, pageId: input.pageId };
  } catch (error) {
    return failure(error);
  }
}

export async function publishGlobalsAction(input: { siteId: string; kind: GlobalKind }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await publishGlobals(input.siteId, input.kind, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Published to every page" };
  } catch (error) {
    return failure(error);
  }
}

export async function unpublishAction(input: { siteId: string; pageId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await unpublishPage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Taken offline. The cache cleared in this request." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveAction(input: { siteId: string; pageId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await archivePage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Archived" };
  } catch (error) {
    return failure(error);
  }
}

export async function rollbackAction(input: { siteId: string; pageId: string; versionId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const result = await rollbackToVersion(input.siteId, input.pageId, input.versionId, actor);
    revalidatePath(`/edit/${input.siteId}/${input.pageId}`);
    return { ok: true, message: `Rolled back — now version ${result.versionNumber}` };
  } catch (error) {
    return failure(error);
  }
}

export async function setHomepageAction(input: { siteId: string; pageId: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await setHomepage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Homepage updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function scheduleAction(input: {
  siteId: string;
  pageId: string;
  when: string | null;
  operator: "publish" | "unpublish";
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const when = input.when ? new Date(input.when) : null;
    if (when && Number.isNaN(when.getTime())) throw new Error("Enter a valid date and time.");
    await schedulePublish(input.siteId, input.pageId, when, input.operator, actor);
    return { ok: true, message: when ? `Scheduled for ${when.toLocaleString("en-GB")}` : "Schedule cleared" };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePageMetaAction(input: {
  siteId: string;
  pageId: string;
  title: string;
  slug: string;
  seo: Partial<PageSeo>;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    await updatePageMeta(
      input.siteId,
      input.pageId,
      { title: input.title, slug: input.slug, seo: input.seo },
      actor,
    );
    revalidatePath(`/admin/sites/${input.siteId}/pages/${input.pageId}`);
    return { ok: true, message: "Page settings saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function createPageAction(formData: FormData): Promise<void> {
  const actor = await requireRole("editor");
  const siteId = String(formData.get("siteId"));
  const title = String(formData.get("title") ?? "Untitled page");
  const slug = String(formData.get("slug") ?? "");
  const templateId = String(formData.get("templateId") ?? "");

  if (templateId) {
    const result = await applyTemplate({
      siteId,
      templateId,
      values: Object.fromEntries(
        [...formData.entries()]
          .filter(([key]) => key.startsWith("ph:"))
          .map(([key, value]) => [key.slice(3), String(value)]),
      ),
      title,
      slug,
      actor,
    });
    redirect(`/edit/${siteId}/${result.pageId}`);
  }

  const page = await createPage({ siteId, title, slug, actor });
  redirect(`/edit/${siteId}/${page.id}`);
}

export async function saveAsTemplateAction(input: {
  siteId: string;
  pageId: string;
  name: string;
  description: string;
}): Promise<ActionState> {
  try {
    const actor = await requireRole("editor");
    const page = await getPage(input.siteId, input.pageId);
    if (!page) throw new Error("Page not found.");
    const { savePageAsTemplate } = await import("@/lib/templates");
    await savePageAsTemplate({
      siteId: input.siteId,
      document: page.draftDocument,
      name: input.name,
      description: input.description,
      actor,
    });
    return { ok: true, message: "Saved to your staff templates" };
  } catch (error) {
    return failure(error);
  }
}

export async function whoAmI() {
  const actor = await requireActor();
  return { name: actor.user.name, role: actor.user.role, canEdit: can(actor, "editor") };
}
