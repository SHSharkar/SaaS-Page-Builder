import { and, desc, eq, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets, type MediaAsset } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheDelete, cacheGet, cacheKeys, cacheSet } from "@/lib/cache";
import type { ResolvedMedia } from "@/lib/media/refs";
import { deleteObject, getObject, headObject, presignPut, publicUrlFor, putObject, storageBackend } from "@/lib/media/storage";
import { assertTransition, hoursAgo, KEEP } from "@/lib/lifecycle";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export { MEDIA_DIR } from "@/lib/media/storage";

const SIGNATURES: { mime: string; ext: string; test: (bytes: Buffer) => boolean }[] = [
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "image/gif", ext: "gif", test: (b) => b.subarray(0, 3).toString() === "GIF" },
  { mime: "image/svg+xml", ext: "svg", test: (b) => b.subarray(0, 200).toString().includes("<svg") },
  { mime: "text/html", ext: "html", test: (b) => /^\s*<(!doctype|html)/i.test(b.subarray(0, 200).toString()) },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 4).toString() === "%PDF" },
];

export function sniffMime(bytes: Buffer): { mime: string; ext: string } | null {
  return SIGNATURES.find((signature) => signature.test(bytes)) ?? null;
}

/** Minimal dimension probe: enough for width/height attributes, no image library. */
export function probeDimensions(bytes: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === "image/png" && bytes.length > 24) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (mime === "image/gif") {
      return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
    }
    if (mime === "image/webp" && bytes.subarray(12, 16).toString() === "VP8X") {
      const width = 1 + ((bytes[24] << 16) | (bytes[25] << 8) | bytes[26]);
      const height = 1 + ((bytes[27] << 16) | (bytes[28] << 8) | bytes[29]);
      return { width, height };
    }
    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset < bytes.length - 9) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1];
        const length = bytes.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    /* malformed header: keep nulls */
  }
  return { width: null, height: null };
}

export async function listMedia(siteId: string): Promise<MediaAsset[]> {
  await ensureDb();
  return db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.status, "ready")))
    .orderBy(desc(mediaAssets.createdAt));
}

export async function getMedia(siteId: string, mediaId: string): Promise<MediaAsset | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.siteId, siteId), eq(mediaAssets.status, "ready")))
    .limit(1);
  return row ?? null;
}

export async function getMediaById(mediaId: string): Promise<MediaAsset | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.status, "ready")))
    .limit(1);
  return row ?? null;
}

/** Resolved map handed to the renderer and the editor (ADR-004). */
export async function mediaMapFor(siteId: string): Promise<Map<string, ResolvedMedia>> {
  await ensureDb();
  const cacheKey = `media:${siteId}`;
  type MediaRow = { id: string; publicUrl: string; altText: string | null; width: number | null; height: number | null };
  const cached = cacheGet<MediaRow[]>(cacheKey);
  const rows =
    cached ??
    (await db
      .select({
        id: mediaAssets.id,
        publicUrl: mediaAssets.publicUrl,
        altText: mediaAssets.altText,
        width: mediaAssets.width,
        height: mediaAssets.height,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.status, "ready"))));
  if (!cached) cacheSet(cacheKey, rows, 60_000);
  return new Map(
    rows.map((row) => [
      row.id,
      { id: row.id, url: row.publicUrl, alt: row.altText ?? undefined, width: row.width, height: row.height },
    ]),
  );
}

export type UploadResult = {
  asset: MediaAsset;
  deduplicated: boolean;
};

/**
 * The direct-upload half of the media lifecycle: the row is created `pending`,
 * the bytes land in storage, they are read back and verified, and only then
 * does the row become `ready`. A pending row that never confirms is swept.
 */
export async function beginUpload(options: {
  siteId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  actor: Actor;
  kind?: "image" | "file" | "import_reference";
  altText?: string;
}): Promise<{ mediaId: string; uploadUrl: string | null; headers: Record<string, string>; storageKey: string }> {
  await ensureDb();
  if (options.sizeBytes > MAX_IMAGE_BYTES) throw new Error("Files are capped at 5 MB.");
  const ext = extensionFor(options.contentType);
  if (!ext) throw new Error("That file type is not accepted. Use PNG, JPEG, WebP, GIF or SVG.");

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const key = `${options.siteId}/pending-${token}.${ext}`;
  const [row] = await db
    .insert(mediaAssets)
    .values({
      siteId: options.siteId,
      kind: options.kind ?? (options.contentType.startsWith("image/") ? "image" : "file"),
      storageKey: key,
      publicUrl: publicUrlFor(key),
      mimeType: options.contentType,
      sizeBytes: options.sizeBytes,
      // A pending row has no checksum yet: it is assigned when bytes verify.
      checksum: `pending:${token}`,
      altText: options.altText ?? options.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 160),
      status: "pending",
      uploadedBy: options.actor.user.id,
    })
    .returning();

  const presigned = await presignPut(key, options.contentType);
  return {
    mediaId: row.id,
    uploadUrl: presigned?.url ?? null,
    headers: presigned?.headers ?? { "Content-Type": options.contentType },
    storageKey: key,
  };
}

