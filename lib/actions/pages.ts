"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, requireActor, requirePermission } from "@/lib/auth/session";
import { ConflictError } from "@/lib/errors";
import {
  createPage,
  duplicatePage,
  getPage,
  listDeletedPages,
  makeHomepage,
  publishPage,
  purgePage,
  restorePage,
  rollbackToVersion,
  savePageDraft,
  schedulePublish,
  softDeletePage,
  unpublishPage,
} from "@/lib/pages";
import {
  publishGlobals,
  saveDefaultSeo,
  saveGlobalsDraft,
  type GlobalKind,
} from "@/lib/globals";
import {
  applyTemplatePlaceholders,
  instantiateTemplate,
  savePageAsTemplate,
} from "@/lib/templates";
import { migrateDocument, type PageDocument, type PageSeo } from "@/lib/documents";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  lockVersion?: number;
  pageId?: string;
  conflict?: boolean;
};

function failure(error: unknown): ActionState {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    conflict: error instanceof ConflictError,
  };
}

export async function saveDraftAction(input: {
  siteId: string;
  pageId: string;
  title?: string;
  seo?: Partial<PageSeo>;
  document: PageDocument;
  lockVersion: number;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.edit");
    const result = await savePageDraft({
      siteId: input.siteId,
      pageId: input.pageId,
      expectedLockVersion: input.lockVersion,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.seo !== undefined ? { seo: input.seo as PageSeo } : {}),
      document: migrateDocument(input.document),
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, lockVersion: result.lockVersion, message: "Draft saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveGlobalsDraftAction(input: {
  siteId: string;
  kind: GlobalKind;
  document: PageDocument;
  lockVersion: number;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("globals.edit");
    const result = await saveGlobalsDraft(
      input.siteId,
      input.kind,
      migrateDocument(input.document),
      actor,
      input.lockVersion,
    );
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, lockVersion: result.lockVersion, message: "Draft saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDefaultSeoAction(input: {
  siteId: string;
  seo: Partial<PageSeo>;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("globals.edit");
    await saveDefaultSeo(input.siteId, input.seo, actor);
    revalidatePath(`/admin/sites/${input.siteId}/globals`);
    return { ok: true, message: "Default search tags published across the site." };
  } catch (error) {
    return failure(error);
  }
}

export async function publishAction(input: {
  siteId: string;
  pageId: string;
  note?: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.publish");
    const result = await publishPage(input.siteId, input.pageId, actor, input.note);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return {
      ok: true,
      message: `Published as version ${result.version.versionNumber}.`,
      lockVersion: result.page.lockVersion,
      pageId: input.pageId,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function publishGlobalsAction(input: {
  siteId: string;
  kind: GlobalKind;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("globals.publish");
    const updated = await publishGlobals(input.siteId, input.kind, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return {
      ok: true,
      lockVersion: updated.lockVersion,
      message: "Published across every page on this site.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function unpublishAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.publish");
    await unpublishPage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Taken offline and removed from public cache." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.archive");
    await softDeletePage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Moved to trash." };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.archive");
    await restorePage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return { ok: true, message: "Restored as a draft. Publish when ready." };
  } catch (error) {
    return failure(error);
  }
}

export async function purgePageAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.archive");
    await purgePage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return { ok: true, message: "Page permanently purged." };
  } catch (error) {
    return failure(error);
  }
}

export async function rollbackAction(input: {
  siteId: string;
  pageId: string;
  versionId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.rollback");
    await rollbackToVersion(input.siteId, input.pageId, input.versionId, actor, true);
    revalidatePath(`/edit/${input.siteId}/${input.pageId}`);
    revalidatePath(`/admin/sites/${input.siteId}/pages/${input.pageId}`);
    return { ok: true, message: "Rolled back and published as a new version." };
  } catch (error) {
    return failure(error);
  }
}

export async function setHomepageAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.homepage");
    await makeHomepage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}`);
    return { ok: true, message: "Homepage updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function scheduleAction(input: {
  siteId: string;
  pageId: string;
  publishAt?: string | null;
  unpublishAt?: string | null;
  when?: string | null;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.schedule");
    const rawPub = input.publishAt !== undefined ? input.publishAt : (input.when ?? null);
    const pub = rawPub ? new Date(rawPub) : null;
    const unpub = input.unpublishAt ? new Date(input.unpublishAt) : null;
    if ((pub && Number.isNaN(pub.getTime())) || (unpub && Number.isNaN(unpub.getTime()))) {
      throw new Error("Enter valid dates and times.");
    }
    await schedulePublish({
      siteId: input.siteId,
      pageId: input.pageId,
      publishAt: pub,
      unpublishAt: unpub,
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/pages/${input.pageId}`);
    return {
      ok: true,
      message:
        pub || unpub
          ? `Schedule saved${pub ? ` (publishes ${pub.toLocaleString("en-US")})` : ""}.`
          : "Schedule cleared.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePageMetaAction(input: {
  siteId: string;
  pageId: string;
  title: string;
  slug: string;
  seo: PageSeo;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.edit");
    const page = await getPage(input.siteId, input.pageId);
    if (!page) throw new Error("Page not found.");
    await savePageDraft({
      siteId: input.siteId,
      pageId: input.pageId,
      expectedLockVersion: page.lockVersion,
      title: input.title,
      slug: input.slug,
      document: page.draftDocument,
      seo: input.seo,
      actor,
    });
    revalidatePath(`/admin/sites/${input.siteId}/pages/${input.pageId}`);
    return { ok: true, message: "Page settings saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function createPageAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("page.create");
  const siteId = String(formData.get("siteId"));
  const title = String(formData.get("title") ?? "Untitled page");
  const slug = String(formData.get("slug") ?? "");
  const templateId = String(formData.get("templateId") ?? "");

  let document: PageDocument | undefined;
  if (templateId && templateId !== "none") {
    await requirePermission("template.apply");
    const values = Object.fromEntries(
      [...formData.entries()]
        .filter(([key]) => key.startsWith("ph:"))
        .map(([key, value]) => [key.slice(3), String(value)]),
    );
    const base = await instantiateTemplate(templateId);
    document = applyTemplatePlaceholders(base, values);
  }

  const page = await createPage({ siteId, title, slug, document, actor });
  redirect(`/edit/${siteId}/${page.id}`);
}

export async function saveAsTemplateAction(input: {
  siteId: string;
  pageId: string;
  name: string;
  description: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("template.create");
    await savePageAsTemplate({
      siteId: input.siteId,
      pageId: input.pageId,
      name: input.name,
      description: input.description,
      category: "Saved",
      sharedAcrossSites: false,
      actor,
    });
    revalidatePath("/admin/templates");
    return { ok: true, message: "Saved to team templates." };
  } catch (error) {
    return failure(error);
  }
}

export async function whoAmI() {
  const actor = await requireActor();
  return {
    name: actor.user.name,
    roles: actor.roles.map((role) => role.name),
    canEdit: can(actor, "page.edit"),
  };
}

export async function duplicatePageAction(input: {
  siteId: string;
  pageId: string;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("page.create");
    const copy = await duplicatePage(input.siteId, input.pageId, actor);
    revalidatePath(`/admin/sites/${input.siteId}/pages`);
    return { ok: true, pageId: copy.id, message: `Duplicated as "${copy.title}".` };
  } catch (error) {
    return failure(error);
  }
}

export async function listTrashedPagesForSite(siteId: string) {
  await requirePermission("page.view");
  return listDeletedPages(siteId);
}

export const createPageFormAction = createPageAction;
export const publishPageAction = publishAction;
export const unpublishPageAction = unpublishAction;
export const archivePageAction = archiveAction;
export const deletePageAction = archiveAction;
export const restorePageAction = restoreAction;
export const rollbackPageAction = rollbackAction;
export const schedulePublishAction = scheduleAction;
export const saveGlobalAction = saveGlobalsDraftAction;
