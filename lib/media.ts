import "server-only";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  mediaAssets,
  mediaReferences,
  pages,
  pageVersions,
  siteContents,
  sites,
  type MediaAsset,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { getSettingNumber } from "@/lib/settings";
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from "@/lib/errors";
import {
  deleteObject,
  getObject,
  headObject,
  presignPut,
  publicUrlFor,
  putObject,
  storageBackend,
} from "@/lib/media/storage";
import { collectMediaIds, type ResolvedMedia } from "@/lib/media/refs";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = MAX_UPLOAD_BYTES;
export const PRESIGN_TTL_SECONDS = 300;

export const ALLOWED_MIME: Record<
  string,
  { ext: string; kind: "image" | "document" | "import_reference" }
> = {
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/avif": { ext: "avif", kind: "image" },
  "image/svg+xml": { ext: "svg", kind: "image" },
  "application/pdf": { ext: "pdf", kind: "document" },
  "text/html": { ext: "html", kind: "import_reference" },
};

export function sniffMime(
  buffer: Buffer,
  declaredMime = "",
): { mime: string; ext: string; kind: MediaAsset["kind"] } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ...ALLOWED_MIME["image/png"] };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ...ALLOWED_MIME["image/jpeg"] };
  }
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return { mime: "image/gif", ...ALLOWED_MIME["image/gif"] };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ...ALLOWED_MIME["image/webp"] };
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.subarray(8, 12).toString("ascii").startsWith("avi")) {
    return { mime: "image/avif", ...ALLOWED_MIME["image/avif"] };
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mime: "application/pdf", ...ALLOWED_MIME["application/pdf"] };
  }
  const head = buffer.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return { mime: "image/svg+xml", ...ALLOWED_MIME["image/svg+xml"] };
  }
  if (declaredMime === "text/html" && (head.startsWith("<") || head.length > 0)) {
    return { mime: "text/html", ...ALLOWED_MIME["text/html"] };
  }
  return null;
}

export function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(xlink:href|href)\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
}

export function probeDimensions(
  buffer: Buffer,
  mime: string,
): { width: number | null; height: number | null } {
  try {
    if (mime === "image/png" && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
    if (mime === "image/gif" && buffer.length >= 10) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      if (width > 0 && height > 0) return { width, height };
    }
    if (mime === "image/jpeg" && buffer.length >= 4) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }
    if (mime === "image/webp" && buffer.length >= 30) {
      const chunk = buffer.subarray(12, 16).toString("ascii");
      if (chunk === "VP8X") {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {
    return { width: null, height: null };
  }
  return { width: null, height: null };
}

function buildFinalKey(siteId: string, checksum: string, ext: string): string {
  return `${siteId}/${siteId.slice(0, 8)}-${checksum.slice(0, 16)}.${ext}`;
}

export type UploadMediaInput = {
  siteId: string;
  filename: string;
  mimeType?: string;
  bytes: Buffer;
  altText?: string;
  actor: Actor;
  kindOverride?: MediaAsset["kind"];
};

export async function uploadMedia(
  input: UploadMediaInput,
): Promise<{ asset: MediaAsset; deduplicated: boolean }> {
  await ensureDb();
  const limit = await consumeRateLimit("upload", input.actor.user.id, 60, 3600);
  if (!limit.allowed) {
    throw new RateLimitError(
      "Upload rate limit reached (60 files per hour). Try again shortly.",
      limit.retryAfterSeconds,
    );
  }

  const maxBytes = await getSettingNumber("limits.upload_max_bytes", MAX_UPLOAD_BYTES);
  if (input.bytes.length === 0) throw new ValidationError("That file is empty.");
  if (input.bytes.length > maxBytes) {
    throw new ValidationError(
      `Files can be up to ${Math.round(maxBytes / (1024 * 1024))} MB; this one is ${(input.bytes.length / (1024 * 1024)).toFixed(1)} MB.`,
    );
  }

  const sniffed = sniffMime(input.bytes, input.mimeType ?? "application/octet-stream");
  if (!sniffed) {
    throw new ValidationError(
      "That file type is not supported. Upload PNG, JPEG, WebP, GIF, AVIF, SVG, or PDF.",
    );
  }

  let body = input.bytes;
  if (sniffed.mime === "image/svg+xml") {
    body = Buffer.from(sanitizeSvg(input.bytes.toString("utf8")), "utf8");
  }

  const checksum = crypto.createHash("sha256").update(body).digest("hex");
  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.siteId, input.siteId),
        eq(mediaAssets.checksum, checksum),
        eq(mediaAssets.status, "ready"),
      ),
    )
    .limit(1);
  if (existing) return { asset: existing, deduplicated: true };

  const kind = input.kindOverride ?? sniffed.kind;
  const key =
    kind === "import_reference"
      ? `${input.siteId}/imports/${checksum.slice(0, 24)}.${sniffed.ext}`
      : buildFinalKey(input.siteId, checksum, sniffed.ext);

  const stored = await putObject(key, body, sniffed.mime);
  const publicUrl = kind === "import_reference" ? "" : stored.publicUrl;
  const dims = probeDimensions(body, sniffed.mime);

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      siteId: input.siteId,
      kind,
      status: "ready",
      filename: key.split("/").pop() ?? input.filename,
      originalName: input.filename.slice(0, 180),
      mimeType: sniffed.mime,
      sizeBytes: body.length,
      width: dims.width,
      height: dims.height,
      checksum,
      storageKey: key,
      publicUrl,
      altText: input.altText ?? "",
      uploadedBy: input.actor.user.id,
    })
    .returning();

  await recordAudit({
    action: "media_uploaded",
    summary: `Uploaded "${asset.originalName}"`,
    siteId: input.siteId,
    actor: input.actor,
    targetType: "media",
    targetId: asset.id,
    detail: { mime: asset.mimeType, bytes: asset.sizeBytes, backend: storageBackend() },
  });

  return { asset, deduplicated: false };
}