/** Re-reads the stored bytes and only then flips pending → ready. */
export async function confirmUpload(options: {
  siteId: string;
  mediaId: string;
  actor: Actor;
  expectedChecksum?: string;
}): Promise<MediaAsset> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, options.mediaId), eq(mediaAssets.siteId, options.siteId)))
    .limit(1);
  if (!row) throw new Error("That upload does not exist.");
  assertTransition("media", row.status, "ready");

  const head = await headObject(row.storageKey);
  if (!head) throw new Error("The file was never written to storage. Upload it again.");

  const bytes = await getObject(row.storageKey);
  if (!bytes) throw new Error("The file could not be read back for verification.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Files are capped at 5 MB.");
  const sniffed = sniffMime(bytes);
  if (!sniffed || sniffed.mime !== row.mimeType) {
    await markMediaDeleted(row.id);
    throw new Error("The uploaded bytes are not the file type that was declared.");
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (options.expectedChecksum && options.expectedChecksum !== checksum) {
    await markMediaDeleted(row.id);
    throw new Error("The checksum did not match the uploaded file.");
  }

  // Deduplicate after the bytes exist: the same image uploaded twice keeps one row.
  const [duplicate] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.siteId, row.siteId), eq(mediaAssets.checksum, checksum), eq(mediaAssets.status, "ready")))
    .limit(1);
  if (duplicate) {
    await markMediaDeleted(row.id);
    return duplicate;
  }

  const dimensions = row.kind === "image" ? probeDimensions(bytes, sniffed.mime) : { width: null, height: null };
  const finalKey = `${row.siteId}/${checksum.slice(0, 16)}.${sniffed.ext}`;
  if (finalKey !== row.storageKey) await putObject(finalKey, bytes, sniffed.mime);

  const [updated] = await db
    .update(mediaAssets)
    .set({
      status: "ready",
      storageKey: finalKey,
      publicUrl: publicUrlFor(finalKey),
      checksum,
      sizeBytes: bytes.length,
      width: dimensions.width,
      height: dimensions.height,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, row.id))
    .returning();

  if (finalKey !== row.storageKey) await deleteObject(row.storageKey);
  cacheDelete(`media:${row.siteId}`);
  await recordAudit({
    action: "media_confirmed",
    summary: `Confirmed upload “${row.altText ?? finalKey}” (${Math.round(bytes.length / 1024)} KB)`,
    siteId: row.siteId,
    actor: options.actor,
    targetType: "media_asset",
    targetId: row.id,
  });
  return updated;
}

export async function uploadMedia(options: {
  siteId: string;
  bytes: Buffer;
  filename: string;
  actor: Actor;
  kind?: "image" | "file" | "import_reference";
  altText?: string;
  originalUrl?: string;
}): Promise<UploadResult> {
  await ensureDb();
  const { siteId, bytes, actor } = options;
  if (bytes.length === 0) throw new Error("That file is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Files are capped at 5 MB.");

  const sniffed = sniffMime(bytes);
  if (!sniffed) throw new Error("That file type is not accepted. Use PNG, JPEG, WebP, GIF or SVG.");
  const kind = options.kind ?? (sniffed.mime.startsWith("image/") ? "image" : "file");
  if (kind === "image" && !sniffed.mime.startsWith("image/")) {
    throw new Error("Images must be PNG, JPEG, WebP, GIF or SVG.");
  }

  const checksum = createHash("sha256").update(bytes).digest("hex");

  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.checksum, checksum), eq(mediaAssets.status, "ready")))
    .limit(1);
  if (existing) return { asset: existing, deduplicated: true };

  // Stage 1: the row exists but is not usable yet.
  const key = `${siteId}/pending-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}.${sniffed.ext}`;
  const [pending] = await db
    .insert(mediaAssets)
    .values({
      siteId,
      kind,
      storageKey: key,
      publicUrl: publicUrlFor(key),
      mimeType: sniffed.mime,
      sizeBytes: bytes.length,
      checksum: `pending:${key}`,
      originalUrl: options.originalUrl ?? null,
      altText: options.altText ?? options.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 160),
      status: "pending",
      uploadedBy: actor.user.id,
    })
    .returning();

  // Stage 2: bytes land in storage.
  await putObject(key, bytes, sniffed.mime);

  // Stage 3: verification, then pending → ready with the final content-hashed key.
  const finalKey = `${siteId}/${checksum.slice(0, 16)}.${sniffed.ext}`;
  const dimensions = kind === "image" ? probeDimensions(bytes, sniffed.mime) : { width: null, height: null };
  const [asset] = await db
    .update(mediaAssets)
    .set({
      status: "ready",
      storageKey: finalKey,
      publicUrl: publicUrlFor(finalKey),
      checksum,
      width: dimensions.width,
      height: dimensions.height,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, pending.id))
    .returning();
  if (finalKey !== key) {
    await putObject(finalKey, bytes, sniffed.mime);
    await deleteObject(key);
  }

  cacheDelete(`media:${siteId}`);
  await recordAudit({
    action: "media_uploaded",
    summary: `Uploaded “${options.filename}” (${Math.round(bytes.length / 1024)} KB)`,
    siteId,
    actor,
    targetType: "media_asset",
    targetId: asset.id,
  });

  return { asset, deduplicated: false };
}

