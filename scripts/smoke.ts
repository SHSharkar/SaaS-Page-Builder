import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, gte } from "drizzle-orm";
import { closeDb, db, ensureDb } from "@/lib/db";
import { accounts, pages, roles, users } from "@/lib/db/schema";
import {
  createPage,
  listPageVersions,
  publishPage,
  restorePage,
  rollbackToVersion,
  savePageDraft,
  softDeletePage,
  unpublishPage,
} from "@/lib/pages";
import {
  createSite,
  getSite,
  listDeletedSites,
  purgeSite,
  restoreSite,
  setSiteStatus,
} from "@/lib/sites";
import {
  getDefaultSeo,
  getPublishedGlobals,
  publishGlobals,
  saveDefaultSeo,
  saveGlobalsDraft,
} from "@/lib/globals";
import {
  MAX_UPLOAD_BYTES,
  confirmPresignedUpload,
  deleteMedia,
  findMediaReferences,
  listMedia,
  readMediaFile,
  requestMediaUpload,
  uploadMedia,
} from "@/lib/media";
import { defaultPropsFor } from "@/lib/registry";
import { applyImportJob, createImportJob } from "@/lib/importer";
import { instantiateTemplate, listTemplates } from "@/lib/templates";
import { addCustomDomain, verificationRecord, verifyDomain } from "@/lib/domains";
import { previewDailySweep, runDailySweep } from "@/lib/sweeper";
import { KEEP } from "@/lib/lifecycle";
import { ConflictError, LifecycleError } from "@/lib/errors";
import { storageBackend } from "@/lib/media/storage";
import {
  DOCUMENT_SCHEMA_VERSION,
  emptyDocument,
  newBlockId,
  type PageDocument,
} from "@/lib/documents";
import type { Actor } from "@/lib/auth/session";
import { permissionKeysForUser, rolesForUser } from "@/lib/auth/rbac";

let failures = 0;

function writeLine(line: string) {
  process.stdout.write(`${line}\n`);
}

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    writeLine(`  [PASS] ${label}`);
  } else {
    failures += 1;
    writeLine(`  [FAIL] ${label}${detail ? ` - ${detail}` : ""}`);
  }
}