export type PresignRequest = {
  siteId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  altText?: string;
  actor: Actor;
};

export type PresignGrant =
  | { mode: "deduplicated"; asset: MediaAsset }
  | {
      mode: "presigned";
      mediaId: string;
      uploadUrl: string;
      method: "PUT";
      headers: Record<string, string>;
      confirmUrl: string;
      expiresInSeconds: number;
    }
  | {
      mode: "direct";
      mediaId: string;
      uploadUrl: string;
      method: "POST";
      expiresInSeconds: number;
    };

export async function requestMediaUpload(req: PresignRequest): Promise<PresignGrant> {
  await ensureDb();
  const limit = await consumeRateLimit("upload", req.actor.user.id, 60, 3600);
  if (!limit.allowed) {
    throw new RateLimitError(
      "Upload rate limit reached (60 files per hour). Try again shortly.",
      limit.retryAfterSeconds,
    );
  }
  const allowed = ALLOWED_MIME[req.mimeType];
  if (!allowed || allowed.kind === "import_reference") {
    throw new ValidationError(
      "That file type is not supported. Upload PNG, JPEG, WebP, GIF, AVIF, SVG, or PDF.",
    );
  }
  const maxBytes = await getSettingNumber("limits.upload_max_bytes", MAX_UPLOAD_BYTES);
  if (req.sizeBytes <= 0 || req.sizeBytes > maxBytes) {
    throw new ValidationError(
      `Files must be larger than 0 bytes and at most ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    );
  }

  if (req.checksum && /^[a-f0-9]{64}$/i.test(req.checksum)) {
    const [existing] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.siteId, req.siteId),
          eq(mediaAssets.checksum, req.checksum.toLowerCase()),
          eq(mediaAssets.status, "ready"),
        ),
      )
      .limit(1);
    if (existing) return { mode: "deduplicated", asset: existing };
  }

  const pendingId = crypto.randomUUID();
  const stagingKey = `${req.siteId}/pending/${pendingId}.${allowed.ext}`;
  const signed = await presignPut(stagingKey, req.mimeType, maxBytes, PRESIGN_TTL_SECONDS);

  if (!signed) {
    return {
      mode: "direct",
      mediaId: pendingId,
      uploadUrl: `/api/sites/${req.siteId}/media`,
      method: "POST",
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  const [pending] = await db
    .insert(mediaAssets)
    .values({
      id: pendingId,
      siteId: req.siteId,
      kind: allowed.kind,
      status: "pending",
      filename: `${pendingId}.${allowed.ext}`,
      originalName: req.filename.slice(0, 180),
      mimeType: req.mimeType,
      sizeBytes: req.sizeBytes,
      checksum: (req.checksum ?? `pending:${pendingId}`).toLowerCase(),
      storageKey: stagingKey,
      publicUrl: publicUrlFor(stagingKey),
      altText: req.altText ?? "",
      uploadedBy: req.actor.user.id,
    })
    .returning();

  return {
    mode: "presigned",
    mediaId: pending.id,
    uploadUrl: signed.uploadUrl,
    method: "PUT",
    headers: signed.headers,
    confirmUrl: `/api/sites/${req.siteId}/media/${pending.id}/confirm`,
    expiresInSeconds: PRESIGN_TTL_SECONDS,
  };
}

export async function confirmPresignedUpload(
  siteId: string,
  mediaId: string,
  actor: Actor,
): Promise<{ asset: MediaAsset; deduplicated: boolean }> {
  await ensureDb();
  const [pending] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.siteId, siteId)))
    .limit(1);
  if (!pending) throw new NotFoundError("Pending upload not found.");
  if (pending.status === "ready") return { asset: pending, deduplicated: false };

  const maxBytes = await getSettingNumber("limits.upload_max_bytes", MAX_UPLOAD_BYTES);
  const head = await headObject(pending.storageKey);
  if (!head || head.size <= 0 || head.size > maxBytes) {
    await deleteObject(pending.storageKey);
    await db
      .update(mediaAssets)
      .set({ status: "failed" })
      .where(eq(mediaAssets.id, pending.id));
    throw new ValidationError(
      "Uploaded object did not arrive within the size ceiling. Try again.",
    );
  }

  const raw = await getObject(pending.storageKey);
  if (!raw) throw new ValidationError("Uploaded object could not be read for verification.");

  const sniffed = sniffMime(raw, pending.mimeType);
  if (!sniffed || sniffed.kind === "import_reference") {
    await deleteObject(pending.storageKey);
    await db
      .update(mediaAssets)
      .set({ status: "failed" })
      .where(eq(mediaAssets.id, pending.id));
    throw new ValidationError("Uploaded file failed content-type verification.");
  }

  let body = raw;
  if (sniffed.mime === "image/svg+xml") {
    body = Buffer.from(sanitizeSvg(raw.toString("utf8")), "utf8");
  }
  const checksum = crypto.createHash("sha256").update(body).digest("hex");

  const [dup] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.siteId, siteId),
        eq(mediaAssets.checksum, checksum),
        eq(mediaAssets.status, "ready"),
      ),
    )
    .limit(1);
  if (dup) {
    await deleteObject(pending.storageKey);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, pending.id));
    return { asset: dup, deduplicated: true };
  }

  const finalKey = buildFinalKey(siteId, checksum, sniffed.ext);
  const { publicUrl } = await putObject(finalKey, body, sniffed.mime);
  await deleteObject(pending.storageKey);

  const [ready] = await db
    .update(mediaAssets)
    .set({
      status: "ready",
      kind: sniffed.kind,
      mimeType: sniffed.mime,
      sizeBytes: body.length,
      checksum,
      filename: finalKey.split("/").pop() ?? pending.filename,
      storageKey: finalKey,
      publicUrl,
    })
    .where(eq(mediaAssets.id, pending.id))
    .returning();

  await recordAudit({
    action: "media_uploaded",
    summary: `Uploaded "${ready.originalName}" (presigned)`,
    siteId,
    actor,
    targetType: "media",
    targetId: ready.id,
    detail: { mime: ready.mimeType, bytes: ready.sizeBytes },
  });

  return { asset: ready, deduplicated: false };
}

export async function syncMediaReferencesForSource(
  siteId: string,
  sourceType: "page_draft" | "page_version" | "site_content" | "site_theme",
  sourceId: string,
  rawMediaIds: Iterable<string>,
): Promise<void> {
  await ensureDb();
  const wanted = [...new Set([...rawMediaIds].filter(Boolean))];

  await db
    .delete(mediaReferences)
    .where(
      and(
        eq(mediaReferences.siteId, siteId),
        eq(mediaReferences.sourceType, sourceType),
        eq(mediaReferences.sourceId, sourceId),
      ),
    );

  if (wanted.length === 0) return;

  const existingAssets = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.siteId, siteId), inArray(mediaAssets.id, wanted)));

  if (existingAssets.length === 0) return;

  await db
    .insert(mediaReferences)
    .values(
      existingAssets.map((a) => ({
        mediaId: a.id,
        siteId,
        sourceType,
        sourceId,
      })),
    )
    .onConflictDoNothing();
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
    .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.id, mediaId)))
    .limit(1);
  return row ?? null;
}

export async function mediaMapFor(siteId: string): Promise<Map<string, ResolvedMedia>> {
  await ensureDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.siteId, siteId), eq(mediaAssets.status, "ready")));
  const map = new Map<string, ResolvedMedia>();
  for (const r of rows) {
    if (r.kind === "import_reference" || !r.publicUrl) continue;
    map.set(r.id, {
      id: r.id,
      url: r.publicUrl,
      alt: r.altText,
      width: r.width,
      height: r.height,
    });
  }
  return map;
}

export async function updateMediaAlt(
  siteId: string,
  mediaId: string,
  altText: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  await db
    .update(mediaAssets)
    .set({ altText: altText.slice(0, 300) })
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.siteId, siteId)));
  await recordAudit({
    action: "media_updated",
    summary: "Updated image alt text",
    siteId,
    actor,
    targetType: "media",
    targetId: mediaId,
  });
}

export type MediaReference = {
  kind: "page_draft" | "page_published" | "global" | "theme";
  label: string;
  pageId?: string;
};

export async function findMediaReferences(
  siteId: string,
  mediaId: string,
): Promise<MediaReference[]> {
  await ensureDb();
  const refs: MediaReference[] = [];
  const seen = new Set<string>();

  const pushRef = (ref: MediaReference) => {
    const key = `${ref.kind}:${ref.pageId ?? ref.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  const sitePages = await db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      deletedAt: pages.deletedAt,
      draftDocument: pages.draftDocument,
      seo: pages.seo,
      publishedVersionId: pages.publishedVersionId,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId));

  const activePageById = new Map(sitePages.filter((p) => !p.deletedAt).map((p) => [p.id, p]));

  for (const p of activePageById.values()) {
    const draftIds = collectMediaIds(p.draftDocument);
    if (p.seo?.shareImageId) draftIds.add(p.seo.shareImageId);
    if (draftIds.has(mediaId)) {
      pushRef({ kind: "page_draft", label: `${p.title} (${p.slug}) draft`, pageId: p.id });
    }
  }

  const publishedVersionIds = [...activePageById.values()]
    .map((p) => p.publishedVersionId)
    .filter((id): id is string => Boolean(id));

  if (publishedVersionIds.length > 0) {
    const liveVersions = await db
      .select({
        id: pageVersions.id,
        pageId: pageVersions.pageId,
        document: pageVersions.document,
        seo: pageVersions.seo,
      })
      .from(pageVersions)
      .where(inArray(pageVersions.id, publishedVersionIds));

    for (const v of liveVersions) {
      const p = activePageById.get(v.pageId);
      if (!p) continue;
      const liveIds = collectMediaIds(v.document);
      if (v.seo?.shareImageId) liveIds.add(v.seo.shareImageId);
      if (liveIds.has(mediaId)) {
        pushRef({
          kind: "page_published",
          label: `${p.title} (${p.slug}) live version`,
          pageId: p.id,
        });
      }
    }
  }

  const globals = await db
    .select()
    .from(siteContents)
    .where(eq(siteContents.siteId, siteId));

  for (const g of globals) {
    const gIds = collectMediaIds(g.draftDocument);
    collectMediaIds(g.publishedDocument, gIds);
    if (gIds.has(mediaId)) {
      pushRef({ kind: "global", label: `Site ${g.kind}` });
    }
  }

  const [siteRow] = await db
    .select({ theme: sites.theme })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (siteRow?.theme?.logoMediaId === mediaId) {
    pushRef({ kind: "theme", label: "Site brand logo" });
  }

  return refs;
}

export async function deleteMedia(
  siteId: string,
  mediaId: string,
  actor: Actor,
  force = false,
): Promise<{ deleted: true } | { deleted: false; references: MediaReference[] }> {
  await ensureDb();
  const asset = await getMedia(siteId, mediaId);
  if (!asset) throw new NotFoundError("Media item not found.");

  const references = await findMediaReferences(siteId, mediaId);
  if (references.length > 0 && !force) {
    throw new ConflictError(
      `This file is used in ${references.length} place${references.length === 1 ? "" : "s"}. Remove those references first, or confirm forced deletion.`,
    );
  }

  await deleteObject(asset.storageKey);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, mediaId));

  await recordAudit({
    action: "media_deleted",
    summary: `Deleted "${asset.originalName}"${force && references.length ? " (forced while referenced)" : ""}`,
    siteId,
    actor,
    targetType: "media",
    targetId: mediaId,
  });

  return { deleted: true };
}

export const listSiteMedia = listMedia;
export const buildMediaLookup = mediaMapFor;

export function mediaPublicUrl(asset: { publicUrl: string }): string {
  return asset.publicUrl;
}

export async function readMediaFile(
  filename: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  await ensureDb();
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.publicUrl, `/media/${filename}`), eq(mediaAssets.status, "ready")))
    .limit(1);
  if (!asset || asset.kind === "import_reference") return null;
  const bytes = await getObject(asset.storageKey);
  if (!bytes) return null;
  return { bytes, mime: asset.mimeType };
}
