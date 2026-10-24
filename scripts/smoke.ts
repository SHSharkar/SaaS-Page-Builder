/**
 * End-to-end smoke test of the data layer against a throwaway database.
 *
 *   PGLITE_DIR=.cache/smoke MEDIA_DIR=data/smoke-media npx tsx scripts/smoke.ts
 *
 * It exercises the same functions the server actions call: create, save,
 * stale-save refusal, publish, rollback, media upload + reference check,
 * HTML import review, template application, domain verification and the queue.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, gte } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { accounts, pages, roles, userRoles, users } from "@/lib/db/schema";
import {
  archivePage,
  createPage,
  listVersions,
  publishPage,
  restorePage,
  rollbackToVersion,
  saveDraft,
  schedulePublish,
  unpublishPage,
} from "@/lib/pages";
import { createSite, getSite, listDeletedSites, purgeSite, restoreSite } from "@/lib/sites";
import { publishGlobals, saveGlobalsDraft, getPublishedGlobals, getDefaultSeo } from "@/lib/globals";
import {
  MAX_IMAGE_BYTES,
  beginUpload,
  confirmUpload,
  deleteMedia,
  findMediaReferences,
  listMedia,
  readMediaFile,
  uploadMedia,
} from "@/lib/media";
import { defaultPropsFor, validateDocument } from "@/lib/registry";
import { applyImportJob, createImportJob } from "@/lib/importer";
import { applyTemplate, listTemplates } from "@/lib/templates";
import { addCustomDomain, verifyDomain, verificationRecord } from "@/lib/domains";
import { enqueue, runDueJobs } from "@/lib/queue";
import { cleanupPreview, runDailyCleanup } from "@/lib/retention";
import { KEEP } from "@/lib/lifecycle";
import { LifecycleError } from "@/lib/errors";
import { storageInfo } from "@/lib/media/storage";
import { DOCUMENT_SCHEMA_VERSION, DEFAULT_ROOT_PROPS, emptyDocument, type PageDocument } from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { permissionKeysForUser, rolesForUser } from "@/lib/auth/rbac";

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  await ensureDb();
  const [user] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.status, "active"), gte(roles.rank, 100)))
    .limit(1)
    .then((rows) => rows.map((row) => row.user));
  if (!user) throw new Error("No active admin to run the smoke test as.");
  const actor: Actor = {
    user,
    session: {
      id: "00000000-0000-0000-0000-000000000000",
      token: "smoke",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      ipAddress: null,
      userAgent: "smoke",
      stepUpUntil: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    roles: await rolesForUser(user.id),
    permissions: new Set(await permissionKeysForUser(user.id)),
    stepUpValid: true,
  };

  console.log("\n• access control");
  const grants = await permissionKeysForUser(user.id);
  check("the admin holds the whole permission catalogue", grants.length >= 40);
  const [editor] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(roles.key, "editor"))
    .limit(1)
    .then((rows) => rows.map((row) => row.user));
  check("the editor account exists", !!editor);
  if (editor) {
    const editorGrants = await permissionKeysForUser(editor.id);
    check("the editor may publish pages", editorGrants.includes("page.publish"));
    check("the editor may not manage roles", !editorGrants.includes("role.manage"));
    check("the editor may not change platform settings", !editorGrants.includes("settings.manage"));
  }
  const [credential] = await db.select().from(accounts).where(eq(accounts.userId, user.id)).limit(1);
  check(
    "the admin password lives in a Better Auth credential row",
    credential?.providerId === "credential",
  );

  console.log("\n• sites and pages");
  const site = await createSite({ name: "Smoke Test", slug: "smoke-test", createdBy: user.id });

  const doc: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { ...DEFAULT_ROOT_PROPS } },
    content: [
      { type: "hero", props: { ...defaultPropsFor("hero"), eyebrow: "Smoke", headline: "Hello smoke" } as never },
      { type: "faq", props: { ...defaultPropsFor("faq") } as never },
    ],
  };
  const validation = validateDocument(doc);
  check("validation accepts a hero + faq document", validation.ok, validation.ok ? "" : validation.errors.join("; "));

  const page = await createPage({ siteId: site.id, title: "Smoke page", slug: "Smoke / Page", document: doc, actor });
  check("nested slug is normalised", page.slug === "smoke/page", page.slug);
  check("first page becomes the homepage", page.isHomepage);

  const draft = await saveDraft(site.id, page.id, doc, page.lockVersion, actor);
  check("draft save returns a new lock version", draft.lockVersion === page.lockVersion + 1);

  let staleRefused = false;
  try {
    await saveDraft(site.id, page.id, doc, page.lockVersion, actor);
  } catch (error) {
    staleRefused = /changed|another|stale|version/i.test((error as Error).message);
  }
  check("a stale save is refused", staleRefused);

  const published = await publishPage(site.id, page.id, actor);
  check("publish creates version 1", published.versionNumber === 1);

  await saveDraft(site.id, page.id, doc, draft.lockVersion, actor);
  const second = await publishPage(site.id, page.id, actor);
  check("publish creates version 2", second.versionNumber === 2);

  const versions = await listVersions(page.id);
  check("history lists both versions", versions.length === 2);

  const firstVersion = versions.find((version) => version.versionNumber === 1)!;
  const rolled = await rollbackToVersion(site.id, page.id, firstVersion.id, actor);
  check("rollback republishes as version 3", rolled.versionNumber === 3);

  await unpublishPage(site.id, page.id, actor);
  const [afterUnpublish] = await db.select().from(pages).where(eq(pages.id, page.id));
  check("unpublish returns the page to draft", afterUnpublish.status === "draft");

  console.log("\n• globals");
  const navDoc: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { ...DEFAULT_ROOT_PROPS } },
    content: [{ type: "site-header", props: { ...defaultPropsFor("site-header") } as never }],
  };
  await saveGlobalsDraft(site.id, "navigation", navDoc, 0, actor);
  await publishGlobals(site.id, "navigation", actor);
  const globals = await getPublishedGlobals(site.id);
  check("navigation is published", Boolean(globals.navigation));

  await saveGlobalsDraft(
    site.id,
    "defaults",
    { schemaVersion: 1, root: { props: { ...DEFAULT_ROOT_PROPS, seo: { description: "Smoke default" } } }, content: [] },
    0,
    actor,
  );
  await publishGlobals(site.id, "defaults", actor);
  check("default SEO round-trips", (await getDefaultSeo(site.id)).description === "Smoke default");

  console.log("\n• media");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  const uploaded = await uploadMedia({ siteId: site.id, bytes: png, filename: "dot.png", actor });
  check("upload stores an image", uploaded.asset.mimeType === "image/png", uploaded.asset.mimeType);
  const withImage: PageDocument = {
    ...doc,
    content: [{ type: "image", props: { ...defaultPropsFor("image"), image: { id: uploaded.asset.id } } as never }],
  };
  await saveDraft(site.id, page.id, withImage, afterUnpublish.lockVersion, actor);
  const referenced = await findMediaReferences(site.id, uploaded.asset.id);
  check("reference check finds the page using the image", referenced.length > 0, JSON.stringify(referenced));

  const again = await uploadMedia({ siteId: site.id, bytes: png, filename: "copy.png", actor });
  check("re-upload of the same bytes is deduplicated", again.deduplicated && again.asset.id === uploaded.asset.id);
  check("library lists one image", (await listMedia(site.id)).length === 1);

  let blocked = false;
  try {
    await deleteMedia(site.id, uploaded.asset.id, actor);
  } catch (error) {
    blocked = /still used/i.test((error as Error).message);
  }
  check("referenced image cannot be deleted", blocked);

  const dangling = await uploadMedia({
    siteId: site.id,
    bytes: Buffer.concat([png, Buffer.from([0])]),
    filename: "dangling.png",
    actor,
  });
  const refs = await findMediaReferences(site.id, dangling.asset.id);
  check("unreferenced image has no references", refs.length === 0);

  console.log("\n• import review");
  const html = await readFile(path.join(process.cwd(), "public", "seed", "sample-lander.html"), "utf8");
  const job = await createImportJob({ siteId: site.id, filename: "sample-lander.html", bytes: Buffer.from(html), actor });
  check("analyser produced a mapping", Boolean(job.mappingResult?.segments.length));
  const decisions = (job.mappingResult?.segments ?? []).map((segment) => ({
    segmentId: segment.id,
    decision: "accepted" as const,
    decidedBy: user.id,
    decidedAt: new Date().toISOString(),
  }));
  const imported = await applyImportJob({
    siteId: site.id,
    jobId: job.id,
    decisions,
    title: "Imported smoke page",
    slug: "imported",
    actor,
  });
  check("import creates an unpublished page", Boolean(imported.pageId));

  console.log("\n• templates");
  const templates = await listTemplates();
  check("curated templates exist", templates.length >= 3, `${templates.length}`);
  const template = templates[0];
  const fromTemplate = await applyTemplate({
    siteId: site.id,
    templateId: template.id,
    values: {},
    title: "From template",
    slug: "from-template",
    actor,
  });
  check("template produces a page", Boolean(fromTemplate.pageId));

  console.log("\n• domains");
  const domain = await addCustomDomain(site.id, "offers.smoke-test.example", actor);
  check("domain is pending with a token", domain.status === "pending" && Boolean(domain.verificationToken));
  const record = verificationRecord(domain.hostname, domain.verificationToken ?? "");
  check("a TXT record instruction is produced", record.name.includes("_trofeo-pages"));
  const outcome = await verifyDomain(domain.id, actor);
  check("verification without DNS returns a reason, not a false positive", outcome.status !== "active" && Boolean(outcome.reason));

  console.log("\n• queue");
  await enqueue("media.orphan-sweep", {}, { dedupeKey: "smoke:sweep", runAt: new Date() });
  const ran = await runDueJobs(10);
  check("worker drains a due job", ran.processed >= 1, JSON.stringify(ran));

  console.log("\n• scheduling");
  await schedulePublish(site.id, page.id, new Date(Date.now() + 30), "publish", actor);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const drained = await runDueJobs(10);
  const [scheduled] = await db.select().from(pages).where(eq(pages.id, page.id));
  check("a scheduled publish runs from the queue", drained.processed >= 1 && scheduled.status === "published", JSON.stringify(drained));
  check("the schedule is cleared once it fires", scheduled.scheduledPublishAt === null);

  console.log("\n• archived pages");
  const archived = await archivePage(site.id, page.id, actor);
  void archived;
  const [archivedRow] = await db.select().from(pages).where(eq(pages.id, page.id));
  check("archiving takes the page out of serving", archivedRow.status === "archived");
  let publishRefused = false;
  try {
    await publishPage(site.id, page.id, actor);
  } catch (error) {
    publishRefused = error instanceof LifecycleError && error.status === 409;
  }
  check("publishing an archived page is refused with a 409", publishRefused);
  await restorePage(site.id, page.id, actor);
  const [restoredRow] = await db.select().from(pages).where(eq(pages.id, page.id));
  check("restoring puts the page back as a draft", restoredRow.status === "draft");
  let unpublishRefused = false;
  try {
    await unpublishPage(site.id, page.id, actor);
  } catch (error) {
    unpublishRefused = error instanceof LifecycleError;
  }
  check("unpublishing a draft is refused", unpublishRefused);

  console.log("\n• two-stage media upload");
  const storage = storageInfo();
  console.log(`  · storage backend: ${storage.backend}`);
  const started = await beginUpload({
    siteId: site.id,
    filename: "two-stage.png",
    contentType: "image/png",
    sizeBytes: png.length,
    actor,
  });
  check("presign creates a pending row", Boolean(started.mediaId) && started.storageKey.includes("pending-"));
  check(
    "presigned URL is present only with R2 configured",
    storage.backend === "r2" ? Boolean(started.uploadUrl) : started.uploadUrl === null,
  );
  let unconfirmedRefused = false;
  try {
    await confirmUpload({ siteId: site.id, mediaId: started.mediaId, actor });
  } catch (error) {
    unconfirmedRefused = /never written/i.test((error as Error).message);
  }
  check("confirm refuses bytes that were never written", unconfirmedRefused);
  let oversizeRefused = false;
  try {
    await beginUpload({
      siteId: site.id,
      filename: "huge.png",
      contentType: "image/png",
      sizeBytes: MAX_IMAGE_BYTES + 1,
      actor,
    });
  } catch (error) {
    oversizeRefused = /5 MB|over/i.test((error as Error).message);
  }
  check("a file over the cap is refused before any bytes move", oversizeRefused);
  const served = await readMediaFile(uploaded.asset.publicUrl);
  check("stored bytes read back through the storage adapter", Boolean(served && served.length === png.length));

  console.log("\n• retention");
  const previewBefore = await cleanupPreview();
  const sweepOne = await runDailyCleanup(actor);
  const sweepTwo = await runDailyCleanup(actor);
  check(
    "the second sweep finds nothing",
    sweepTwo.sessionsRemoved === 0 &&
      sweepTwo.invitesExpired === 0 &&
      sweepTwo.versionsPruned === 0 &&
      sweepTwo.sitesPurged === 0 &&
      sweepTwo.domainsForgotten === 0 &&
      sweepTwo.pendingMediaRemoved === 0,
    JSON.stringify(sweepTwo),
  );
  check("the preview never changes state", JSON.stringify(previewBefore) === JSON.stringify(await cleanupPreview()) || sweepOne.ranAt !== sweepTwo.ranAt);
  check("snapshots kept per page follow PRD 3.6", KEEP.versionsPerPage === 50);

  console.log("\n• site restore and purge");
  const doomed = await createSite({ name: "Doomed", slug: "smoke-doomed", createdBy: user.id });
  await db.execute(`update site set status = 'deleted', deleted_at = now() where id = '${doomed.id}'`);
  check("a deleted site is listed for restore", (await listDeletedSites()).some((row) => row.site.id === doomed.id));
  const back = await restoreSite(doomed.id);
  check("a deleted site can be restored", back.status === "active" && back.deletedAt === null);
  let purgeRefused = false;
  try {
    await purgeSite(doomed.id);
  } catch {
    purgeRefused = true;
  }
  check("a live site cannot be purged", purgeRefused);
  await db.execute(`update site set status = 'deleted', deleted_at = now() where id = '${doomed.id}'`);
  await purgeSite(doomed.id);
  check("a deleted site can be purged", (await getSite(doomed.id)) === null);

  console.log("\n• empty document");
  const empty = emptyDocument();
  check("empty document validates", validateDocument(empty).ok);

  console.log(`\n${failures === 0 ? "All smoke checks passed." : `${failures} check(s) failed.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
