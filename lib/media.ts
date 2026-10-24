import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets, type MediaAsset } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { cacheDelete, cacheGet, cacheKeys, cacheSet } from "@/lib/cache";
import type { ResolvedMedia } from "@/lib/media/refs";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_DIR = process.env.MEDIA_DIR ?? path.join(process.cwd(), "data", "media");

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

  const key = `${siteId}/${checksum.slice(0, 16)}.${sniffed.ext}`;
  const destination = path.join(MEDIA_DIR, key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);

  const dimensions = kind === "image" ? probeDimensions(bytes, sniffed.mime) : { width: null, height: null };

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      siteId,
      kind,
      storageKey: key,
      publicUrl: `/media/${checksum.slice(0, 16)}.${sniffed.ext}`,
      mimeType: sniffed.mime,
      sizeBytes: bytes.length,
      width: dimensions.width,
      height: dimensions.height,
      checksum,
      originalUrl: options.originalUrl ?? null,
      altText: options.altText ?? options.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 160),
      status: "ready",
      uploadedBy: actor.user.id,
    })
    .returning();

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
    await unlink(path.join(MEDIA_DIR, asset.storageKey));
  } catch {
    /* the orphan sweep is the backstop */
  }
}

export async function readMediaFile(publicUrl: string): Promise<Buffer | null> {
  const name = publicUrl.replace(/^\/media\//, "");
  if (!/^[a-z0-9]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name)) return null;
  const files = await db.execute<{ storage_key: string }>(
    sql`select storage_key from media_asset where public_url = ${publicUrl} and status = 'ready' limit 1`,
  );
  const key = files.rows[0]?.storage_key;
  if (!key) return null;
  try {
    return await readFile(path.join(MEDIA_DIR, key));
  } catch {
    return null;
  }
}

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