function extensionFor(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "text/html": "html",
    "application/pdf": "pdf",
  };
  return map[contentType] ?? null;
}

async function markMediaDeleted(mediaId: string): Promise<void> {
  await db
    .update(mediaAssets)
    .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaAssets.id, mediaId));
}

/** The sweeper for pending rows: an upload that never confirmed never becomes visible. */
export async function sweepPendingMedia(): Promise<number> {
  await ensureDb();
  const stale = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.status, "pending"), lte(mediaAssets.createdAt, hoursAgo(KEEP.pendingMediaHours))));
  for (const row of stale) {
    await deleteObject(row.storageKey);
    await markMediaDeleted(row.id);
  }
  return stale.length;
}

export type MediaReference = { pageId: string | null; pageTitle: string };

/**
 * The reference check (FR-015). Documents store media identifiers, so the
 * check is exact: a jsonpath recursive descent finds any object carrying the
 * identifier in a draft, a snapshot, global content or a staff template.
 */
export async function findMediaReferences(siteId: string, mediaId: string): Promise<MediaReference[]> {
  await ensureDb();
  const jsonpath = `$.** ? (@.id == $mediaId)`;
  const params = JSON.stringify({ mediaId });

  const draftRefs = await db.execute<{ id: string; title: string }>(sql`
    select id, title from page
    where site_id = ${siteId}
      and deleted_at is null
      and draft_document is not null
      and jsonb_path_exists(draft_document, ${jsonpath}::jsonpath, ${params}::jsonb)
  `);
  const versionRefs = await db.execute<{ id: string; title: string }>(sql`
    select p.id, p.title from page p
    join page_version v on v.page_id = p.id
    where p.site_id = ${siteId}
      and jsonb_path_exists(v.document, ${jsonpath}::jsonpath, ${params}::jsonb)
  `);
  const contentRefs = await db.execute<{ id: string; title: string }>(sql`
    select id, kind::text as title from site_content
    where site_id = ${siteId}
      and (
        jsonb_path_exists(draft_document, ${jsonpath}::jsonpath, ${params}::jsonb)
        or jsonb_path_exists(published_document, ${jsonpath}::jsonpath, ${params}::jsonb)
      )
  `);

  const seen = new Map<string, MediaReference>();
  for (const row of [...draftRefs.rows, ...versionRefs.rows]) {
    if (!seen.has(row.id)) seen.set(row.id, { pageId: row.id, pageTitle: row.title });
  }
  for (const row of contentRefs.rows) {
    seen.set(`content:${row.id}`, { pageId: null, pageTitle: `Site ${row.title}` });
  }
  return [...seen.values()];
}

export async function deleteMedia(siteId: string, mediaId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const asset = await getMedia(siteId, mediaId);
  if (!asset) throw new Error("That image does not exist.");

  const references = await findMediaReferences(siteId, mediaId);
  if (references.length) {
    await recordAudit({
      action: "media_delete_blocked",
      summary: `Refused to delete “${asset.altText ?? asset.storageKey}”: ${references.length} page(s) still use it`,
      siteId,
      actor,
      targetType: "media_asset",
      targetId: mediaId,
    });
    const names = references.map((reference) => reference.pageTitle).slice(0, 3).join(", ");
    throw new Error(
      `This image is still used by ${references.length} page${references.length === 1 ? "" : "s"} (${names}). Remove it there first.`,
    );
  }

  await db
    .update(mediaAssets)
    .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaAssets.id, mediaId));
  cacheDelete(`media:${siteId}`);
  await recordAudit({
    action: "media_deleted",
    summary: `Deleted “${asset.altText ?? asset.storageKey}”`,
    siteId,
    actor,
    targetType: "media_asset",
    targetId: mediaId,
  });
  // File removal happens after the row is marked, sweepable if it fails.
  try {
    await deleteObject(asset.storageKey);
  } catch {
    /* the orphan sweep is the backstop */
  }
}

export async function readMediaFile(publicUrl: string): Promise<Buffer | null> {
  const name = publicUrl.replace(/^\/media\//, "");
  if (!/^[a-z0-9]+\.(png|jpg|jpeg|webp|gif|svg|html)$/i.test(name)) return null;
  const files = await db.execute<{ storage_key: string }>(
    sql`select storage_key from media_asset where public_url = ${publicUrl} and status = 'ready' limit 1`,
  );
  const key = files.rows[0]?.storage_key;
  if (!key) return null;
  return getObject(key);
}

export { storageBackend };

export async function ingestSeedImage(options: {
  siteId: string;
  filename: string;
  sourcePath: string;
  actor: Actor;
  altText: string;
}): Promise<MediaAsset> {
  const bytes = await readFile(options.sourcePath);
  const result = await uploadMedia({
    siteId: options.siteId,
    bytes,
    filename: options.filename,
    actor: options.actor,
    altText: options.altText,
  });
  return result.asset;
}
