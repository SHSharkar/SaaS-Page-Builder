"use server";

import type { PageDocument, PageSeo } from "@/lib/documents";
import { accountRoleHasCapability } from "@/app/server/capabilities";
import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import {
  createSitePage,
  publishSitePage,
  rollbackPageToVersion,
  savePageDraft,
  schedulePagePublish,
} from "./index";

export async function createPageAction(input: {
  siteId: string;
  title: string;
  slug: string;
}): Promise<{ ok: boolean; pageId: string }> {
  const actor = await requireAccountCapability("pages.edit");
  const page = await createSitePage({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    title: input.title,
    slug: input.slug,
  });
  await publishAccountChange(actor.account.id, "page.created", [page.id]);
  return { ok: true, pageId: page.id };
}

export async function saveDraftAction(input: {
  siteId: string;
  pageId: string;
  expectedLockVersion: number;
  title: string;
  document: PageDocument;
  seo?: PageSeo;
}): Promise<{ ok: boolean; lockVersion: number }> {
  const actor = await requireAccountCapability("pages.edit");
  const updated = await savePageDraft({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    allowAdminBlocks: accountRoleHasCapability(
      actor.accountRole,
      "catalog.admin_blocks",
    ),
    siteId: input.siteId,
    pageId: input.pageId,
    expectedLockVersion: input.expectedLockVersion,
    title: input.title,
    document: input.document,
    seo: input.seo,
  });
  await publishAccountChange(actor.account.id, "page.updated", [updated.id]);
  return { ok: true, lockVersion: updated.lockVersion };
}

export async function publishPageAction(input: {
  siteId: string;
  pageId: string;
  note?: string;
}): Promise<{ ok: boolean; versionId: string; versionNumber: number }> {
  const actor = await requireAccountCapability("pages.publish");
  const version = await publishSitePage({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    pageId: input.pageId,
    note: input.note,
  });
  await publishAccountChange(actor.account.id, "page.published", [
    input.pageId,
    version.id,
  ]);
  return {
    ok: true,
    versionId: version.id,
    versionNumber: version.versionNumber,
  };
}

export async function rollbackPageAction(input: {
  siteId: string;
  pageId: string;
  versionId: string;
}): Promise<{ ok: boolean; versionId: string }> {
  const actor = await requireAccountCapability("pages.publish");
  const version = await rollbackPageToVersion({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    siteId: input.siteId,
    pageId: input.pageId,
    versionId: input.versionId,
  });
  await publishAccountChange(actor.account.id, "page.rolled_back", [
    input.pageId,
    version.id,
  ]);
  return { ok: true, versionId: version.id };
}

export async function schedulePageAction(input: {
  siteId: string;
  pageId: string;
  publishAt: string | null;
  unpublishAt: string | null;
}): Promise<{ ok: boolean }> {
  const actor = await requireAccountCapability("pages.publish");
  await schedulePagePublish({
    accountId: actor.account.id,
    siteId: input.siteId,
    pageId: input.pageId,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    unpublishAt: input.unpublishAt ? new Date(input.unpublishAt) : null,
  });
  await publishAccountChange(actor.account.id, "page.scheduled", [
    input.pageId,
  ]);
  return { ok: true };
}