async function main() {
  await ensureDb();
  const [user] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .where(and(eq(users.banned, false), gte(roles.rank, 100)))
    .limit(1)
    .then((rows) => rows.map((row) => row.user));

  if (!user) throw new Error("No active admin account available for smoke test.");

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
      impersonatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    roles: await rolesForUser(user.id),
    permissions: new Set(await permissionKeysForUser(user.id)),
    stepUpValid: true,
  };

  writeLine("\n* Access control");
  const grants = await permissionKeysForUser(user.id);
  check("Admin holds the full permission catalog", grants.length >= 40);

  const [editor] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(roles, eq(roles.key, users.role))
    .where(eq(roles.key, "editor"))
    .limit(1)
    .then((rows) => rows.map((row) => row.user));
  check("Editor account exists", Boolean(editor));
  if (editor) {
    const editorGrants = await permissionKeysForUser(editor.id);
    check("Editor can publish pages", editorGrants.includes("page.publish"));
    check("Editor cannot manage roles", !editorGrants.includes("role.manage"));
    check("Editor cannot manage platform settings", !editorGrants.includes("settings.manage"));
  }
  const [credential] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id))
    .limit(1);
  check(
    "Admin password lives in a Better Auth credential row",
    credential?.providerId === "credential",
  );

  writeLine("\n* Sites and pages");
  const siteSlug = `smoke-${Date.now().toString(36)}`;
  const site = await createSite({ name: "Smoke Test", slug: siteSlug, createdBy: user.id });

  const doc: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content: [
      {
        type: "hero",
        props: {
          ...defaultPropsFor("hero"),
          id: newBlockId("hero"),
          eyebrow: "Smoke",
          headline: "Hello smoke",
        },
      },
      {
        type: "faq",
        props: {
          ...defaultPropsFor("faq"),
          id: newBlockId("faq"),
        },
      },
    ],
  };

  const homePage = await createPage({
    siteId: site.id,
    title: "Smoke Home",
    isHomepage: true,
    document: doc,
    actor,
  });
  check("Homepage uses root path", homePage.slug === "/" && homePage.isHomepage);

  const page = await createPage({
    siteId: site.id,
    title: "Smoke Page",
    slug: "/smoke/page",
    document: doc,
    actor,
  });
  check("Nested slug is normalized", page.slug === "/smoke/page", page.slug);

  const draft = await savePageDraft({
    siteId: site.id,
    pageId: page.id,
    expectedLockVersion: page.lockVersion,
    document: doc,
    actor,
  });
  check("Draft save increments lock version", draft.lockVersion === page.lockVersion + 1);

  let staleRefused = false;
  try {
    await savePageDraft({
      siteId: site.id,
      pageId: page.id,
      expectedLockVersion: page.lockVersion,
      document: doc,
      actor,
    });
  } catch (err) {
    staleRefused = err instanceof ConflictError;
  }
  check("Stale draft save is refused with 409 Conflict", staleRefused);

  const firstPub = await publishPage(site.id, page.id, actor);
  check("First publish creates version 1", firstPub.version.versionNumber === 1);

  const secondPub = await publishPage(site.id, page.id, actor);
  check("Second publish creates version 2", secondPub.version.versionNumber === 2);

  const versions = await listPageVersions(page.id);
  check("Version history lists both versions", versions.length === 2);

  const firstVersion = versions.find((v) => v.versionNumber === 1)!;
  await rollbackToVersion(site.id, page.id, firstVersion.id, actor, true);
  const versionsAfterRollback = await listPageVersions(page.id);
  check("Rollback with republish creates version 3", versionsAfterRollback[0]?.versionNumber === 3);

  const unpublished = await unpublishPage(site.id, page.id, actor);
  check("Unpublish returns page to draft", unpublished.status === "draft");

  writeLine("\n* Globals");
  const navDoc: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content: [
      {
        type: "site-header",
        props: { ...defaultPropsFor("site-header"), id: newBlockId("site-header") },
      },
    ],
  };
  await saveGlobalsDraft(site.id, "navigation", navDoc, actor);
  await publishGlobals(site.id, "navigation", actor);
  const globals = await getPublishedGlobals(site.id);
  check("Navigation global is published", Boolean(globals.navigation));

  await saveDefaultSeo(site.id, { metaDescription: "Smoke default" }, actor);
  check("Default SEO round-trips", (await getDefaultSeo(site.id)).metaDescription === "Smoke default");

  writeLine("\n* Media");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  const uploaded = await uploadMedia({
    siteId: site.id,
    bytes: png,
    filename: "dot.png",
    mimeType: "image/png",
    actor,
  });
  check("Upload stores verified PNG", uploaded.asset.mimeType === "image/png");

  const withImage: PageDocument = {
    ...doc,
    content: [
      {
        type: "image",
        props: {
          ...defaultPropsFor("image"),
          id: newBlockId("image"),
          media: { id: uploaded.asset.id, alt: "Dot" },
        },
      },
    ],
  };
  await savePageDraft({
    siteId: site.id,
    pageId: page.id,
    expectedLockVersion: unpublished.lockVersion,
    document: withImage,
    actor,
  });
  const referenced = await findMediaReferences(site.id, uploaded.asset.id);
  check("Reference check finds page using image", referenced.length > 0);

  const again = await uploadMedia({
    siteId: site.id,
    bytes: png,
    filename: "copy.png",
    mimeType: "image/png",
    actor,
  });
  check(
    "Duplicate upload is deduplicated by SHA-256",
    again.deduplicated && again.asset.id === uploaded.asset.id,
  );
  check("Library lists one ready image", (await listMedia(site.id)).length === 1);

  let deleteBlocked = false;
  try {
    await deleteMedia(site.id, uploaded.asset.id, actor, false);
  } catch (err) {
    deleteBlocked = err instanceof ConflictError;
  }
  check("Referenced image deletion is blocked without force", deleteBlocked);

  const grant = await requestMediaUpload({
    siteId: site.id,
    filename: "stage.png",
    mimeType: "image/png",
    sizeBytes: png.length,
    actor,
  });
  check(
    "Upload request returns presigned or direct grant",
    storageBackend() === "s3" ? grant.mode === "presigned" : grant.mode === "direct",
  );
  if (grant.mode === "presigned") {
    let confirmFailed = false;
    try {
      await confirmPresignedUpload(site.id, grant.mediaId, actor);
    } catch {
      confirmFailed = true;
    }
    check("Unwritten presigned upload is rejected on confirm", confirmFailed);
  }

  let oversizeRefused = false;
  try {
    await requestMediaUpload({
      siteId: site.id,
      filename: "huge.png",
      mimeType: "image/png",
      sizeBytes: MAX_UPLOAD_BYTES + 1,
      actor,
    });
  } catch {
    oversizeRefused = true;
  }
  check("Oversize upload is refused before bytes move", oversizeRefused);

  const fileSlug = uploaded.asset.publicUrl.replace(/^\/media\//, "");
  const served = await readMediaFile(fileSlug);
  check("Stored bytes read back via media service", Boolean(served && served.bytes.length === png.length));

  writeLine("\n* Importer");
  const sampleHtml = await readFile(
    path.join(process.cwd(), "public", "seed", "sample-lander.html"),
    "utf8",
  );
  const job = await createImportJob({
    siteId: site.id,
    filename: "sample-lander.html",
    html: sampleHtml,
    actor,
  });
  check("HTML analyzer produced mapped segments", Boolean(job.report?.segments.length));
  const imported = await applyImportJob({
    siteId: site.id,
    jobId: job.id,
    decisions: (job.report?.segments ?? []).map((seg) => ({
      id: seg.id,
      decision: seg.suggestedType ? "accept" : "skip",
    })),
    pageTitle: "Imported Smoke Page",
    pageSlug: "/imported",
    actor,
  });
  check("Applying import creates a draft page", Boolean(imported.pageId));

  writeLine("\n* Templates");
  const tplList = await listTemplates(site.id);
  check("Curated templates exist", tplList.length >= 3);
  const instantiated = await instantiateTemplate(tplList[0].id);
  check("Instantiating template produces block tree", instantiated.content.length > 0);

  writeLine("\n* Domains");
  const domain = await addCustomDomain(site.id, `offers.${siteSlug}.example`, actor);
  check("Custom domain starts pending with TXT token", domain.status === "pending" && Boolean(domain.verificationToken));
  const txt = verificationRecord(domain.hostname, domain.verificationToken ?? "");
  check("TXT record uses _trofeo-pages prefix", txt.name.startsWith("_trofeo-pages."));
  const outcome = await verifyDomain(domain.id, actor);
  check("DNS check without live TXT stays non-active", outcome.status !== "active");

  writeLine("\n* Trash and lifecycle");
  await softDeletePage(site.id, page.id, actor);
  const [trashedRow] = await db.select().from(pages).where(eq(pages.id, page.id));
  check("Soft delete moves page to deleted status", trashedRow.status === "deleted");
  let publishDeletedRefused = false;
  try {
    await publishPage(site.id, page.id, actor);
  } catch (err) {
    publishDeletedRefused = err instanceof LifecycleError || err instanceof Error;
  }
  check("Publishing a deleted page is refused", publishDeletedRefused);
  const restored = await restorePage(site.id, page.id, actor);
  check("Restoring returns page to draft", restored.status === "draft");

  writeLine("\n* Sweeper and site purge");
  await previewDailySweep();
  await runDailySweep();
  check("Version keep cap matches 50 per page", KEEP.pageVersionsPerPage === 50);

  const doomed = await createSite({
    name: "Doomed",
    slug: `${siteSlug}-doomed`,
    createdBy: user.id,
  });
  await setSiteStatus(doomed.id, "deleted");
  check(
    "Deleted site appears in restore list",
    (await listDeletedSites()).some((row) => row.site.id === doomed.id),
  );
  const broughtBack = await restoreSite(doomed.id);
  check("Deleted site restores to active", broughtBack.status === "active" && broughtBack.deletedAt === null);

  let livePurgeRefused = false;
  try {
    await purgeSite(doomed.id, actor);
  } catch {
    livePurgeRefused = true;
  }
  check("Live site cannot be purged", livePurgeRefused);

  await setSiteStatus(doomed.id, "deleted");
  await purgeSite(doomed.id, actor);
  check("Deleted site is permanently purged", (await getSite(doomed.id)) === null);

  await setSiteStatus(site.id, "deleted");
  await purgeSite(site.id, actor);

  check("Empty document has schemaVersion 1", emptyDocument().schemaVersion === 1);

  writeLine(`\n${failures === 0 ? "All smoke checks passed." : `${failures} check(s) failed.`}`);
  await closeDb();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
